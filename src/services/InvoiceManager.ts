// src/services/InvoiceManager.ts
import type { PreviewSale } from "../types/sales";
import ThermalPrintService from "./ThermalPrintService";

// Interface for print options
export interface PrintOptions {
  silent?: boolean;
  printerName?: string;
  copies?: number;
}

// Interface for PDF options
export interface SavePdfOptions {
  directory: string;
  filename?: string;
  overwrite?: boolean;
}

/**
 * Service for managing invoices, printing, and PDF generation
 * Acts as a facade for underlying services
 */
export class InvoiceManager {
  private static instance: InvoiceManager;
  private thermalPrintService: ThermalPrintService;
  private settings: any = {};

  // Private constructor for singleton
  private constructor() {
    this.thermalPrintService = ThermalPrintService.getInstance();
    this.loadSettings();
  }

  // Get singleton instance
  public static getInstance(): InvoiceManager {
    if (!InvoiceManager.instance) {
      InvoiceManager.instance = new InvoiceManager();
    }
    return InvoiceManager.instance;
  }

  // Load settings from app configuration
  private async loadSettings(): Promise<void> {
    try {
      if (window.api?.getSettings) {
        this.settings = await window.api.getSettings();
      }
    } catch (error) {
      console.error("Error loading settings in InvoiceManager:", error);
      this.settings = {};
    }
  }

  /**
   * Print an invoice
   * @param sale Sale data
   * @param htmlContent Optional HTML content (if pre-generated)
   * @param options Print options
   * @returns Result of the operation
   */
  public async printInvoice(
    sale: PreviewSale, 
    htmlContent?: string, 
    options?: PrintOptions
  ): Promise<boolean> {
    try {
      // Refresh settings
      await this.loadSettings();

      // Check if thermal printing is preferred
      const useThermal = this.shouldUseThermalPrinter(options?.printerName);
      
      if (useThermal) {
        // Use ThermalPrintService
        console.log("Using thermal printer for invoice");
        const result = await this.thermalPrintService.printReceipt(sale);
        return result.success;
      } else {
        // Use standard printing
        console.log("Using standard printer for invoice");
        
        // Ensure HTML content is available
        const html = htmlContent || this.generatePrintHTML(sale);
        
        // Use appropriate API for printing
        if (window.printerApi?.print) {
          const result = await window.printerApi.print({
            html,
            printerName: options?.printerName,
            silent: options?.silent !== false,
            copies: options?.copies || 1
          });
          return result.success;
        } else if (window.api?.printInvoice) {
          const result = await window.api.printInvoice({
            html,
            printerName: options?.printerName,
            silent: options?.silent !== false,
            copies: options?.copies || 1
          });
          return result.success;
        }
        
        console.error("No printing API available");
        return false;
      }
    } catch (error) {
      console.error("Error printing invoice:", error);
      return false;
    }
  }

  /**
   * Save an invoice as PDF
   * @param sale Sale data
   * @param htmlContent HTML content to save
   * @param options PDF options
   * @returns Path to saved PDF or null if failed
   */
  public async saveAsPdf(
    sale: PreviewSale,
    htmlContent: string,
    options?: Partial<SavePdfOptions>
  ): Promise<string | null> {
    try {
      // Refresh settings
      await this.loadSettings();

      // Determine save directory
      let saveDirectory = options?.directory || "";
      if (!saveDirectory) {
        if (this.settings?.ruta_pdf) {
          saveDirectory = this.settings.ruta_pdf;
        } else if (window.api?.getAppPaths) {
          const paths = await window.api.getAppPaths();
          saveDirectory = `${paths.documents}/WilPOS/Facturas`;
        } else if (window.printerApi?.getPdfPath) {
          saveDirectory = await window.printerApi.getPdfPath() || "";
        }
      }

      // Ensure directory exists
      if (saveDirectory && window.api?.ensureDir) {
        await window.api.ensureDir(saveDirectory);
      }

      // Generate filename if not provided
      const saleId = sale.id || "tmp";
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = options?.filename || `factura-${saleId}-${dateStr}.pdf`;

      // Complete path
      const filePath = saveDirectory 
        ? `${saveDirectory}/${filename}` 
        : filename;

      // Save PDF using appropriate API
      if (window.printerApi?.savePdf) {
        const result = await window.printerApi.savePdf({
          html: htmlContent,
          path: filePath
        });
        
        if (result.success) {
          return result.path || filePath;
        }
        throw new Error(result.error || "Error saving PDF");
      } else if (window.api?.savePdf) {
        const result = await window.api.savePdf({
          html: htmlContent,
          path: filePath,
          options: { printBackground: true }
        });
        
        if (result.success) {
          return result.path || filePath;
        }
        throw new Error(result.error || "Error saving PDF");
      }
      
      throw new Error("No PDF saving API available");
    } catch (error) {
      console.error("Error saving PDF:", error);
      return null;
    }
  }

  /**
   * Format currency value based on settings
   * @param amount Amount to format
   * @returns Formatted currency string
   */
  public formatCurrency(amount: number): string {
    try {
      // Get currency from settings or use default
      const currencySymbol = this.settings?.moneda || "RD$";
      
      // Try to use Intl API
      if (typeof Intl !== 'undefined' && Intl.NumberFormat) {
        // Map common currency symbols to ISO codes
        const currencyMap: Record<string, string> = {
          'RD$': 'DOP',
          '$': 'USD',
          '€': 'EUR',
          '£': 'GBP'
        };
        
        // Determine currency code
        let currencyCode = 'DOP';
        if (currencyMap[currencySymbol]) {
          currencyCode = currencyMap[currencySymbol];
        } else if (currencySymbol.length === 3) {
          // It might already be an ISO code
          currencyCode = currencySymbol;
        }
        
        return new Intl.NumberFormat('es-DO', {
          style: 'currency',
          currency: currencyCode,
          minimumFractionDigits: 2
        }).format(amount);
      }
      
      // Fallback formatting
      return `${currencySymbol} ${amount.toFixed(2)}`;
    } catch (error) {
      console.error("Error formatting currency:", error);
      return `RD$ ${amount.toFixed(2)}`;
    }
  }

  /**
   * Determine if thermal printer should be used
   * @param printerName Optional printer name to check
   * @returns True if thermal printer should be used
   */
  private shouldUseThermalPrinter(printerName?: string): boolean {
    try {
      if (printerName) {
        // Check if specified printer name looks like a thermal printer
        return /thermal|receipt|pos|58mm|80mm|epson|tm-/i.test(printerName);
      }
      
      // Check if thermal printer service has an active printer
      if (this.thermalPrintService.activePrinter) {
        return true;
      }
      
      // Check if settings have a thermal printer defined
      if (this.settings?.impresora_termica) {
        return true;
      }
      
      // Default to false
      return false;
    } catch (error) {
      console.error("Error determining printer type:", error);
      return false;
    }
  }

  /**
   * Generate HTML for thermal receipt
   * @param sale Sale data
   * @returns HTML string
   */
  public generateThermalPrintHTML(sale: PreviewSale): string {
    try {
      // Defer to ThermalPrintService for generation
      // This is a stub that just creates a basic template
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura ${sale.id || "Temporal"}</title>
          <style>
            @page {
              margin: 0;
              size: 80mm auto;
            }
            body {
              font-family: 'Arial', 'Helvetica', sans-serif;
              margin: 0;
              padding: 5mm;
              width: 70mm;
              font-size: 10pt;
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
            .center {
              text-align: center;
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
          <div class="header">
            <div class="company">${this.settings?.nombre_negocio || 'WILPOS'}</div>
            <div class="invoice-id">Factura #${sale.id || "N/A"}</div>
            <div>Fecha: ${new Date(sale.fecha_venta).toLocaleString()}</div>
            <div>Cliente: ${sale.cliente || "Cliente General"}</div>
          </div>

          <div class="section">DETALLE DE VENTA</div>
          <table>
            <tr>
              <th>CANT</th>
              <th>DESCRIPCIÓN</th>
              <th class="right">PRECIO</th>
              <th class="right">TOTAL</th>
            </tr>
            ${sale.detalles
              .map(item => `
                <tr>
                  <td>${item.quantity}</td>
                  <td>${item.name.substring(0, 18)}${item.name.length > 18 ? "..." : ""}</td>
                  <td class="right">${this.formatCurrency(item.price)}</td>
                  <td class="right">${this.formatCurrency(item.subtotal)}</td>
                </tr>
              `)
              .join("")}
          </table>

          <div>
            <div class="total-row">
              <span>Subtotal:</span>
              <span>${this.formatCurrency(sale.total - sale.impuestos)}</span>
            </div>
            
            ${sale.impuestos > 0 ? `
              <div class="total-row">
                <span>Impuestos:</span>
                <span>${this.formatCurrency(sale.impuestos)}</span>
              </div>
            ` : ""}
            
            ${sale.descuento > 0 ? `
              <div class="total-row">
                <span>Descuento:</span>
                <span>-${this.formatCurrency(sale.descuento)}</span>
              </div>
            ` : ""}
            
            <div class="grand-total">
              <span>TOTAL:</span>
              <span>${this.formatCurrency(sale.total)}</span>
            </div>

            ${sale.metodo_pago === "Efectivo" ? `
              <div class="total-row">
                <span>Recibido:</span>
                <span>${this.formatCurrency(sale.monto_recibido)}</span>
              </div>
              <div class="total-row">
                <span>Cambio:</span>
                <span>${this.formatCurrency(sale.cambio)}</span>
              </div>
            ` : `
              <div class="total-row">
                <span>Método de pago:</span>
                <span>${sale.metodo_pago}</span>
              </div>
            `}
          </div>

          <div class="footer">
            <p>${this.settings?.mensaje_recibo || 'Gracias por su compra'}</p>
            <p>WILPOS - Sistema de Punto de Venta</p>
            <p>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
          </div>
        </body>
        </html>
      `;
    } catch (error) {
      console.error("Error generating thermal print HTML:", error);
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura Simplificada</title>
          <style>
            body { font-family: Arial; padding: 10mm; }
          </style>
        </head>
        <body>
          <h2>Factura #${sale?.id || "N/A"}</h2>
          <p>Fecha: ${new Date().toLocaleString()}</p>
          <p>Total: ${this.formatCurrency(sale?.total || 0)}</p>
          <p>Gracias por su compra</p>
          <p>WILPOS - Sistema de Punto de Venta</p>
        </body>
        </html>
      `;
    }
  }

  /**
   * Generate HTML for standard print layout
   * @param sale Sale data
   * @returns HTML string
   */
  public generatePrintHTML(sale: PreviewSale): string {
    try {
      const businessName = this.settings?.nombre_negocio || 'WilPOS';
      const businessAddress = this.settings?.direccion || '';
      const businessPhone = this.settings?.telefono || '';
      const businessRnc = this.settings?.rnc || '';
      const footerMessage = this.settings?.mensaje_recibo || 'Gracias por su compra';
      
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura ${sale.id || "Temporal"}</title>
          <style>
            @page {
              margin: 10mm;
              size: A4;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
            }
            .invoice-container {
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .invoice-title {
              font-size: 18px;
              margin: 15px 0;
              text-align: center;
              font-weight: bold;
            }
            .invoice-details {
              display: flex;
              justify-content: space-between;
              margin-bottom: 20px;
            }
            .invoice-details div {
              margin-bottom: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            table th, table td {
              padding: 8px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            table th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            .totals {
              margin-top: 20px;
              text-align: right;
            }
            .totals div {
              margin-bottom: 5px;
            }
            .total-line {
              font-weight: bold;
              font-size: 16px;
              border-top: 2px solid #000;
              padding-top: 5px;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header">
              <div class="company-name">${businessName}</div>
              ${businessAddress ? `<div>${businessAddress}</div>` : ''}
              ${businessPhone ? `<div>Tel: ${businessPhone}</div>` : ''}
              ${businessRnc ? `<div>RNC: ${businessRnc}</div>` : ''}
            </div>
            
            <div class="invoice-title">FACTURA #${sale.id || "N/A"}</div>
            
            <div class="invoice-details">
              <div>
                <div><strong>Fecha:</strong> ${new Date(sale.fecha_venta).toLocaleString()}</div>
                <div><strong>Cliente:</strong> ${sale.cliente || "Cliente General"}</div>
              </div>
              <div>
                <div><strong>Método de pago:</strong> ${sale.metodo_pago}</div>
                <div><strong>Estado:</strong> ${sale.estado || "Completada"}</div>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>ITBIS</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${sale.detalles
                  .map(item => {
                    const taxStatus = item.is_exempt ? "Exento" : (item.itebis * 100).toFixed(0) + "%";
                    return `
                      <tr>
                        <td>${item.name}</td>
                        <td>${item.quantity}</td>
                        <td>${this.formatCurrency(item.price)}</td>
                        <td>${taxStatus}</td>
                        <td>${this.formatCurrency(item.subtotal)}</td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
            
            <div class="totals">
              <div><strong>Subtotal:</strong> ${this.formatCurrency(sale.total - sale.impuestos)}</div>
              <div><strong>ITBIS:</strong> ${this.formatCurrency(sale.impuestos)}</div>
              ${sale.descuento > 0 ? `<div><strong>Descuento:</strong> -${this.formatCurrency(sale.descuento)}</div>` : ""}
              <div class="total-line"><strong>TOTAL:</strong> ${this.formatCurrency(sale.total)}</div>
              
              ${sale.metodo_pago === "Efectivo" ? `
                <div><strong>Monto recibido:</strong> ${this.formatCurrency(sale.monto_recibido)}</div>
                <div><strong>Cambio:</strong> ${this.formatCurrency(sale.cambio)}</div>
              ` : ""}
            </div>
            
            <div class="footer">
              <p>${footerMessage}</p>
              <p>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } catch (error) {
      console.error("Error generating print HTML:", error);
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura Simplificada</title>
          <style>
            body { font-family: Arial; padding: 20px; }
          </style>
        </head>
        <body>
          <h2>Factura #${sale?.id || "N/A"}</h2>
          <p>Fecha: ${new Date().toLocaleString()}</p>
          <p>Total: ${this.formatCurrency(sale?.total || 0)}</p>
          <p>Gracias por su compra</p>
        </body>
        </html>
      `;
    }
  }
}

export default InvoiceManager;