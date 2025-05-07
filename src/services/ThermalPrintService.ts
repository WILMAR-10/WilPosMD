// src/services/ThermalPrintService.ts
import { Printer, PrintResult } from '../types/printer';

/**
 * Service for thermal printer integration using ESC/POS commands
 */
class ThermalPrintService {
  private static instance: ThermalPrintService;
  public activePrinter?: string;

  private constructor() {
    // Singleton pattern - load the active printer from settings if available
    this.loadActivePrinter();
  }

  private async loadActivePrinter() {
    try {
      if (window.api?.getSettings) {
        const settings = await window.api.getSettings();
        this.activePrinter = settings.impresora_termica;
      }
    } catch (error) {
      console.error('Failed to load active printer:', error);
    }
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
   * Get all available printers in the system
   */
  public async getAvailablePrinters(): Promise<Printer[]> {
    try {
      // Check if printer API is available
      if (!window.printerApi?.getPrinters) {
        console.warn('Printer API not available');
        return [];
      }

      const response = await window.printerApi.getPrinters();
      
      // Handle different response formats
      if (Array.isArray(response)) {
        return response;
      } else if (response && typeof response === 'object' && 'success' in response) {
        if (response.success && Array.isArray(response.printers)) {
          return response.printers;
        } else {
          console.error('Error getting printers:', response.error);
          return [];
        }
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching printers:', error);
      return [];
    }
  }

  /**
   * Send raw ESC/POS commands to the printer
   */
  public async printRaw(
    data: string | Uint8Array,
    printerName?: string
  ): Promise<PrintResult> {
    try {
      // Check if printer API is available
      if (!window.printerApi?.printRaw) {
        return { 
          success: false, 
          error: 'Printer API not available'
        };
      }

      // Use provided printer name or fall back to active printer
      const targetPrinter = printerName || this.activePrinter;
      
      // Convert string data to Uint8Array if needed
      let printData = data;
      if (typeof data === 'string') {
        const encoder = new TextEncoder();
        printData = encoder.encode(data);
      }
      
      // Send to printer
      return await window.printerApi.printRaw(printData, targetPrinter);
    } catch (error) {
      console.error('Error in printRaw:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test printer by sending a simple test page
   */
  public async testPrinter(printerName?: string): Promise<PrintResult> {
    try {
      const targetPrinter = printerName || this.activePrinter;
      
      if (!targetPrinter) {
        return {
          success: false,
          error: 'No printer specified'
        };
      }
      
      // Build test page with ESC/POS commands
      // ESC @ = Initialize printer
      // ESC a 1 = Center alignment
      // GS V 0 = Cut paper
      const testPage = '\x1B\x40' +               // Initialize printer
                      '\x1B\x61\x01' +           // Center align
                      'WilPOS TEST PAGE\n\n' +   // Test text
                      `Printer: ${targetPrinter}\n` +
                      `Date: ${new Date().toLocaleString()}\n\n\n` +
                      '\x1D\x56\x00';            // Cut paper
      
      return await this.printRaw(testPage, targetPrinter);
    } catch (error) {
      console.error('Error in testPrinter:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Open the cash drawer using ESC/POS commands
   */
  public async openCashDrawer(printerName?: string): Promise<PrintResult> {
    try {
      const targetPrinter = printerName || this.activePrinter;
      
      // ESC p 0 25 250 = Open cash drawer connected to pin 2
      const drawerCommand = '\x1B\x70\x00\x19\x19';
      
      return await this.printRaw(drawerCommand, targetPrinter);
    } catch (error) {
      console.error('Error in openCashDrawer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check printer status
   */
  public async checkPrinterStatus(printerName?: string): Promise<{
    available: boolean;
    printerName?: string;
    message?: string;
  }> {
    try {
      const targetPrinter = printerName || this.activePrinter;
      
      if (!targetPrinter) {
        return {
          available: false,
          message: 'No printer configured'
        };
      }
      
      // Get list of available printers
      const printers = await this.getAvailablePrinters();
      
      // Check if configured printer exists
      const printerExists = printers.some(printer => printer.name === targetPrinter);
      
      if (!printerExists) {
        return {
          available: false,
          printerName: targetPrinter,
          message: 'Configured printer not available'
        };
      }
      
      return {
        available: true,
        printerName: targetPrinter
      };
    } catch (error) {
      console.error('Error checking printer status:', error);
      return {
        available: false,
        message: 'Error checking printer status'
      };
    }
  }
}

export default ThermalPrintService;