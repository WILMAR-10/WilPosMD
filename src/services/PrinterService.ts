// src/services/PrinterService.ts - Fixed version
import { PreviewSale } from '../types/sales';
import { PrintInvoiceRequest, SavePdfResult } from '../types/printer';

// Based on printer configuration from the screenshot
const PRINTER_SETTINGS = {
  defaultPrinterName: "POS891US", // Default printer model from the image
  paperWidth: "80mm",             // Standard thermal receipt width
  encoding: "cp437",              // Standard encoding for POS printers
  characterSet: "USA",
  fontSize: "12x24"               // Font size shown in the printer settings
};

/**
 * Service for handling all printer-related operations
 */
export class PrinterService {
  private static instance: PrinterService;
  private printerName: string | null = null;
  private saveToPdf: boolean = false;
  private pdfSavePath: string = '';

  // Private constructor for singleton pattern
  private constructor() {
    // Initialize with default values
    this.loadSettings();
  }

  // Get singleton instance
  public static getInstance(): PrinterService {
    if (!PrinterService.instance) {
      PrinterService.instance = new PrinterService();
    }
    return PrinterService.instance;
  }

  /**
   * Load printer settings from application configuration
   */
  private async loadSettings(): Promise<void> {
    try {
      if (window.api?.getSettings) {
        const settings = await window.api.getSettings();
        
        if (settings) {
          this.printerName = settings.impresora_termica || null;
          this.saveToPdf = !!settings.guardar_pdf;
          this.pdfSavePath = settings.ruta_pdf || '';
          
          console.log("Printer settings loaded:", {
            printerName: this.printerName,
            saveToPdf: this.saveToPdf,
            pdfSavePath: this.pdfSavePath
          });
        }
      }
    } catch (error) {
      console.error('Error loading printer settings:', error);
    }
  }

  /**
   * Get available printers - FIXED to use global API
   */
  public async getAvailablePrinters(): Promise<any[]> {
    if (!window.api?.getPrinters) {
      console.warn('getPrinters API is not available');
      return [];
    }
    
    try {
      // Use the global API instead of window-specific methods
      const printers = await window.api.getPrinters();
      return Array.isArray(printers) ? printers : [];
    } catch (error) {
      console.error('Error getting printers:', error);
      return [];
    }
  }

  /**
   * Generate optimized HTML for thermal printer
   */
  public generateThermalReceiptHTML(sale: PreviewSale): string {
    try {
      // This template is optimized for thermal printers, with proper sizing
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura ${sale.id || ''}</title>
          <style>
            @page { 
              margin: 0mm; 
              size: ${PRINTER_SETTINGS.paperWidth};
            }
            body {
              font-family: 'Arial', sans-serif;
              width: 72mm;
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
   * Print receipt to thermal printer
   */
  public async printReceipt(sale: PreviewSale): Promise<{ success: boolean; message?: string }> {
    try {
      console.log("Starting print process for sale ID:", sale.id);
      
      // Generate the HTML content optimized for thermal printer
      const htmlContent = this.generateThermalReceiptHTML(sale);
      
      // Verify valid HTML content
      if (!htmlContent || htmlContent.trim() === '') {
        throw new Error('Invalid or empty HTML content for printing');
      }
      
      // Save to PDF if enabled in settings
      if (this.saveToPdf && this.pdfSavePath) {
        try {
          await this.saveToPDF(sale, htmlContent);
        } catch (pdfError) {
          console.warn("Error saving PDF, but will continue with print:", pdfError);
        }
      }
      
      // Check if API exists
      if (!window.api?.printInvoice) {
        throw new Error("Print API is not available");
      }
      
      // Print options for thermal printer
      const printOptions: PrintInvoiceRequest = {
        html: htmlContent,
        printerName: this.printerName || undefined, // Will use system default if undefined
        silent: false,
        copies: 1,
        options: { thermalPrinter: true, pageSize: '80mm' }
      };
      
      console.log("Sending print job with options:", {
        printerName: printOptions.printerName || "Default System Printer",
        silent: printOptions.silent,
        copies: printOptions.copies
      });
      
      // Send the print job directly using window.api
      const result = await window.api.printInvoice(printOptions);
      
      if (result && result.success) {
        return { success: true, message: "Print job sent successfully" };
      }
      
      // If printing fails, return detailed error
      throw new Error(result?.error || "Unknown printing error");
    } catch (error) {
      console.error("Error in print process:", error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : "Unknown printing error"
      };
    }
  }

  /**
   * Wrapper function for window.api.printInvoice with fixed type issues
   */
  public async printInvoice(
    sale: PreviewSale,
    html: string,
    opts: any
  ): Promise<boolean> {
    // Fix: Simplify the options to match the API's expected format
    const printOptions: PrintInvoiceRequest = {
      html,
      printerName: opts?.printerName,
      silent: opts?.silent ?? false,
      copies: opts?.copies ?? 1,
      options: { thermalPrinter: true, pageSize: '80mm' }
    };

    try {
      // Check if API is available
      if (!window.api?.printInvoice) {
        console.error("Print API not available");
        return false;
      }
      
      // Call the API exposed in preload
      const result = await window.api.printInvoice(printOptions);
      return result && result.success === true;
    } catch (error) {
      console.error("Error in printInvoice:", error);
      return false;
    }
  }

  /**
   * Save receipt as PDF
   */
  private async saveToPDF(sale: PreviewSale, htmlContent: string): Promise<string | null> {
    if (!window.api?.savePdf) {
      throw new Error("PDF saving API is not available");
    }
    
    try {
      const date = new Date().toISOString().split('T')[0];
      const filename = `factura-${sale.id || 'temp'}-${date}.pdf`;
      const path = `${this.pdfSavePath}/${filename}`;
      
      console.log("Saving PDF to:", path);
      
      const result = await window.api.savePdf({
        html: htmlContent,
        path: path,
        options: {
          printBackground: true,
          margins: { top: 0, right: 0, bottom: 0, left: 0 }
        }
      });
      
      if (result.success) {
        return result.path || path;
      }
      
      throw new Error(result.error || "Error saving PDF");
    } catch (error) {
      console.error("Error saving PDF:", error);
      throw error;
    }
  }
}

export default PrinterService;