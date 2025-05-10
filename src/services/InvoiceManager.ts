// src/services/InvoiceManager.ts
import { PreviewSale } from '../types/sales';
import ThermalPrintService from './ThermalPrintService';
import { PrintInvoiceOptions, SavePdfOptions } from '../types/printer';

/**
 * Manages invoice generation, printing, and PDF creation
 * Handles both thermal and standard printing methods
 */
export default class InvoiceManager {
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
  
  /**
   * Print invoice with enhanced error handling and fallback options
   * @param sale The sale data to print
   * @param htmlContent HTML representation of the invoice
   * @param options Printing options
   * @returns Success status
   */
  public async printInvoice(sale: PreviewSale, htmlContent: string, options?: PrintInvoiceOptions): Promise<boolean> {
    try {
      // Get settings or use defaults
      const settings = await this.getSettings();
      
      // Determine if we should use a thermal printer
      const useThermal = !!settings?.impresora_termica;
      
      // For thermal printing (ESC/POS)
      if (useThermal && settings?.impresora_termica) {
        const printerStatus = await this.thermalPrintService.checkPrinterStatus(settings.impresora_termica);
        
        if (printerStatus.available) {
          // Prepare receipt data from sale
          const receiptData = this.thermalPrintService.prepareReceiptData(sale, settings);
          
          // Print using thermal service
          const result = await this.thermalPrintService.printReceipt(
            receiptData,
            settings.impresora_termica
          );
          
          if (result.success) {
            return true;
          }
          
          // Log failure but continue to fallback
          console.warn('Thermal printing failed, falling back to standard printing:', result.error);
        }
      }
      
      // For regular HTML printing as fallback
      return await this.printHtml(htmlContent, options, settings);
    } catch (error) {
      console.error('Print invoice error:', error);
      
      // Try fallback printing as last resort
      try {
        if (typeof window.print === 'function') {
          window.print();
          return true;
        }
      } catch (fallbackError) {
        console.error('Fallback printing failed:', fallbackError);
      }
      
      throw error;
    }
  }
  
  /**
   * Enhanced HTML printing with better error handling
   * @param htmlContent HTML to print
   * @param options Print options
   * @param settings App settings
   * @returns Success status
   */
  private async printHtml(htmlContent: string, options?: PrintInvoiceOptions, settings?: any): Promise<boolean> {
    try {
      // Use window.printerApi.print if available
      if (window.printerApi?.print) {
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
        
        const result = await window.printerApi.print(printOptions);
        if (!result.success) {
          throw new Error(result.error || 'Unknown printing error');
        }
        return true;
      }
      
      // If API print not available, try window.print()
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
          
          // Wait for content to load before printing
          await new Promise(resolve => setTimeout(resolve, 500));
          
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
      console.error('HTML print error:', error);
      throw error;
    }
  }
  
  /**
   * Save invoice as PDF with enhanced error handling
   * @param sale Sale data for the invoice
   * @param htmlContent HTML representation of the invoice
   * @param options Save options
   * @returns Path to the saved PDF
   */
  public async saveAsPdf(sale: PreviewSale, htmlContent: string, options?: {
    directory?: string;
    filename?: string;
    overwrite?: boolean;
  }): Promise<string | undefined> {
    try {
      // Check if PDF API is available
      const hasPdfApi = !!(window.printerApi?.savePdf || window.api?.savePdf);
      
      if (!hasPdfApi) {
        throw new Error('PDF API not available');
      }
      
      // Get default directory if not specified
      let directory = options?.directory;
      if (!directory) {
        const settings = await this.getSettings();
        directory = settings?.ruta_pdf;
        
        if (!directory) {
          // Try different methods to get a default path
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
      
      // Generate unique filename if not provided
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = options?.filename || 
        `factura-${sale.id || 'nueva'}-${timestamp}.pdf`;
      
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
      
      // Save to PDF using available API
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
  
  /**
   * Enhanced settings retrieval with caching
   */
  private settingsCache: any = null;
  private settingsCacheTime: number = 0;
  private settingsCacheExpiration: number = 30000; // 30 seconds
  
  private async getSettings(): Promise<any> {
    try {
      const now = Date.now();
      
      // Return cached settings if valid
      if (this.settingsCache && (now - this.settingsCacheTime) < this.settingsCacheExpiration) {
        return this.settingsCache;
      }
      
      if (window.api?.getSettings) {
        const settings = await window.api.getSettings();
        
        // Update cache
        this.settingsCache = settings;
        this.settingsCacheTime = now;
        
        return settings;
      }
      
      return null;
    } catch (error) {
      console.error('Error loading settings:', error);
      
      // Return cache even if expired on error
      if (this.settingsCache) {
        return this.settingsCache;
      }
      
      return null;
    }
  }
}