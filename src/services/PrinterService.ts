// src/services/PrinterService.ts
/**
 * A unified service for all printer-related functionality
 */
export class PrinterService {
  private static instance: PrinterService;

  private constructor() {
    console.log("PrinterService initialized");
  }

  public static getInstance(): PrinterService {
    if (!PrinterService.instance) {
      PrinterService.instance = new PrinterService();
    }
    return PrinterService.instance;
  }

  /**
   * Gets all available printers
   */
  async getPrinters(): Promise<{ success: boolean; printers: any[]; error?: string }> {
    try {
      if (window.printerApi?.getPrinters) {
        console.log("Fetching printers via printerApi.getPrinters");
        const result = await window.printerApi.getPrinters();
        
        // Enhanced logging to debug printer detection
        console.log("Raw printer result:", JSON.stringify(result));
        
        if (result && Array.isArray(result.printers)) {
          // Make sure thermal printers are properly identified
          const enhancedPrinters = result.printers.map(p => ({
            ...p,
            // Ensure isThermal is properly set using extended patterns
            isThermal: p.isThermal || /thermal|receipt|pos|58mm|80mm|tm-|epson/i.test(p.name.toLowerCase())
          }));
          
          return { 
            success: true, 
            printers: enhancedPrinters
          };
        }
        
        console.warn("Printer API returned invalid result");
        return { success: true, printers: [] };
      }
      
      console.warn("No printerApi.getPrinters available, using fallback");
      // Fallback common printers
      const commonPrinters = [
        { name: "Microsoft Print to PDF", isDefault: true, isThermal: false },
        { name: "EPSON TM-T88V", isDefault: false, isThermal: true },
        { name: "POS-80", isDefault: false, isThermal: true },
        { name: "Generic / Text Only", isDefault: false, isThermal: false },
      ];
      
      return { success: true, printers: commonPrinters };
    } catch (error) {
      console.error("Error getting printers:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        printers: []
      };
    }
  }

  /**
   * Print content
   */
  async print(options: any): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log("PrinterService.print called with options:", options);
      
      // Check if this is a thermal printer job
      const isThermalPrinting = options.options?.thermalPrinter === true;
      
      if (isThermalPrinting) {
        console.log("Detected thermal printer job");
      }
      
      if (window.printerApi?.print) {
        console.log(`Sending print job to printer: ${options.printerName || 'Default'}`);
        const result = await window.printerApi.print(options);
        
        if (!result) {
          throw new Error("No response from print API");
        }
        
        console.log("Print result:", result);
        return result;
      }
      
      throw new Error("No printing API available");
    } catch (error) {
      console.error("Error printing:", error);
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
      throw new Error("No PDF saving API available");
    } catch (error) {
      console.error("Error saving PDF:", error);
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
    console.log(`Testing printer: ${printerName || 'Default'}`);
    
    try {
      // First, check if we have a raw printing function available
      if (window.printerApi?.printRaw) {
        console.log("Testing with raw ESC/POS commands");
        
        // Basic ESC/POS commands for a test print
        const escposCommands = 
          "\x1B@" +  // Initialize printer
          "\x1B!0" +  // Normal text
          "\x1Ba\x01" +  // Center alignment
          "THERMAL PRINTER TEST\n\n" +
          "If you can read this, ESC/POS is working!\n\n" +
          `Date: ${new Date().toLocaleString()}\n\n` +
          "\x1Ba\x00" +  // Left alignment
          "Printer: " + (printerName || "Default") + "\n\n" +
          "\x1Ba\x01" +  // Center alignment
          "WilPOS System\n\n" +
          "\x1Bd\x01" +  // Feed paper and cut
          "\x1B@";  // Reset printer
        
        try {
          const rawResult = await window.printerApi.printRaw(escposCommands, printerName);
          console.log("Raw printing result:", rawResult);
          
          if (rawResult.success) {
            return { 
              success: true, 
              message: "Test page sent to printer using ESC/POS commands" 
            };
          }
          
          console.warn("Raw printing failed, falling back to HTML printing");
        } catch (rawError) {
          console.error("Error with raw printing:", rawError);
          // Continue to HTML method if raw printing fails
        }
      }
      
      // Fallback to HTML printing if raw printing fails or isn't available
      console.log("Testing with HTML printing method");
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Printer Test</title>
          <style>
            body { 
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 10mm;
              max-width: ${printerName?.toLowerCase().includes('58mm') ? '58mm' : '80mm'};
              margin: 0 auto;
            }
            .title {
              font-size: 14pt;
              font-weight: bold;
              margin-bottom: 5mm;
            }
            .content {
              font-size: 10pt;
              margin-bottom: 5mm;
            }
            .footer {
              margin-top: 10mm;
              font-size: 8pt;
              border-top: 1px dashed #000;
              padding-top: 2mm;
            }
          </style>
        </head>
        <body>
          <div class="title">PRINTER TEST PAGE</div>
          <div class="content">
            <p>This is a test page to verify if your printer is working correctly.</p>
            <p>Printer: ${printerName || 'Default'}</p>
            <p>Date: ${new Date().toLocaleString()}</p>
          </div>
          <div class="footer">WilPOS - Point of Sale System</div>
        </body>
        </html>`;
      
      const options = {
        html,
        printerName,
        silent: true,
        options: { 
          thermalPrinter: true,
          width: printerName?.toLowerCase().includes('58mm') ? '58mm' : '80mm'
        }
      };
      
      const result = await this.print(options);
      return result;
    } catch (error) {
      console.error("Error testing printer:", error);
      return {
        success: false,
        message: `Error testing printer: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * Print raw ESC/POS commands directly to the printer
   */
  async printRaw(commands: string, printerName?: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`Sending raw commands to printer: ${printerName || 'Default'}`);
      
      if (window.printerApi?.printRaw) {
        const result = await window.printerApi.printRaw(commands, printerName);
        return result;
      }
      
      throw new Error("Raw printing API not available");
    } catch (error) {
      console.error("Error with raw printing:", error);
      return {
        success: false,
        message: `Raw printing failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

export default PrinterService;