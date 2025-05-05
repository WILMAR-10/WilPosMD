// src/services/InvoiceManager.ts
import { PreviewSale } from '../types/sales';

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
  
  // Private constructor (singleton pattern)
  private constructor() {}
  
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
      if (!window.printerApi?.print) {
        throw new Error('Printer API not available');
      }
      
      // Get settings or use defaults
      const settings = await this.getSettings();
      
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
      
      // Send to printer API
      const result = await window.printerApi.print(printOptions);
      
      if (!result.success) {
        console.error('Print error:', result.error);
        throw new Error(result.error || 'Unknown printing error');
      }
      
      return true;
    } catch (error) {
      console.error('Print invoice error:', error);
      throw error;
    }
  }
  
  // Save invoice as PDF
  public async saveAsPdf(sale: PreviewSale, htmlContent: string, options?: SavePdfOptions): Promise<string | undefined> {
    try {
      if (!window.printerApi?.savePdf) {
        throw new Error('PDF API not available');
      }
      
      // Get default directory if not specified
      let directory = options?.directory;
      if (!directory) {
        if (!window.printerApi.getPdfPath) {
          throw new Error('getPdfPath API not available');
        }
        const pdfPath = await window.printerApi.getPdfPath();
        directory = pdfPath || undefined;
        if (!directory) {
          throw new Error('No directory specified and could not get default path');
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
      const result = await window.printerApi.savePdf(saveOptions);
      
      if (!result.success) {
        console.error('Save PDF error:', result.error);
        throw new Error(result.error || 'Unknown PDF error');
      }
      
      return result.path || fullPath;
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