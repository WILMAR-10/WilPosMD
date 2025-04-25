// src/services/ThermalPrintService.ts
import { PreviewSale } from '../types/sales';

// Enum for paper sizes following SOLID principles
export enum ThermalPaperSize {
  PAPER_80MM = '80mm',
  PAPER_58MM = '58mm'
}

// Interface for printer-related responses (Interface Segregation)
export interface PrintResult {
  success: boolean;
  message?: string;
  error?: string;
}

// Interface for printer information
export interface PrinterInfo {
  name: string;
  description?: string;
  isDefault?: boolean;
  isThermal?: boolean;
}

/**
 * Service for thermal printer operations following Singleton pattern
 * and Single Responsibility Principle
 */
export class ThermalPrintService {
  private static instance: ThermalPrintService;
  private printerName: string | undefined = undefined;
  private paperSize: ThermalPaperSize = ThermalPaperSize.PAPER_80MM;
  
  // Private constructor for singleton pattern
  private constructor() {
    this.loadSettings();
  }
  
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
   * Load settings from app configuration
   */
  private async loadSettings(): Promise<void> {
    try {
      if (window.api?.getSettings) {
        const settings = await window.api.getSettings();
        
        if (settings) {
          this.printerName = settings.impresora_termica || undefined;
          
          // Set paper size based on configuration
          if (settings.tipo_impresora === 'termica58') {
            this.paperSize = ThermalPaperSize.PAPER_58MM;
          } else {
            this.paperSize = ThermalPaperSize.PAPER_80MM;
          }
        }
      }
    } catch (error) {
      console.error('Error loading thermal printer settings:', error);
    }
  }
  
  /**
   * Force reload of settings
   */
  public async reloadSettings(): Promise<void> {
    await this.loadSettings();
  }
  
  /**
   * Check if a thermal printer is available
   */
  public async checkPrinterStatus(): Promise<{ available: boolean; printerName?: string; message?: string }> {
    try {
      // Get all available printers
      const printers = await this.getAllPrinters();
      
      // If we have a configured printer, check if it's available
      if (this.printerName) {
        const configuredPrinter = printers.printers.find(p => p.name === this.printerName);
        
        if (configuredPrinter) {
          return { 
            available: true, 
            printerName: this.printerName,
            message: `Impresora configurada "${this.printerName}" disponible`
          };
        }
        
        return {
          available: false,
          message: `Impresora configurada "${this.printerName}" no disponible`
        };
      }
      
      // If no printer is configured, look for thermal printers
      const thermalPrinter = printers.printers.find(p => this.isThermalPrinter(p.name));
      if (thermalPrinter) {
        // Save the detected printer for future use
        this.printerName = thermalPrinter.name;
        
        return { 
          available: true, 
          printerName: thermalPrinter.name,
          message: `Impresora térmica detectada: "${thermalPrinter.name}"`
        };
      }
      
      // If no thermal printers, use the default printer
      const defaultPrinter = printers.printers.find(p => p.isDefault);
      if (defaultPrinter) {
        return {
          available: true,
          printerName: defaultPrinter.name,
          message: `No se detectaron impresoras térmicas. Usando impresora predeterminada "${defaultPrinter.name}"`
        };
      }
      
      return {
        available: false,
        message: 'No se detectaron impresoras'
      };
    } catch (error) {
      console.error('Error checking printer status:', error);
      return {
        available: false,
        message: `Error al verificar impresora: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }
  
  /**
   * Get all available printers
   */
  public async getAllPrinters(): Promise<{ printers: PrinterInfo[] }> {
    try {
      // Try using printerApi first (preferred)
      if (window.printerApi?.getPrinters) {
        const res = await window.printerApi.getPrinters();
        if (res.success) {
          return { printers: res.printers };
        }
      }
      
      // Fallback to window.api
      if (window.api?.getPrinters) {
        const printers = await window.api.getPrinters();
        return { printers };
      }
      
      // Last resort - empty list
      console.warn('No printer API available');
      return { printers: [] };
    } catch (error) {
      console.warn('Error getting printers:', error);
      return { printers: [] };
    }
  }
  
  /**
   * Detect if a printer is a thermal printer based on its name
   */
  private isThermalPrinter(name: string): boolean {
    const lowerName = name.toLowerCase();
    return lowerName.includes('thermal') ||
           lowerName.includes('receipt') ||
           lowerName.includes('pos') ||
           lowerName.includes('80mm') ||
           lowerName.includes('58mm') ||
           lowerName.includes('ticket');
  }
  
  /**
   * Format number as currency
   */
  private formatCurrency(amount: number): string {
    try {
      return new Intl.NumberFormat('es-DO', { 
        style: 'currency', 
        currency: 'DOP',
        minimumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      return `RD$ ${amount.toFixed(2)}`;
    }
  }
  
  /**
   * Generate HTML optimized for thermal printers
   */
  private generateThermalReceiptHTML(sale: PreviewSale): string {
    // Adjust width based on paper size
    const contentWidth = this.paperSize === ThermalPaperSize.PAPER_58MM ? '48mm' : '72mm';
    
    try {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura ${sale.id || ''}</title>
          <style>
            @page { 
              margin: 0mm; 
              size: ${this.paperSize};
            }
            body {
              font-family: 'Arial', sans-serif;
              width: ${contentWidth};
              margin: 0;
              padding: 3mm;
              font-size: 10pt;
              line-height: 1.2;
            }
            .header {
              text-align: center;
              margin-bottom: 5mm;
            }
            .company {
              font-size: 12pt;
              font-weight: bold;
              margin-bottom: 2mm;
            }
            .title {
              font-size: 10pt;
              font-weight: bold;
              text-align: center;
              border-top: 1px dashed #000;
              border-bottom: 1px dashed #000;
              padding: 2mm 0;
              margin: 2mm 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              text-align: left;
              font-size: 9pt;
              padding: 1mm;
            }
            .right {
              text-align: right;
            }
            .total-line {
              display: flex;
              justify-content: space-between;
              font-size: 9pt;
              margin: 1mm 0;
            }
            .grand-total {
              font-weight: bold;
              font-size: 11pt;
              margin-top: 2mm;
              border-top: 1px solid #000;
              padding-top: 2mm;
            }
            .footer {
              text-align: center;
              font-size: 8pt;
              margin-top: 5mm;
              border-top: 1px dashed #000;
              padding-top: 2mm;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company">WILPOS</div>
            <div>Factura #${sale.id || 'N/A'}</div>
            <div>Fecha: ${new Date(sale.fecha_venta).toLocaleDateString()}</div>
            <div>Cliente: ${sale.cliente || 'Cliente General'}</div>
          </div>
          
          <div class="title">DETALLE DE VENTA</div>
          
          <table>
            <tr>
              <th>CANT</th>
              <th>DESCRIPCIÓN</th>
              <th class="right">PRECIO</th>
              <th class="right">TOTAL</th>
            </tr>
            ${sale.detalles.map(item => `
              <tr>
                <td>${item.quantity}</td>
                <td>${item.name.substring(0, 15)}${item.name.length > 15 ? '...' : ''}</td>
                <td class="right">RD$${item.price.toFixed(2)}</td>
                <td class="right">RD$${item.subtotal.toFixed(2)}</td>
              </tr>
            `).join('')}
          </table>
          
          <div style="border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm;">
            <div class="total-line">
              <span>Subtotal:</span>
              <span>RD$${(sale.total - sale.impuestos).toFixed(2)}</span>
            </div>
            <div class="total-line">
              <span>Impuestos:</span>
              <span>RD$${sale.impuestos.toFixed(2)}</span>
            </div>
            ${sale.descuento > 0 ? `
              <div class="total-line">
                <span>Descuento:</span>
                <span>-RD$${sale.descuento.toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="grand-total">
              <span>TOTAL:</span>
              <span>RD$${sale.total.toFixed(2)}</span>
            </div>
            
            ${sale.metodo_pago === 'Efectivo' ? `
              <div class="total-line">
                <span>Recibido:</span>
                <span>RD$${sale.monto_recibido.toFixed(2)}</span>
              </div>
              <div class="total-line">
                <span>Cambio:</span>
                <span>RD$${sale.cambio.toFixed(2)}</span>
              </div>
            ` : `
              <div class="total-line">
                <span>Método de pago:</span>
                <span>${sale.metodo_pago}</span>
              </div>
            `}
          </div>
          
          <div class="footer">
            <p>Gracias por su compra</p>
            <p>WILPOS - Sistema de Punto de Venta</p>
            <p>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
          </div>
        </body>
        </html>
      `;
    } catch (error) {
      console.error('Error generating thermal receipt HTML:', error);
      // Simple fallback (KISS principle)
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Factura Simplificada</title>
        </head>
        <body>
          <h2>Factura #${sale.id || 'N/A'}</h2>
          <p>Total: RD$${sale.total.toFixed(2)}</p>
          <p>Gracias por su compra</p>
        </body>
        </html>
      `;
    }
  }
  
  /**
   * Print a receipt using thermal printer
   */
  public async printReceipt(sale: PreviewSale): Promise<PrintResult> {
    try {
      // Generate thermal-specific HTML
      const html = this.generateThermalReceiptHTML(sale);
      
      // Prepare print options
      const printOptions = {
        html,
        printerName: this.printerName,
        silent: true,
        options: {
          thermalPrinter: true,
          pageSize: this.paperSize
        }
      };
      
      // Use available API
      if (window.printerApi?.print) {
        const result = await window.printerApi.print(printOptions);
        
        if (!result.success) {
          throw new Error(result.error || 'Error al imprimir');
        }
        
        return { success: true, message: 'Impresión enviada a la impresora térmica' };
      } else if (window.api?.printInvoice) {
        const result = await window.api.printInvoice(printOptions);
        
        if (!result.success) {
          throw new Error(result.error || 'Error al imprimir');
        }
        
        return { success: true, message: 'Impresión enviada a la impresora térmica' };
      } else {
        throw new Error('API de impresión no disponible');
      }
    } catch (error) {
      console.error('Error printing receipt:', error);
      return { 
        success: false, 
        message: `Error al imprimir: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }
  
  /**
   * Print a test page
   */
  public async testPrinter(): Promise<PrintResult> {
    try {
      // HTML for test page
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Prueba de Impresora</title>
          <style>
            @page { 
              margin: 0mm; 
              size: ${this.paperSize};
            }
            body {
              font-family: 'Arial', sans-serif;
              text-align: center;
              padding: 5mm;
            }
            .title {
              font-size: 12pt;
              font-weight: bold;
              margin-bottom: 5mm;
            }
            .section {
              margin: 5mm 0;
              text-align: left;
            }
          </style>
        </head>
        <body>
          <div class="title">PRUEBA DE IMPRESORA TÉRMICA</div>
          
          <div class="section">
            Impresora: ${this.printerName || 'Predeterminada'}
            Tamaño: ${this.paperSize}
            Fecha: ${new Date().toLocaleString()}
          </div>
          
          <div class="section">
            ABCDEFGHIJKLMNÑOPQRSTUVWXYZ
            1234567890
          </div>
          
          <div style="border-top: 1px dashed #000; margin-top: 5mm; padding-top: 5mm;">
            Si puede leer este texto, la impresora funciona correctamente.
          </div>
        </body>
        </html>
      `;
      
      // Print options
      const printOptions = {
        html,
        printerName: this.printerName,
        silent: true,
        options: {
          thermalPrinter: true,
          pageSize: this.paperSize
        }
      };
      
      // Use available API
      if (window.printerApi?.print) {
        const result = await window.printerApi.print(printOptions);
        
        if (!result.success) {
          throw new Error(result.error || 'Error al imprimir página de prueba');
        }
        
        return { success: true, message: 'Página de prueba enviada a la impresora' };
      } else if (window.api?.printInvoice) {
        const result = await window.api.printInvoice(printOptions);
        
        if (!result.success) {
          throw new Error(result.error || 'Error al imprimir página de prueba');
        }
        
        return { success: true, message: 'Página de prueba enviada a la impresora' };
      } else {
        throw new Error('API de impresión no disponible');
      }
    } catch (error) {
      console.error('Error printing test page:', error);
      return { 
        success: false, 
        message: `Error al imprimir página de prueba: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }
  
  /**
   * Print using the electron-pos-printer library (extends functionality)
   * This is a more advanced printing method that can be used for specific thermal printer features
   */
  public async printWithPosPrinter(sale: PreviewSale): Promise<PrintResult> {
    try {
      // Check if we have the specialized API
      if (!window.api?.printWithPosPrinter) {
        // Fallback to standard printing if specialized API is not available
        return this.printReceipt(sale);
      }
      
      // Create data for electron-pos-printer
      const printData = [
        {
          type: 'text',
          value: 'WILPOS',
          style: { fontWeight: "700", textAlign: 'center', fontSize: "14px" }
        },
        {
          type: 'text',
          value: `Factura #${sale.id || 'N/A'}`,
          style: { textAlign: 'center', fontSize: "12px" }
        },
        {
          type: 'text',
          value: `Fecha: ${new Date(sale.fecha_venta).toLocaleDateString()}`,
          style: { textAlign: 'center', fontSize: "10px" }
        },
        {
          type: 'text',
          value: `Cliente: ${sale.cliente || 'Cliente General'}`,
          style: { textAlign: 'center', fontSize: "10px", marginBottom: '10px' }
        },
        {
          type: 'text',
          value: 'DETALLE DE VENTA',
          style: { fontWeight: "700", textAlign: 'center', fontSize: "12px", borderTop: '1px dashed black', borderBottom: '1px dashed black', paddingTop: '5px', paddingBottom: '5px', marginTop: '5px', marginBottom: '5px' }
        },
        // Add each product
        ...sale.detalles.map(item => ({
          type: 'text',
          value: `${item.quantity}x ${item.name.substring(0, 20)}${item.name.length > 20 ? '...' : ''}\n   ${this.formatCurrency(item.price)} c/u - ${this.formatCurrency(item.subtotal)}`,
          style: { fontSize: "10px", marginBottom: '5px' }
        })),
        // Totals section
        {
          type: 'text',
          value: '--------------------------------',
          style: { textAlign: 'center' }
        },
        {
          type: 'text',
          value: `Subtotal: ${this.formatCurrency(sale.total - sale.impuestos)}`,
          style: { textAlign: 'right', fontSize: "10px" }
        },
        {
          type: 'text',
          value: `Impuestos: ${this.formatCurrency(sale.impuestos)}`,
          style: { textAlign: 'right', fontSize: "10px" }
        },
        ...(sale.descuento > 0 ? [{
          type: 'text',
          value: `Descuento: -${this.formatCurrency(sale.descuento)}`,
          style: { textAlign: 'right', fontSize: "10px" }
        }] : []),
        {
          type: 'text',
          value: `TOTAL: ${this.formatCurrency(sale.total)}`,
          style: { textAlign: 'right', fontWeight: "700", fontSize: "12px", borderTop: '1px solid black', paddingTop: '5px', marginTop: '5px' }
        },
        ...(sale.metodo_pago === 'Efectivo' ? [
          {
            type: 'text',
            value: `Recibido: ${this.formatCurrency(sale.monto_recibido)}`,
            style: { textAlign: 'right', fontSize: "10px" }
          },
          {
            type: 'text',
            value: `Cambio: ${this.formatCurrency(sale.cambio)}`,
            style: { textAlign: 'right', fontSize: "10px" }
          }
        ] : [
          {
            type: 'text',
            value: `Método de pago: ${sale.metodo_pago}`,
            style: { textAlign: 'right', fontSize: "10px" }
          }
        ]),
        // Footer
        {
          type: 'text',
          value: '--------------------------------',
          style: { textAlign: 'center', marginTop: '10px' }
        },
        {
          type: 'text',
          value: 'Gracias por su compra',
          style: { textAlign: 'center', fontSize: "10px" }
        },
        {
          type: 'text',
          value: 'WILPOS - Sistema de Punto de Venta',
          style: { textAlign: 'center', fontSize: "8px" }
        }
      ];
      
      // Print options
      const options = {
        preview: false,
        margin: '0 0 0 0',
        copies: 1,
        printerName: this.printerName,
        timeOutPerLine: 400,
        pageSize: this.paperSize
      };
      
      // Send to printer
      const result = await window.api.printWithPosPrinter(printData, options);
      
      if (!result.success) {
        throw new Error(result.error || 'Error al imprimir');
      }
      
      return { success: true, message: 'Impresión enviada a la impresora térmica' };
    } catch (error) {
      console.error('Error in POS printing:', error);
      // If specialized printing fails, fall back to standard printing
      return this.printReceipt(sale);
    }
  }
}

export default ThermalPrintService;