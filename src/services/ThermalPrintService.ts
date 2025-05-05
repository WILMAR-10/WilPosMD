// src/services/ThermalPrintService.ts

import type { PreviewSale } from '../types/sales';
import { PrinterType } from '../types/printer';

// Interface for printer status
export interface PrinterStatus {
  available: boolean;
  printerName?: string;
  message?: string;
  error?: string;
}

// Interface for print result
export interface PrintResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Service for managing thermal printer integration
 * Handles printer detection, connection, and printing operations
 */
export class ThermalPrintService {
  private static instance: ThermalPrintService;
  private _activePrinter: string | null = null;
  private _paperWidth: '58mm' | '80mm' = '80mm';
  private _printerType: PrinterType = PrinterType.THERMAL_80MM;
  private _printSpeed: string = '220'; // Added property for print speed
  private _printDensity: string = 'medium'; // Added property for print density
  private _autoCut: boolean = true; // Added property for auto cut
  private _openCashDrawer: boolean = false; // Added property for cash drawer

  // Private constructor for singleton
  private constructor() {
    // Initialize from saved settings if available
    this.loadSettings();
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
   * Get active printer name
   */
  public get activePrinter(): string | null {
    return this._activePrinter;
  }

  /**
   * Set active printer name
   */
  public set activePrinter(name: string | null) {
    this._activePrinter = name;
  }

  /**
   * Get paper width
   */
  public get paperWidth(): '58mm' | '80mm' {
    return this._paperWidth;
  }

  /**
   * Set paper width
   */
  public set paperWidth(width: '58mm' | '80mm') {
    this._paperWidth = width;
    // Update printer type based on width
    this._printerType = width === '58mm' ? PrinterType.THERMAL_58MM : PrinterType.THERMAL_80MM;
  }

  /**
   * Get print speed
   */
  public get printSpeed(): string {
    return this._printSpeed;
  }

  /**
   * Set print speed
   */
  public set printSpeed(speed: string) {
    this._printSpeed = speed;
  }

  /**
   * Get print density
   */
  public get printDensity(): string {
    return this._printDensity;
  }

  /**
   * Set print density
   */
  public set printDensity(density: string) {
    this._printDensity = density;
  }

  /**
   * Get auto cut setting
   */
  public get autoCut(): boolean {
    return this._autoCut;
  }

  /**
   * Set auto cut setting
   */
  public set autoCut(value: boolean) {
    this._autoCut = value;
  }

  /**
   * Get auto open cash drawer setting
   */
  public get autoOpenCashDrawer(): boolean {
    return this._openCashDrawer;
  }

  /**
   * Set auto open cash drawer setting
   */
  public set autoOpenCashDrawer(value: boolean) {
    this._openCashDrawer = value;
  }

  /**
   * Get printer type
   */
  public get printerType(): PrinterType {
    return this._printerType;
  }

  /**
   * Load printer settings from app settings
   */
  private async loadSettings(): Promise<void> {
    try {
      if (window.api?.getSettings) {
        const settings = await window.api.getSettings();

        if (settings) {
          // Set printer from settings if available
          if (settings.impresora_termica) {
            this._activePrinter = settings.impresora_termica;
          }

          // Set printer type from settings
          if (settings.tipo_impresora) {
            if (settings.tipo_impresora === PrinterType.THERMAL_58MM) {
              this._paperWidth = '58mm';
              this._printerType = PrinterType.THERMAL_58MM;
            } else if (settings.tipo_impresora === PrinterType.THERMAL_80MM) {
              this._paperWidth = '80mm';
              this._printerType = PrinterType.THERMAL_80MM;
            }
          }

          // Set additional settings
          if (settings.print_speed) {
            this._printSpeed = settings.print_speed;
          }
          if (settings.print_density) {
            this._printDensity = settings.print_density;
          }
          if (settings.auto_cut !== undefined) {
            this._autoCut = settings.auto_cut;
          }
          if (settings.open_cash_drawer !== undefined) {
            this._openCashDrawer = settings.open_cash_drawer;
          }
        }
      }
    } catch (error) {
      console.error("Error loading printer settings:", error);
    }
  }

  /**
   * Save current printer settings
   */
  public async saveSettings(): Promise<boolean> {
    try {
      if (window.api?.getSettings && window.api?.saveSettings) {
        const currentSettings = await window.api.getSettings();

        // Update printer settings
        const updatedSettings = {
          ...currentSettings,
          impresora_termica: this._activePrinter || undefined,
          tipo_impresora: this._printerType,
          print_speed: this._printSpeed,
          print_density: this._printDensity,
          auto_cut: this._autoCut,
          open_cash_drawer: this._openCashDrawer
        };

        await window.api.saveSettings(updatedSettings);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error saving printer settings:", error);
      return false;
    }
  }

  /**
   * Check if thermal printer is available
   * Attempts to detect and connect to thermal printer
   */
  public async checkPrinterStatus(): Promise<PrinterStatus> {
    try {
      // Get list of available printers
      const printers = await this.getAvailablePrinters();

      if (!printers || printers.length === 0) {
        return {
          available: false,
          message: 'No printers detected'
        };
      }

      // Look for thermal printers first
      const thermalPrinters = printers.filter(p => p.isThermal);

      // If active printer is set, check if it exists in the list
      if (this._activePrinter) {
        const activePrinterExists = printers.some(p => p.name === this._activePrinter);
        if (activePrinterExists) {
          // Active printer found in list
          return {
            available: true,
            printerName: this._activePrinter,
            message: `Using configured printer: ${this._activePrinter}`
          };
        } else {
          // Active printer not found in list
          console.warn(`Configured printer "${this._activePrinter}" not found`);
          // Check if there are any thermal printers
          if (thermalPrinters.length > 0) {
            this._activePrinter = thermalPrinters[0].name;
            return {
              available: true,
              printerName: this._activePrinter,
              message: `Configured printer not found. Using: ${this._activePrinter}`
            };
          }
        }
      }

      // No active printer set, try to find a thermal printer
      if (thermalPrinters.length > 0) {
        this._activePrinter = thermalPrinters[0].name;
        return {
          available: true,
          printerName: this._activePrinter,
          message: `Auto-detected thermal printer: ${this._activePrinter}`
        };
      }

      // No thermal printers found, use default printer
      const defaultPrinter = printers.find(p => p.isDefault);
      if (defaultPrinter) {
        // Use default printer, but indicate it may not be thermal
        this._activePrinter = defaultPrinter.name;
        return {
          available: true,
          printerName: this._activePrinter,
          message: `No thermal printer found. Using default: ${this._activePrinter}`
        };
      }

      // No suitable printer found
      return {
        available: false,
        message: 'No suitable printer found'
      };

    } catch (error) {
      console.error("Error checking printer status:", error);
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error checking printer'
      };
    }
  }

  /**
   * Get list of available printers
   */
  public async getAvailablePrinters(): Promise<Array<{
    name: string;
    isDefault?: boolean;
    description?: string;
    isThermal?: boolean;
  }>> {
    try {
      let printers: Array<{
        name: string;
        isDefault?: boolean;
        description?: string;
        isThermal?: boolean;
      }> = [];

      // Try window.printerApi first (new API)
      if (window.printerApi?.getPrinters) {
        const result = await window.printerApi.getPrinters();
        if (result.success && result.printers) {
          printers = result.printers;
        }
      }
      // Try window.api as fallback (legacy API)
      else if (window.api?.getPrinters) {
        printers = await window.api.getPrinters();
      }

      // Add isThermal flag based on name patterns if not already present
      return printers.map(printer => ({
        ...printer,
        isThermal: printer.isThermal !== undefined ? printer.isThermal :
          /thermal|receipt|pos|58mm|80mm|epson|tm-|tmt|epson/i.test(printer.name)
      }));
    } catch (error) {
      console.error("Error getting available printers:", error);
      return [];
    }
  }

  /**
   * Print a test page to verify printer configuration
   */
  public async testPrinter(printerName?: string): Promise<PrintResult> {
    try {
      const targetPrinter = printerName || this._activePrinter;

      if (!targetPrinter) {
        throw new Error('No printer selected');
      }

      // Generate simple test receipt
      const testHtml = this.generateTestReceiptHtml();

      // Use appropriate API based on availability
      if (window.api?.testPrinter) {
        // Direct API call if available
        return await window.api.testPrinter(targetPrinter);
      } else if (window.printerApi?.print) {
        // Use print API
        const result = await window.printerApi.print({
          html: testHtml,
          printerName: targetPrinter,
          silent: true,
          options: {
            thermal: true,
            paperWidth: this._paperWidth
          }
        });

        if (result.success) {
          return { success: true, message: 'Test page sent to printer' };
        } else {
          throw new Error(result.error || 'Unknown error printing test page');
        }
      } else if (window.api?.print) {
        // Legacy API
        const result = await window.api.print({
          html: testHtml,
          printerName: targetPrinter,
          silent: true
        });

        if (result.success) {
          return { success: true, message: 'Test page sent to printer' };
        } else {
          throw new Error(result.error || 'Unknown error printing test page');
        }
      } else {
        throw new Error('No printing API available');
      }
    } catch (error) {
      console.error("Error testing printer:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error testing printer'
      };
    }
  }

  /**
   * Print a receipt for a sale
   */
  public async printReceipt(sale: PreviewSale): Promise<PrintResult> {
    try {
      // First check if printer is available
      const status = await this.checkPrinterStatus();

      if (!status.available) {
        throw new Error(`No printer available: ${status.message || 'Printer not found'}`);
      }

      // Generate receipt HTML
      const receiptHtml = this.generateReceiptHtml(sale);

      // Print using appropriate API
      if (window.printerApi?.print) {
        // New API
        const result = await window.printerApi.print({
          html: receiptHtml,
          printerName: status.printerName,
          silent: true,
          options: {
            thermal: true,
            paperWidth: this._paperWidth
          }
        });

        if (result.success) {
          return { success: true, message: 'Receipt printed successfully' };
        } else {
          throw new Error(result.error || 'Unknown error printing receipt');
        }
      } else if (window.api?.printInvoice) {
        // Legacy API
        const result = await window.api.printInvoice({
          html: receiptHtml,
          printerName: status.printerName,
          silent: true,
          options: {
            paperWidth: this._paperWidth,
            thermal: true
          }
        });

        if (result.success) {
          return { success: true, message: 'Receipt printed successfully' };
        } else {
          throw new Error(result.error || 'Unknown error printing receipt');
        }
      } else {
        throw new Error('No printing API available');
      }
    } catch (error) {
      console.error("Error printing receipt:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error printing receipt'
      };
    }
  }

  /**
   * Generate HTML for receipt
   */
  private generateReceiptHtml(sale: PreviewSale): string {
    try {
      // Get business info from settings
      let businessName = 'WilPOS';
      let address = '';
      let phone = '';
      let rnc = '';
      let thankYouMessage = 'Gracias por su compra';

      // Try to get settings if available
      if (window.api?.getSettings) {
        window.api.getSettings().then(settings => {
          if (settings) {
            businessName = settings.nombre_negocio || businessName;
            address = settings.direccion || address;
            phone = settings.telefono || phone;
            rnc = settings.rnc || rnc;
            thankYouMessage = settings.mensaje_recibo || thankYouMessage;
          }
        }).catch(err => console.error('Error loading settings:', err));
      }

      // Formatting function
      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-DO', {
          style: 'currency',
          currency: 'DOP'
        }).format(amount);
      };

      // Template varies slightly based on paper width
      const isNarrow = this._paperWidth === '58mm';
      const receiptWidth = isNarrow ? '56mm' : '76mm';
      const fontSize = isNarrow ? '8pt' : '9pt';

      // Create details rows
      const detailRows = sale.detalles.map(item => {
        return `
          <tr>
            <td>${item.quantity}</td>
            <td style="max-width: ${isNarrow ? '20mm' : '35mm'}; overflow: hidden; text-overflow: ellipsis;">
              ${item.name}
              ${item.is_exempt ? ' (E)' : ''}
            </td>
            <td style="text-align: right;">${formatCurrency(item.price)}</td>
            <td style="text-align: right;">${formatCurrency(item.subtotal)}</td>
          </tr>
        `;
      }).join('');

      // Basic receipt HTML template
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Recibo ${sale.id || 'Temporal'}</title>
          <style>
            @page {
              margin: 0;
              size: ${this._paperWidth} auto;
            }
            body {
              font-family: 'Arial', sans-serif;
              margin: 0;
              padding: 5mm;
              width: ${receiptWidth};
              font-size: ${fontSize};
              line-height: 1.2;
            }
            .header {
              text-align: center;
              margin-bottom: 3mm;
            }
            .company {
              font-size: ${isNarrow ? '10pt' : '12pt'};
              font-weight: bold;
              margin-bottom: 1mm;
            }
            .invoice-id {
              font-size: ${isNarrow ? '9pt' : '10pt'};
              font-weight: bold;
              margin-bottom: 1mm;
            }
            .section {
              margin: 3mm 0;
              padding: 2mm 0;
              border-top: 1px dashed #000;
              border-bottom: 1px dashed #000;
              text-align: center;
              font-weight: bold;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 3mm 0;
            }
            th, td {
              text-align: left;
              padding: 1mm;
              font-size: ${isNarrow ? '8pt' : '9pt'};
            }
            th {
              font-weight: bold;
            }
            .right {
              text-align: right;
            }
            .center {
              text-align: center;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin: 1mm 0;
            }
            .grand-total {
              font-weight: bold;
              font-size: ${isNarrow ? '10pt' : '12pt'};
              margin: 2mm 0;
              border-top: 1px solid #000;
              padding-top: 2mm;
            }
            .footer {
              text-align: center;
              font-size: ${isNarrow ? '8pt' : '9pt'};
              margin-top: 5mm;
              border-top: 1px dashed #000;
              padding-top: 2mm;
            }
          </style>
        </head>
        <body>
          <!-- Header Section -->
          <div class="header">
            <div class="company">${businessName}</div>
            ${address ? `<div>${address}</div>` : ''}
            ${phone ? `<div>Tel: ${phone}</div>` : ''}
            ${rnc ? `<div>RNC: ${rnc}</div>` : ''}
            <div class="invoice-id">Factura #${sale.id || 'N/A'}</div>
            <div>Fecha: ${new Date(sale.fecha_venta).toLocaleString()}</div>
            <div>Cliente: ${sale.cliente || 'Cliente General'}</div>
          </div>

          <!-- Items Section -->
          <div class="section">DETALLE DE VENTA</div>
          <table>
            <tr>
              <th>CANT</th>
              <th>DESCRIPCIÓN</th>
              <th class="right">PRECIO</th>
              <th class="right">TOTAL</th>
            </tr>
            ${detailRows}
          </table>

          <!-- Totals -->
          <div>
            <div class="total-row">
              <span>Subtotal:</span>
              <span>${formatCurrency(sale.total - sale.impuestos)}</span>
            </div>
            
            ${
              sale.impuestos > 0
                ? `
              <div class="total-row">
                <span>Impuestos:</span>
                <span>${formatCurrency(sale.impuestos)}</span>
              </div>
            `
                : ''
            }
            
            ${
              sale.descuento > 0
                ? `
              <div class="total-row">
                <span>Descuento:</span>
                <span>-${formatCurrency(sale.descuento)}</span>
              </div>
            `
                : ''
            }
            
            <div class="grand-total">
              <span>TOTAL:</span>
              <span>${formatCurrency(sale.total)}</span>
            </div>

            <!-- Payment Information -->
            ${
              sale.metodo_pago === 'Efectivo'
                ? `
              <div class="total-row">
                <span>Recibido:</span>
                <span>${formatCurrency(sale.monto_recibido)}</span>
              </div>
              <div class="total-row">
                <span>Cambio:</span>
                <span>${formatCurrency(sale.cambio)}</span>
              </div>
            `
                : `
              <div class="total-row">
                <span>Método de pago:</span>
                <span>${sale.metodo_pago}</span>
              </div>
            `
            }
          </div>

          <!-- Footer Section -->
          <div class="footer">
            <p>${thankYouMessage}</p>
            <p>WilPOS - Sistema de Punto de Venta</p>
            <p>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
          </div>
        </body>
        </html>
      `;
    } catch (error) {
      console.error("Error generating receipt HTML:", error);
      // Return simple fallback template in case of error
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Recibo Simple</title>
          <style>
            body { font-family: Arial; font-size: 10pt; }
            .header { text-align: center; margin-bottom: 10px; }
            .total { font-weight: bold; font-size: 12pt; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>WilPOS</h2>
            <p>Factura #${sale.id || 'N/A'}</p>
          </div>
          <p>Fecha: ${new Date(sale.fecha_venta).toLocaleString()}</p>
          <p>Cliente: ${sale.cliente || 'Cliente General'}</p>
          <p>Total: ${new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(sale.total)}</p>
          <p>Método de pago: ${sale.metodo_pago}</p>
          <div class="footer">
            <p>Gracias por su compra</p>
          </div>
        </body>
        </html>
      `;
    }
  }

  /**
   * Generate HTML for test receipt
   */
  private generateTestReceiptHtml(): string {
    const timestamp = new Date().toLocaleString();
    const printerInfo = this._activePrinter 
      ? `Impresora: ${this._activePrinter}` 
      : 'Impresora: Predeterminada';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Prueba de Impresión</title>
        <style>
          @page {
            margin: 0;
            size: ${this._paperWidth} auto;
          }
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 5mm;
            width: ${this._paperWidth === '58mm' ? '56mm' : '76mm'};
            font-size: ${this._paperWidth === '58mm' ? '8pt' : '9pt'};
            line-height: 1.2;
          }
          .header {
            text-align: center;
            margin-bottom: 5mm;
          }
          .title {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 2mm;
          }
          .content {
            margin: 5mm 0;
          }
          .border-section {
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 2mm 0;
            margin: 2mm 0;
            text-align: center;
          }
          .footer {
            text-align: center;
            margin-top: 5mm;
            font-size: 8pt;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">WILPOS</div>
          <div>Sistema de Punto de Venta</div>
        </div>
        
        <div class="border-section">
          PÁGINA DE PRUEBA
        </div>
        
        <div class="content">
          <p>${printerInfo}</p>
          <p>Ancho: ${this._paperWidth}</p>
          <p>Fecha: ${timestamp}</p>
        </div>
        
        <div class="border-section">
          PRUEBA DE CARACTERES
        </div>
        
        <div class="content">
          <p>ABCDEFGHIJKLMNÑOPQRSTUVWXYZ</p>
          <p>abcdefghijklmnñopqrstuvwxyz</p>
          <p>1234567890</p>
          <p>!@#$%^&*()_+-=[]{}|;':,./<>?</p>
        </div>
        
        <div class="footer">
          <p>WilPOS - Página de prueba</p>
          <p>${timestamp}</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Print raw text to printer
   * Useful for sending ESC/POS commands directly
   */
  public async printRawText(text: string, printerName?: string): Promise<PrintResult> {
    try {
      const targetPrinter = printerName || this._activePrinter;

      if (!targetPrinter) {
        throw new Error('No printer selected');
      }

      // Use appropriate API based on availability
      if (window.printerApi?.printRaw) {
        return await window.printerApi.printRaw(text, targetPrinter);
      } else if (window.api?.printRaw) {
        return await window.api.printRaw(text, targetPrinter);
      } else {
        throw new Error('Raw printing API not available');
      }
    } catch (error) {
      console.error("Error printing raw text:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error printing raw text'
      };
    }
  }

  /**
   * Send specific ESC/POS command to printer
   * @param command ESC/POS command as string
   * @param printerName Optional printer name
   */
  public async sendEscposCommand(command: string, printerName?: string): Promise<PrintResult> {
    return this.printRawText(command, printerName);
  }

  /**
   * Open cash drawer using ESC/POS command
   * Works with most ESC/POS compatible printers
   */
  public async openCashDrawer(printerName?: string): Promise<PrintResult> {
    // Standard ESC/POS command to open cash drawer
    const command = '\x1B\x70\x00\x19\x19'; // ESC p 0 25 25
    return this.sendEscposCommand(command, printerName);
  }
}

export default ThermalPrintService;