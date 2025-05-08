// Improved InvoiceManager.ts
import { PreviewSale } from '../types/sales';

interface SavePdfOptions {
  directory?: string;
  filename?: string;
  overwrite?: boolean;
}

interface PrintOptions {
  silent?: boolean;
  copies?: number;
  options?: {
    paperWidth?: string;
    printSpeed?: string;
    fontSize?: string;
    [key: string]: any;
  };
}

// Enhanced InvoiceManager with WebContents-based printing and PDF generation
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
  
  // Print invoice using WebContents through IPC
  public async printInvoice(
    sale: PreviewSale, 
    htmlContent: string, 
    options?: PrintOptions
  ): Promise<boolean> {
    try {
      // Get settings for printer configuration
      const settings = await this.getSettings();
      
      // We need to send complete HTML document to print correctly
      const completeHtml = this.wrapContentWithStyles(htmlContent, settings?.tipo_impresora);
      
      // Configure print options based on printer type
      const printOpts = {
        silent: options?.silent !== false,
        printBackground: true,
        deviceName: settings?.impresora_termica,
        color: true,
        margins: {
          marginType: this.getPrinterMarginType(settings?.tipo_impresora)
        },
        landscape: false,
        copies: options?.copies || 1,
        // Scale differently based on printer type
        scaleFactor: this.getPrinterScaleFactor(settings?.tipo_impresora)
      };
      
      if (!window.api?.print) {
        console.error('Print API not available');
        return false;
      }
      
      // Use the print API through IPC
      const result = await window.api.print({
        html: completeHtml,
        printerName: settings?.impresora_termica,
        options: printOpts
      });
      
      return result.success;
    } catch (error) {
      console.error('Print invoice error:', error);
      
      // Try fallback method if available
      if (typeof window.print === 'function') {
        try {
          // Create a temporary iframe for printing
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          document.body.appendChild(iframe);
          
          if (iframe.contentDocument) {
            iframe.contentDocument.open();
            iframe.contentDocument.write(htmlContent);
            iframe.contentDocument.close();
            
            // Wait for content to load before printing
            setTimeout(() => {
              if (iframe.contentWindow) {
                iframe.contentWindow.print();
              }
              
              // Cleanup
              setTimeout(() => {
                document.body.removeChild(iframe);
              }, 1000);
            }, 500);
            
            return true;
          }
        } catch (fallbackErr) {
          console.error('Fallback printing failed:', fallbackErr);
        }
      }
      
      return false;
    }
  }
  
  // Save invoice as PDF using WebContents through IPC
  public async saveAsPdf(
    sale: PreviewSale, 
    htmlContent: string, 
    options?: SavePdfOptions
  ): Promise<string | undefined> {
    try {
      // Get default directory if not specified
      let directory = options?.directory;
      if (!directory) {
        const settings = await this.getSettings();
        directory = settings?.ruta_pdf;
        
        if (!directory) {
          // Try different methods to get a default path
          if (window.api?.getAppPaths) {
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
      
      // We need to send complete HTML document to generate PDF correctly
      const settings = await this.getSettings();
      const completeHtml = this.wrapContentWithStyles(htmlContent, settings?.tipo_impresora);
      
      if (!window.api?.savePdf) {
        throw new Error('PDF API not available');
      }
      
      // PDF options optimized for invoice
      const pdfOptions = {
        printBackground: true,
        landscape: false,
        pageSize: 'A4',
        margins: {
          top: 0.4,
          bottom: 0.4,
          left: 0.4,
          right: 0.4
        },
        scale: 1.0
      };
      
      // Use savePdf API through IPC
      const result = await window.api.savePdf({
        path: `${directory}/${filename}`,
        html: completeHtml,
        options: pdfOptions
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown PDF error');
      }
      
      return result.path || `${directory}/${filename}`;
    } catch (error) {
      console.error('Save PDF error:', error);
      throw error;
    }
  }
  
  // Helper method to determine printer margin type based on printer type
  private getPrinterMarginType(printerType?: string): string {
    if (printerType === 'termica58') {
      return 'none'; // Minimize margins for narrow receipts
    } else if (printerType === 'termica') {
      return 'printableArea'; // Use printable area for standard thermal
    } else {
      return 'default'; // Default margins for regular printers
    }
  }
  
  // Helper method to determine printer scale factor based on printer type
  private getPrinterScaleFactor(printerType?: string): number {
    switch (printerType) {
      case 'termica58':
        return 0.65; // Narrower paper needs more scaling
      case 'termica':
        return 0.8;  // Standard thermal paper
      default:
        return 1.0;  // Normal paper
    }
  }
  
  // Helper to wrap HTML content with proper styles for printing
  private wrapContentWithStyles(content: string, printerType?: string): string {
    // Base CSS for all printer types
    let printerStyles = '';
    
    // Apply different styles based on printer type
    if (printerType === 'termica58') {
      printerStyles = `
        @page { 
          size: 58mm auto; 
          margin: 2mm;
        }
        body {
          width: 54mm;
          font-size: 9pt;
          font-family: 'Arial', sans-serif;
          line-height: 1.2;
        }
        table { width: 100%; }
        th, td { padding: 2px; font-size: 8pt; }
      `;
    } else if (printerType === 'termica') {
      printerStyles = `
        @page { 
          size: 80mm auto; 
          margin: 3mm;
        }
        body {
          width: 74mm;
          font-size: 10pt;
          font-family: 'Arial', sans-serif;
          line-height: 1.3;
        }
        table { width: 100%; }
        th, td { padding: 3px; font-size: 9pt; }
      `;
    } else {
      printerStyles = `
        @page { 
          size: A4; 
          margin: 10mm;
        }
        body {
          font-family: 'Arial', sans-serif;
        }
      `;
    }
    
    // Create complete HTML document
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura</title>
          <style>
            ${printerStyles}
            /* Ensure page breaks don't occur in the middle of important sections */
            .page-break-avoid {
              page-break-inside: avoid;
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `;
  }
  
  // Enhanced settings retrieval with better caching
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

export default InvoiceManager;