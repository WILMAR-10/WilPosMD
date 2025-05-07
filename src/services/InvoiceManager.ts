// src/services/InvoiceManager.ts
import { PreviewSale } from '../types/sales';
import ThermalPrintService from './ThermalPrintService';

interface SavePdfOptions {
  directory?: string;
  filename?: string;
  overwrite?: boolean;
}

interface PrintOptions {
  printerName?: string;
  silent?: boolean;
  copies?: number;
  options?: {
    paperWidth?: string;
    printSpeed?: string;
    fontSize?: string;
    [key: string]: any;
  };
}

// Singleton service to manage invoices
class InvoiceManager {
  private static instance: InvoiceManager;
  private thermalPrintService: ThermalPrintService;
  
  // Private constructor (singleton pattern)
  private constructor() {
    this.thermalPrintService = ThermalPrintService.getInstance();
  }
  
  // Get singleton instance
  public static getInstance(): InvoiceManager {
    if (!InvoiceManager.instance) {
      InvoiceManager.instance = new InvoiceManager();
    }
    return InvoiceManager.instance;
  }
  
  // Print invoice
  public async printInvoice(sale: PreviewSale, htmlContent: string, options?: PrintOptions): Promise<boolean> {
    try {
      // Get settings or use defaults
      const settings = await this.getSettings();
      
      // Determine if we should use a thermal printer
      const useThermal = !!settings?.impresora_termica;
      
      // For thermal printing (ESC/POS)
      if (useThermal && settings?.impresora_termica) {
        return await this.printThermal(sale, settings.impresora_termica);
      }
      
      // For regular HTML printing
      if (!window.printerApi?.print) {
        throw new Error('Print API not available');
      }
      
      // Prepare print options with defaults
      const printOptions = {
        html: htmlContent,
        printerName: options?.printerName || settings?.impresora_termica,
        silent: options?.silent !== false,
        copies: options?.copies || 1,
        options: {
          paperWidth: options?.options?.paperWidth || 
            (settings?.tipo_impresora === 'termica58' ? '58mm' : '80mm'),
          printSpeed: options?.options?.printSpeed || 'normal',
          fontSize: options?.options?.fontSize || 'normal',
          thermalPrinter: true,
          ...options?.options
        }
      };
      
      // Using printerApi.print if available
      if (window.printerApi?.print) {
        const result = await window.printerApi.print(printOptions);
        if (!result.success) {
          throw new Error(result.error || 'Unknown printing error');
        }
        return true;
      }
      
      // If window.print() is available, use it as fallback
      if (typeof window.print === 'function') {
        // Create a hidden iframe for printing
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        // Set content and print
        if (iframe.contentDocument) {
          iframe.contentDocument.open();
          iframe.contentDocument.write(htmlContent);
          iframe.contentDocument.close();
          
          if (iframe.contentWindow) {
            iframe.contentWindow.print();
          }
        }
        
        // Cleanup after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
        
        return true;
      }
      
      throw new Error('No printing method available');
    } catch (error) {
      console.error('Print invoice error:', error);
      throw error;
    }
  }
  
  // Print using thermal printer with ESC/POS commands
  private async printThermal(sale: PreviewSale, printerName: string): Promise<boolean> {
    try {
      // Create a simplified ESC/POS receipt
      let commands = '';
      
      // Initialize printer
      commands += '\x1B\x40'; // ESC @
      
      // Center align
      commands += '\x1B\x61\x01'; // ESC a 1
      
      // Get settings
      const settings = await this.getSettings();
      
      // Business name (emphasized)
      commands += '\x1B\x45\x01'; // ESC E 1 (emphasized)
      commands += `${settings?.nombre_negocio || 'WilPOS'}\n`;
      commands += '\x1B\x45\x00'; // ESC E 0 (cancel emphasized)
      
      // Address and contact info
      if (settings?.direccion) {
        commands += `${settings.direccion}\n`;
      }
      if (settings?.telefono) {
        commands += `Tel: ${settings.telefono}\n`;
      }
      if (settings?.rnc) {
        commands += `RNC: ${settings.rnc}\n`;
      }
      
      // Divider
      commands += '\x1B\x61\x01'; // Center align
      commands += '-'.repeat(32) + '\n';
      
      // Invoice info
      commands += `FACTURA #${sale.id || 'N/A'}\n`;
      commands += `Fecha: ${new Date(sale.fecha_venta).toLocaleString()}\n`;
      commands += `Cliente: ${sale.cliente || 'Cliente General'}\n`;
      commands += `Vendedor: ${sale.usuario || 'N/A'}\n`;
      
      // Divider
      commands += '-'.repeat(32) + '\n';
      
      // Left align for items
      commands += '\x1B\x61\x00'; // ESC a 0
      
      // Header for items
      commands += 'CANT  DESCRIPCION           PRECIO  TOTAL\n';
      
      // Divider
      commands += '-'.repeat(32) + '\n';
      
      // Items
      for (const item of sale.detalles) {
        const quantity = item.quantity.toString().padEnd(5);
        const name = item.name.substring(0, 20).padEnd(20);
        const price = this.formatMoney(item.price).padStart(7);
        const subtotal = this.formatMoney(item.subtotal).padStart(7);
        
        commands += `${quantity}${name}${price} ${subtotal}\n`;
      }
      
      // Divider
      commands += '-'.repeat(32) + '\n';
      
      // Right align for totals
      commands += '\x1B\x61\x02'; // ESC a 2
      
      // Subtotal
      commands += `SUBTOTAL: ${this.formatMoney(sale.total - sale.impuestos)}\n`;
      
      // Tax
      commands += `ITBIS: ${this.formatMoney(sale.impuestos)}\n`;
      
      // Discount if any
      if (sale.descuento > 0) {
        commands += `DESCUENTO: ${this.formatMoney(sale.descuento)}\n`;
      }
      
      // Total (emphasized)
      commands += '\x1B\x45\x01'; // ESC E 1 (emphasized)
      commands += `TOTAL: ${this.formatMoney(sale.total)}\n`;
      commands += '\x1B\x45\x00'; // ESC E 0 (cancel emphasized)
      
      // Payment info
      commands += `METODO DE PAGO: ${sale.metodo_pago}\n`;
      
      if (sale.metodo_pago === 'Efectivo') {
        commands += `RECIBIDO: ${this.formatMoney(sale.monto_recibido)}\n`;
        commands += `CAMBIO: ${this.formatMoney(sale.cambio)}\n`;
      }
      
      // Center align for footer
      commands += '\x1B\x61\x01'; // ESC a 1
      
      // Thank you message
      commands += '\n';
      commands += `${settings?.mensaje_recibo || 'Gracias por su compra'}\n\n`;
      
      // Cut paper
      commands += '\x1D\x56\x00'; // GS V 0
      
      // Cash drawer if enabled
      if (settings?.open_cash_drawer) {
        commands += '\x1B\x70\x00\x32\x32'; // ESC p 0 50 50
      }
      
      // Print the receipt
      const result = await this.thermalPrintService.printRaw(commands, printerName);
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown printing error');
      }
      
      return true;
    } catch (error) {
      console.error('Print thermal error:', error);
      throw error;
    }
  }
  
  // Format money for thermal receipt
  private formatMoney(amount: number): string {
    return amount.toFixed(2);
  }
  
  // Save invoice as PDF
  public async saveAsPdf(sale: PreviewSale, htmlContent: string, options?: SavePdfOptions): Promise<string | undefined> {
    try {
      if (!window.printerApi?.savePdf && !window.api?.savePdf) {
        throw new Error('PDF API not available');
      }
      
      // Get default directory if not specified
      let directory = options?.directory;
      if (!directory) {
        const settings = await this.getSettings();
        directory = settings?.ruta_pdf;
        
        if (!directory) {
          if (window.printerApi?.getPdfPath) {
            const pdfPath = await window.printerApi.getPdfPath();
            directory = pdfPath || undefined;
          } else if (window.api?.getAppPaths) {
            const paths = await window.api.getAppPaths();
            directory = `${paths.userData}/facturas`;
          }
        }
        
        if (!directory) {
          throw new Error('No directory specified and could not get default path');
        }
        
        // Ensure directory exists
        if (window.api?.ensureDir) {
          await window.api.ensureDir(directory);
        }
      }
      
      // Generate filename if not provided
      const filename = options?.filename || 
        `factura-${sale.id}-${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Create full path
      const fullPath = `${directory}/${filename}`;
      
      // Prepare save options
      const saveOptions = {
        path: fullPath,
        html: htmlContent,
        options: {
          printBackground: true,
          margins: {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
          }
        }
      };
      
      // Save to PDF
      const savePdfFn = window.printerApi?.savePdf || window.api?.savePdf;
      if (savePdfFn) {
        const result = await savePdfFn(saveOptions);
        
        if (!result.success) {
          throw new Error(result.error || 'Unknown PDF error');
        }
        
        return result.path || fullPath;
      }
      
      throw new Error('PDF saving function not available');
    } catch (error) {
      console.error('Save PDF error:', error);
      throw error;
    }
  }
  
  // Get printer settings
  private async getSettings(): Promise<any> {
    try {
      if (window.api?.getSettings) {
        return await window.api.getSettings();
      }
      return null;
    } catch (error) {
      console.error('Error loading settings:', error);
      return null;
    }
  }
}

export default InvoiceManager;