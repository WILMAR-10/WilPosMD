// src/services/PrinterService.ts
/**
 * A unified service for all printer-related functionality
 */
export class PrinterService {
    private static instance: PrinterService;
    
    private constructor() {}
    
    public static getInstance(): PrinterService {
      if (!PrinterService.instance) {
        PrinterService.instance = new PrinterService();
      }
      return PrinterService.instance;
    }
    
    /**
     * Gets all available printers
     */
    async getPrinters(): Promise<{ printers: any[] }> {
      try {
        // Try each API in order of preference
        if (window.printerApi?.getPrinters) {
          const result = await window.printerApi.getPrinters();
          if (result.success) {
            return { printers: result.printers };
          }
        }
        
        if (window.api?.getPrinters) {
          const printers = await window.api.getPrinters();
          return { printers };
        }
        
        if (window.electronPrinting?.getPrinters) {
          const printers = await window.electronPrinting.getPrinters();
          return { printers };
        }
        
        console.warn('No printer API available');
        return { printers: [] };
      } catch (error) {
        console.error('Error getting printers:', error);
        return { printers: [] };
      }
    }
    
    /**
     * Print content
     */
    async print(options: any): Promise<{ success: boolean; message?: string; error?: string }> {
      try {
        // Try each API in order of preference
        if (window.printerApi?.print) {
          return await window.printerApi.print(options);
        }
        
        if (window.api?.printInvoice) {
          return await window.api.printInvoice(options);
        }
        
        throw new Error('No printing API available');
      } catch (error) {
        console.error('Error printing:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    
    /**
     * Save as PDF
     */
    async savePdf(options: any): Promise<{ success: boolean; path?: string; error?: string }> {
      try {
        if (window.printerApi?.savePdf) {
          return await window.printerApi.savePdf(options);
        }
        
        if (window.api?.savePdf) {
          return await window.api.savePdf(options);
        }
        
        throw new Error('No PDF saving API available');
      } catch (error) {
        console.error('Error saving PDF:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    
    /**
     * Test printer by sending a test page
     */
    async testPrinter(printerName?: string): Promise<{ success: boolean; message?: string }> {
      try {
        // Simple HTML for test page
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Printer Test</title>
            <style>
              body { font-family: Arial; text-align: center; padding: 20px; }
              .title { font-size: 18pt; font-weight: bold; margin-bottom: 10px; }
              .content { font-size: 12pt; }
              .footer { margin-top: 20px; font-size: 10pt; }
            </style>
          </head>
          <body>
            <div class="title">PRINTER TEST PAGE</div>
            <div class="content">
              <p>This is a test page to verify if your printer is working correctly.</p>
              <p>If you can read this text, your printer is working properly.</p>
              <p>Printer: ${printerName || 'Default'}</p>
              <p>Date: ${new Date().toLocaleString()}</p>
            </div>
            <div class="footer">
              WilPOS - Point of Sale System
            </div>
          </body>
          </html>
        `;
        
        // Send to printer
        const result = await this.print({
          html,
          printerName,
          silent: true,
          options: { thermalPrinter: true }
        });
        
        return result;
      } catch (error) {
        console.error('Error testing printer:', error);
        return { 
          success: false, 
          message: `Error testing printer: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  }
  
  export default PrinterService;