// src/services/ThermalPrintService.ts

import type { PreviewSale } from '../types/sales';

// Interface for printer status
export interface PrinterStatus {
  available: boolean;
  printerName?: string;
  message?: string;
  error?: string;
}

// Interface for print result
export interface PrintResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Service for managing thermal printer integration
 * Handles basic printing operations
 */
export class ThermalPrintService {
  private static instance: ThermalPrintService;
  private _activePrinter: string | null = null;

  // Private constructor for singleton
  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): ThermalPrintService {
    if (!ThermalPrintService.instance) {
      ThermalPrintService.instance = new ThermalPrintService();
    }
    return ThermalPrintService.instance;
  }

  /**
   * Get list of available printers
   */
  public async getAvailablePrinters(): Promise<Array<{
    name: string;
    isDefault?: boolean;
    description?: string;
  }>> {
    try {
      // Use the unified printer API that connects to the main process
      if (window.printerApi?.getPrinters) {
        const result = await window.printerApi.getPrinters();
        if (result.success && result.printers) {
          return result.printers;
        }
      }
      
      console.warn("Printer API not available, using empty printer list");
      return [];
    } catch (error) {
      console.error("Error getting available printers:", error);
      return [];
    }
  }

  /**
   * Print a receipt for a sale
   */
  public async printReceipt(sale: PreviewSale): Promise<PrintResult> {
    try {
      // Get available printers
      const printers = await this.getAvailablePrinters();
      
      // Use default printer if available
      const defaultPrinter = printers.find(p => p.isDefault);
      const printerName = defaultPrinter?.name || (printers[0]?.name || null);
      
      if (!printerName) {
        throw new Error('No printer available');
      }

      // Generate receipt HTML
      const receiptHtml = this.generateReceiptHtml(sale);

      // Print using appropriate API
      if (window.printerApi?.print) {
        // New API
        const result = await window.printerApi.print({
          html: receiptHtml,
          printerName: printerName,
          silent: true,
          options: {
            thermal: true,
            paperWidth: '80mm'
          }
        });

        if (result.success) {
          return { success: true, message: 'Receipt printed successfully' };
        } else {
          throw new Error(result.error || 'Unknown error printing receipt');
        }
      } else if (window.api?.printInvoice) {
        // Legacy API
        const result = await window.api.printInvoice({
          html: receiptHtml,
          printerName: printerName,
          silent: true,
          options: {
            paperWidth: '80mm',
            thermal: true
          }
        });

        if (result.success) {
          return { success: true, message: 'Receipt printed successfully' };
        } else {
          throw new Error(result.error || 'Unknown error printing receipt');
        }
      } else {
        throw new Error('No printing API available');
      }
    } catch (error) {
      console.error("Error printing receipt:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error printing receipt'
      };
    }
  }

  /**
   * Generate HTML for receipt
   */
  private generateReceiptHtml(sale: PreviewSale): string {
    try {
      // Basic business info
      const businessName = 'WilPOS';
      const thankYouMessage = 'Gracias por su compra';

      // Formatting function
      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-DO', {
          style: 'currency',
          currency: 'DOP'
        }).format(amount);
      };

      // Create details rows
      const detailRows = sale.detalles.map(item => {
        return `
          <tr>
            <td>${item.quantity}</td>
            <td style="max-width: 35mm; overflow: hidden; text-overflow: ellipsis;">
              ${item.name}
              ${item.is_exempt ? ' (E)' : ''}
            </td>
            <td style="text-align: right;">${formatCurrency(item.price)}</td>
            <td style="text-align: right;">${formatCurrency(item.subtotal)}</td>
          </tr>
        `;
      }).join('');

      // Basic receipt HTML template
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Recibo ${sale.id || 'Temporal'}</title>
          <style>
            @page {
              margin: 0;
              size: 80mm auto;
            }
            body {
              font-family: 'Arial', sans-serif;
              margin: 0;
              padding: 5mm;
              width: 76mm;
              font-size: 9pt;
              line-height: 1.2;
            }
            .header {
              text-align: center;
              margin-bottom: 3mm;
            }
            .company {
              font-size: 12pt;
              font-weight: bold;
              margin-bottom: 1mm;
            }
            .invoice-id {
              font-size: 10pt;
              font-weight: bold;
              margin-bottom: 1mm;
            }
            .section {
              margin: 3mm 0;
              padding: 2mm 0;
              border-top: 1px dashed #000;
              border-bottom: 1px dashed #000;
              text-align: center;
              font-weight: bold;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 3mm 0;
            }
            th, td {
              text-align: left;
              padding: 1mm;
              font-size: 9pt;
            }
            th {
              font-weight: bold;
            }
            .right {
              text-align: right;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin: 1mm 0;
            }
            .grand-total {
              font-weight: bold;
              font-size: 12pt;
              margin: 2mm 0;
              border-top: 1px solid #000;
              padding-top: 2mm;
            }
            .footer {
              text-align: center;
              font-size: 9pt;
              margin-top: 5mm;
              border-top: 1px dashed #000;
              padding-top: 2mm;
            }
          </style>
        </head>
        <body>
          <!-- Header Section -->
          <div class="header">
            <div class="company">${businessName}</div>
            <div class="invoice-id">Factura #${sale.id || 'N/A'}</div>
            <div>Fecha: ${new Date(sale.fecha_venta).toLocaleString()}</div>
            <div>Cliente: ${sale.cliente || 'Cliente General'}</div>
          </div>

          <!-- Items Section -->
          <div class="section">DETALLE DE VENTA</div>
          <table>
            <tr>
              <th>CANT</th>
              <th>DESCRIPCIÓN</th>
              <th class="right">PRECIO</th>
              <th class="right">TOTAL</th>
            </tr>
            ${detailRows}
          </table>

          <!-- Totals -->
          <div>
            <div class="total-row">
              <span>Subtotal:</span>
              <span>${formatCurrency(sale.total - sale.impuestos)}</span>
            </div>
            
            ${
              sale.impuestos > 0
                ? `
              <div class="total-row">
                <span>Impuestos:</span>
                <span>${formatCurrency(sale.impuestos)}</span>
              </div>
            `
                : ''
            }
            
            ${
              sale.descuento > 0
                ? `
              <div class="total-row">
                <span>Descuento:</span>
                <span>-${formatCurrency(sale.descuento)}</span>
              </div>
            `
                : ''
            }
            
            <div class="grand-total">
              <span>TOTAL:</span>
              <span>${formatCurrency(sale.total)}</span>
            </div>

            <!-- Payment Information -->
            ${
              sale.metodo_pago === 'Efectivo'
                ? `
              <div class="total-row">
                <span>Recibido:</span>
                <span>${formatCurrency(sale.monto_recibido)}</span>
              </div>
              <div class="total-row">
                <span>Cambio:</span>
                <span>${formatCurrency(sale.cambio)}</span>
              </div>
            `
                : `
              <div class="total-row">
                <span>Método de pago:</span>
                <span>${sale.metodo_pago}</span>
              </div>
            `
            }
          </div>

          <!-- Footer Section -->
          <div class="footer">
            <p>${thankYouMessage}</p>
            <p>WilPOS - Sistema de Punto de Venta</p>
            <p>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
          </div>
        </body>
        </html>
      `;
    } catch (error) {
      console.error("Error generating receipt HTML:", error);
      // Return simple fallback template in case of error
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Recibo Simple</title>
          <style>
            body { font-family: Arial; font-size: 10pt; }
            .header { text-align: center; margin-bottom: 10px; }
            .total { font-weight: bold; font-size: 12pt; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>WilPOS</h2>
            <p>Factura #${sale.id || 'N/A'}</p>
          </div>
          <p>Fecha: ${new Date(sale.fecha_venta).toLocaleString()}</p>
          <p>Cliente: ${sale.cliente || 'Cliente General'}</p>
          <p>Total: ${new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(sale.total)}</p>
          <p>Método de pago: ${sale.metodo_pago}</p>
          <div class="footer">
            <p>Gracias por su compra</p>
          </div>
        </body>
        </html>
      `;
    }
  }
}

export default ThermalPrintService;