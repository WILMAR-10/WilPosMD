// src/services/ThermalPrintService.ts - Fixed version
import { PreviewSale } from '../types/sales';
import { PrintInvoiceOptions } from '../types/printer';

// Define types for thermal printer paper size
export enum ThermalPaperSize {
  PAPER_80MM = '80mm',
  PAPER_58MM = '58mm'
}

// Improved printer connection interface
export interface ThermalPrinterOptions {
  printerName?: string;
  paperSize?: ThermalPaperSize;
  timeout?: number;
}

// Character set fallbacks
const CHARACTER_SETS = {
  PC437_USA: 'pc437_usa',
  PC850_MULTILINGUAL: 'pc850_multilingual',
  PC858_EURO: 'pc858_euro',
  PC860_PORTUGUESE: 'pc860_portuguese',
  PC863_CANADIAN_FRENCH: 'pc863_canadian_french',
  PC865_NORDIC: 'pc865_nordic',
  PC866_CYRILLIC: 'pc866_cyrillic',
  KATAKANA: 'katakana'
};

/**
 * Service for handling thermal printer operations
 * with improved error handling and fallbacks
 */
export class ThermalPrintService {
  private static instance: ThermalPrintService;
  private printerName: string | undefined = undefined;
  private paperSize: ThermalPaperSize = ThermalPaperSize.PAPER_80MM;
  
  // Private constructor for singleton pattern
  private constructor() {
    // Load settings when instantiated
    this.loadSettings();
  }
  
  // Get singleton instance
  public static getInstance(): ThermalPrintService {
    if (!ThermalPrintService.instance) {
      ThermalPrintService.instance = new ThermalPrintService();
    }
    return ThermalPrintService.instance;
  }
  
  /**
   * Load printer settings from application configuration
   */
  private async loadSettings(): Promise<void> {
    try {
      if (window.api?.getSettings) {
        const settings = await window.api.getSettings();
        
        if (settings) {
          // Changed from null to undefined for TypeScript compatibility
          this.printerName = settings.impresora_termica || undefined;
          
          // Set paper size based on configuration
          if (settings.tipo_impresora === 'termica58') {
            this.paperSize = ThermalPaperSize.PAPER_58MM;
          } else {
            this.paperSize = ThermalPaperSize.PAPER_80MM;
          }
          
          console.log("Thermal printer settings loaded:", {
            printerName: this.printerName,
            paperSize: this.paperSize
          });
        }
      }
    } catch (error) {
      console.error('Error loading thermal printer settings:', error);
    }
  }
  
  /**
   * Check if thermal printer is available
   * @returns Object with status and printer name
   */
  public async checkPrinterStatus(): Promise<{ available: boolean; printerName?: string; message?: string }> {
    try {
      // Try to get available printers
      let printers: any[] = [];
      
      // First try with electronPrinting if available
      if (window.electronPrinting?.getPrinters) {
        try {
          printers = await window.electronPrinting.getPrinters();
        } catch (error) {
          console.warn('Error getting printers with electronPrinting:', error);
        }
      }
      
      // If no printers found yet, try with window.api
      if (printers.length === 0 && window.api?.getPrinters) {
        try {
          printers = await window.api.getPrinters();
        } catch (error) {
          console.warn('Error getting printers with window.api:', error);
        }
      }
      
      // Check if we have a configured printer
      if (this.printerName) {
        const configuredPrinter = printers.find(p => p.name === this.printerName);
        
        if (configuredPrinter) {
          return { 
            available: true, 
            printerName: this.printerName,
            message: `Configured printer "${this.printerName}" is available`
          };
        }
        
        // If configured printer is not available, suggest alternatives
        const thermalPrinters = printers.filter(p => {
          const name = p.name.toLowerCase();
          return name.includes('thermal') || 
                 name.includes('receipt') || 
                 name.includes('pos') || 
                 name.includes('80mm') || 
                 name.includes('58mm');
        });
        
        if (thermalPrinters.length > 0) {
          return {
            available: false,
            message: `Configured printer "${this.printerName}" not found. Available thermal printers: ${thermalPrinters.map(p => p.name).join(', ')}`
          };
        }
        
        return {
          available: false,
          message: `Configured printer "${this.printerName}" not found. No thermal printers detected.`
        };
      }
      
      // If no printer configured, try to find a thermal printer
      const thermalPrinters = printers.filter(p => {
        const name = p.name.toLowerCase();
        return name.includes('thermal') || 
               name.includes('receipt') || 
               name.includes('pos') || 
               name.includes('80mm') || 
               name.includes('58mm');
      });
      
      if (thermalPrinters.length > 0) {
        // Use the first thermal printer found
        const printer = thermalPrinters[0];
        this.printerName = printer.name;
        
        return { 
          available: true, 
          printerName: printer.name,
          message: `Automatically selected thermal printer: "${printer.name}"`
        };
      }
      
      // If no thermal printers found, check if there's any printer
      if (printers.length > 0) {
        return {
          available: false,
          message: `No thermal printers detected. Available printers: ${printers.map(p => p.name).join(', ')}`
        };
      }
      
      return {
        available: false,
        message: 'No printers detected'
      };
    } catch (error) {
      console.error('Error checking printer status:', error);
      return {
        available: false,
        message: `Error checking printer status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Get all available printers
   * @returns List of available printers with thermal indicator
   */
  public async getAllPrinters(): Promise<{ 
    printers: Array<{ 
      name: string; 
      description?: string; 
      isDefault?: boolean; 
      isThermal?: boolean 
    }> 
  }> {
    try {
      let printers: any[] = [];
      
      // Try electronPrinting first if available
      if (window.electronPrinting?.getPrinters) {
        try {
          printers = await window.electronPrinting.getPrinters();
          console.log("Got printers via electronPrinting:", printers);
        } catch (error) {
          console.warn('Error getting printers with electronPrinting:', error);
        }
      }
      
      // If no printers found yet, try with window.api
      if (printers.length === 0 && window.api?.getPrinters) {
        try {
          printers = await window.api.getPrinters();
          console.log("Got printers via window.api:", printers);
        } catch (error) {
          console.warn('Error getting printers with window.api:', error);
        }
      }
      
      // Detect which printers are likely thermal
      const formattedPrinters = printers.map(p => {
        const name = p.name.toLowerCase();
        const isThermal = name.includes('thermal') || 
                         name.includes('receipt') || 
                         name.includes('pos') || 
                         name.includes('80mm') || 
                         name.includes('58mm');
        
        return {
          name: p.name,
          description: p.description,
          isDefault: p.isDefault,
          isThermal
        };
      });
      
      return { printers: formattedPrinters };
    } catch (error) {
      console.error('Error getting all printers:', error);
      return { printers: [] };
    }
  }
  
  /**
   * Format a sale object for thermal printer
   * @param sale The sale to print
   * @returns HTML content optimized for thermal printing
   */
  private generateThermalReceiptHTML(sale: PreviewSale): string {
    try {
      // Width settings based on paper size
      const contentWidth = this.paperSize === ThermalPaperSize.PAPER_58MM ? '48mm' : '72mm';
      
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
   * Print a receipt directly to the printer using the Web API
   * Instead of relying on node-thermal-printer which causes problems
   */
  public async printReceipt(sale: PreviewSale): Promise<{ success: boolean; message?: string }> {
    try {
      // Check if API is available
      if (!window.api?.printInvoice) {
        throw new Error('Print API not available');
      }
      
      // Generate HTML content
      const htmlContent = this.generateThermalReceiptHTML(sale);
      
      // Direct printing via the electron-based window.api
      console.log(`Sending print job to ${this.printerName || 'default printer'}`);
      
      // Build thermal-optimized options
      const printOptions: PrintInvoiceOptions = {
        html: htmlContent,
        printerName: this.printerName,
        silent: true,
        copies: 1,
        options: {
          // Mark as thermal printer for special handling in main process
          thermalPrinter: true,
          width: this.paperSize,
          // Simplified options to avoid undefined properties
          paperWidth: this.paperSize,
          printSpeed: this.paperSize === ThermalPaperSize.PAPER_58MM ? '58mm' : '80mm',
          fontSize: '12pt',
          scaleFactor: 100,
          printBackground: true,
          margins: { 
            marginType: 'custom',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
          }
        }
      };
      
      // Send print job using the main process API
      const result = await window.api.printInvoice(printOptions);
      
      if (result && result.success) {
        return { success: true, message: "Print job sent successfully" };
      } else {
        throw new Error(result?.error || 'Unknown printing error');
      }
    } catch (error) {
      console.error('Error printing receipt:', error);
      
      // Create fallback print options with fewer properties that could fail
      try {
        if (window.api?.printInvoice) {
          console.log("Attempting fallback print method...");
          const fallbackOptions: PrintInvoiceOptions = {
            html: this.generateThermalReceiptHTML(sale),
            printerName: this.printerName,
            silent: true
          };
          
          const fallbackResult = await window.api.printInvoice(fallbackOptions);
          if (fallbackResult && fallbackResult.success) {
            return { success: true, message: "Print job sent successfully (fallback method)" };
          }
        }
      } catch (fallbackError) {
        console.error("Fallback print method also failed:", fallbackError);
      }
      
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown printing error'
      };
    }
  }
  
  /**
   * Test the thermal printer with a simplified test page
   * @returns Result of the test print
   */
  public async testPrinter(): Promise<{ success: boolean; message: string }> {
    try {
      if (!window.api?.printInvoice) {
        throw new Error('Print API not available');
      }
      
      // Create a simple but complete test HTML without complex structures
      const testHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Test Print</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              width: ${this.paperSize === ThermalPaperSize.PAPER_58MM ? '48mm' : '72mm'};
              padding: 5mm;
              text-align: center;
            }
            .title {
              font-size: 12pt;
              font-weight: bold;
            }
            .subtitle {
              font-size: 10pt;
              margin: 5mm 0;
            }
            .test-text {
              font-size: 9pt;
              margin: 2mm 0;
              text-align: left;
            }
            .footer {
              margin-top: 5mm;
              font-size: 8pt;
              border-top: 1px dashed #000;
              padding-top: 2mm;
            }
          </style>
        </head>
        <body>
          <div class="title">WILPOS</div>
          <div class="subtitle">*** TEST DE IMPRESIÓN ***</div>
          
          <div class="test-text">
            Impresora: ${this.printerName || 'Default'}<br>
            Tamaño: ${this.paperSize}<br>
            Fecha: ${new Date().toLocaleString()}<br>
          </div>
          
          <div style="border: 1px dashed #000; margin: 3mm 0; padding: 2mm;">
            ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>
            abcdefghijklmnopqrstuvwxyz<br>
            0123456789<br>
            !@#$%^&*()-_=+[]{}|;:'\",.<>/?
          </div>
          
          <div class="footer">
            Si puede leer este texto, la impresora<br>
            está funcionando correctamente.
          </div>
        </body>
        </html>
      `;
      
      // Simplified print options to minimize possible issues
      const printOptions: PrintInvoiceOptions = {
        html: testHTML,
        printerName: this.printerName,
        silent: true,
        copies: 1,
        options: {
          thermal: true,
          width: this.paperSize
        }
      };
      
      console.log(`Sending test print to ${this.printerName || 'default printer'}`);
      
      const result = await window.api.printInvoice(printOptions);
      
      if (result && result.success) {
        return { 
          success: true, 
          message: `Test print sent successfully to ${this.printerName || 'default printer'}`
        };
      } else {
        throw new Error(result?.error || 'Unknown printing error');
      }
    } catch (error) {
      console.error('Error sending test print:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown printing error'
      };
    }
  }
}

export default ThermalPrintService;