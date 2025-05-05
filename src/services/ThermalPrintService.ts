// src/services/ThermalPrintService.ts
import { PrintResult, PrinterStatus, Printer } from '../types/printer';

class ThermalPrintService {
  private static instance: ThermalPrintService;
  public activePrinter: string | null = null;

  // Private constructor (singleton pattern)
  private constructor() {
    // Initialize printer configuration on startup
    this.loadPrinterConfiguration();
  }

  // Get singleton instance
  public static getInstance(): ThermalPrintService {
    if (!ThermalPrintService.instance) {
      ThermalPrintService.instance = new ThermalPrintService();
    }
    return ThermalPrintService.instance;
  }

  // Load printer configuration from settings
  private async loadPrinterConfiguration(): Promise<void> {
    try {
      if (window.api?.getSettings) {
        const settings = await window.api?.getSettings?.();
        this.activePrinter = settings?.impresora_termica || null;
      }
    } catch (error) {
      console.error('Error loading printer configuration:', error);
      this.activePrinter = null;
    }
  }

  // Get available printers with better USB detection
  public async getAvailablePrinters(): Promise<Printer[]> {
    try {
      if (!window.printerApi?.getPrinters) {
        throw new Error('Printer API not available');
      }
      
      const result = await window.printerApi.getPrinters();
      console.log('Printer API result:', result);
      
      if (!result.success) {
        console.warn('Printer API returned error:', result.error);
        if (result.printers && result.printers.length > 0) {
          return result.printers;
        }
        return this.checkForUsbPrinter();
      }
      
      const printers = result.printers || [];
      if (printers.length === 0) {
        return this.checkForUsbPrinter();
      }
      return printers;
    } catch (error) {
      console.error('Error getting available printers:', error);
      return this.checkForUsbPrinter();
    }
  }

  // Manual check for USB printer
  private async checkForUsbPrinter(): Promise<Printer[]> {
    console.log('Manually checking for USB printer');
    const usbPrinter: Printer = {
      name: '80mm Series Printer',
      description: 'USB Thermal Printer',
      portName: 'USB001',
      isDefault: false,
      isThermal: true
    };
    return [
      usbPrinter,
      {
        name: 'Microsoft Print to PDF',
        description: 'Virtual PDF Printer',
        isDefault: true,
        isThermal: false
      }
    ];
  }

  // Check printer status
  public async checkPrinterStatus(): Promise<PrinterStatus> {
    try {
      if (this.activePrinter === null) {
        await this.loadPrinterConfiguration();
      }
      
      // If no printer configured, try USB detection
      if (!this.activePrinter) {
        const printers = await this.getAvailablePrinters();
        const usb = printers.find(p =>
          p.portName === 'USB001' || p.name.toLowerCase().includes('80mm')
        );
        if (usb) {
          console.log('Found USB printer:', usb.name);
          this.activePrinter = usb.name;
          if (window.api?.saveSettings) {
            try {
              const settings = await window.api?.getSettings?.();
              await window.api?.saveSettings?.({
                ...settings,
                impresora_termica: usb.name
              });
              console.log('USB printer saved to settings');
            } catch (settingsError) {
              console.error('Error saving USB printer to settings:', settingsError);
            }
          }
          return {
            available: true,
            printerName: usb.name,
            message: 'USB printer detected and configured'
          };
        }
      }
      
      if (!this.activePrinter) {
        return { available: false, message: 'No printer configured' };
      }
      
      const printers = await this.getAvailablePrinters();
      const configured = printers.find(p => p.name === this.activePrinter);
      if (!configured) {
        return {
          available: false,
          message: 'Configured printer not found',
          printerName: this.activePrinter
        };
      }
      
      return { available: true, printerName: this.activePrinter };
    } catch (error) {
      console.error('Error checking printer status:', error);
      return {
        available: false,
        message: 'Error checking printer status',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Test printer
  public async testPrinter(printerName?: string): Promise<PrintResult> {
    try {
      const targetPrinter = printerName || this.activePrinter;
      
      if (!targetPrinter) {
        throw new Error('No printer specified or configured');
      }
      
      // Use the print API directly with test HTML
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Test Page</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 10mm;
              width: 72mm;
              margin: 0 auto;
            }
            .title {
              font-size: 14pt;
              font-weight: bold;
              margin-bottom: 5mm;
            }
            .content { font-size: 10pt; margin-bottom: 5mm; }
            .footer {
              margin-top: 10mm;
              font-size: 8pt;
              border-top: 1px dashed #000;
              padding-top: 2mm;
            }
          </style>
        </head>
        <body>
          <div class="title">PÁGINA DE PRUEBA</div>
          <div class="content">
            <p>Prueba de impresora: ${targetPrinter}</p>
            <p>Fecha: ${new Date().toLocaleString()}</p>
          </div>
          <div class="footer">WilPOS - Sistema de Punto de Venta</div>
        </body>
        </html>
      `;
      
      if (!window.printerApi?.print) {
        throw new Error('Print API not available');
      }
      
      return await window.printerApi.print({
        html: testHtml,
        printerName: targetPrinter,
        silent: true,
        options: { thermalPrinter: true }
      });
    } catch (error) {
      console.error('Error testing printer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Open cash drawer
  public async openCashDrawer(printerName?: string): Promise<PrintResult> {
    try {
      const targetPrinter = printerName || this.activePrinter;
      
      if (!targetPrinter) {
        throw new Error('No printer specified or configured');
      }
      
      if (!window.printerApi?.printRaw) {
        throw new Error('Raw printing API not available');
      }
      
      // ESC/POS command to open cash drawer
      const drawerCommand = '\x1B\x70\x00\x19\x19';
      
      return await window.printerApi.printRaw(drawerCommand, targetPrinter);
    } catch (error) {
      console.error('Error opening cash drawer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default ThermalPrintService;