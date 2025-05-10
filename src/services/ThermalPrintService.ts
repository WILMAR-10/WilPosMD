// src/services/ThermalPrintService.ts
import { PreviewSale, CartItem } from '../types/sales';
import { PrintResult, PrinterStatus } from '../types/printer';

/**
 * Singleton service for handling thermal printer operations
 * Supports direct ESC/POS commands and has fallback mechanisms
 */
export default class ThermalPrintService {
  private static instance: ThermalPrintService;
  public activePrinter?: string;
  private printerCache: any[] = [];
  private lastCacheTime: number = 0;
  private cacheExpiration: number = 60000; // 1 minute cache

  private constructor() {
    // Load active printer from settings or localStorage
    this.loadActivePrinter();
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
   * Load active printer from settings
   */
  private async loadActivePrinter() {
    try {
      // Try to load from settings via API
      if (window.api?.getSettings) {
        const settings = await window.api.getSettings();
        if (settings?.impresora_termica) {
          this.activePrinter = settings.impresora_termica;
          return;
        }
      }
      
      // Fallback to localStorage
      const localPrinter = localStorage.getItem('activeThermalPrinter');
      if (localPrinter) {
        this.activePrinter = localPrinter;
      }
    } catch (error) {
      console.error('Failed to load active printer:', error);
    }
  }

  /**
   * Set the active printer
   */
  public setActivePrinter(printerName?: string): void {
    this.activePrinter = printerName;

    if (printerName) {
      try {
        localStorage.setItem('activeThermalPrinter', printerName);
      } catch (e) {
        console.error('Could not save printer to localStorage:', e);
      }
    } else {
      try {
        localStorage.removeItem('activeThermalPrinter');
      } catch (e) {
        console.error('Could not remove printer from localStorage:', e);
      }
    }
  }

  /**
   * Get all available printers in the system
   */
  public async getAvailablePrinters(forceRefresh = false): Promise<any[]> {
    try {
      // Use cached printers if available and not expired
      const now = Date.now();
      if (!forceRefresh &&
        this.printerCache.length > 0 &&
        (now - this.lastCacheTime) < this.cacheExpiration) {
        return this.printerCache;
      }

      // Check if printer API is available
      if (!window.printerApi?.getPrinters && !window.api?.getPrinters) {
        console.warn('Printer API not available');
        return [];
      }

      // Try primary API first, then fallback
      let printers: any[] = [];
      const api = window.printerApi || window.api;

      if (!api) {
        throw new Error('No printer API available');
      }

      const response = await api.getPrinters();

      // Handle different response formats
      if (Array.isArray(response)) {
        printers = response;
      } else if (response && typeof response === 'object' && 'success' in response) {
        if (response.success && Array.isArray(response.printers)) {
          printers = response.printers;
        } else {
          console.error('Error getting printers:', response.error);
          return this.printerCache; // Return cached data on error
        }
      }

      // Detect thermal printers
      printers = printers.map(printer => ({
        ...printer,
        isThermal: Boolean(
          printer.isThermal ||
          this.isThermalPrinter(printer.name) ||
          (printer.portName && this.isThermalPrinter(printer.portName))
        )
      }));

      // Update cache
      this.printerCache = printers;
      this.lastCacheTime = now;

      return printers;
    } catch (error) {
      console.error('Error fetching printers:', error);
      // Return cached data on error if available
      return this.printerCache.length > 0 ? this.printerCache : [];
    }
  }

  /**
   * Detect if a printer is likely a thermal printer based on its name
   */
  private isThermalPrinter(text?: string): boolean {
    if (!text) return false;
    const thermalKeywords = [
      'thermal', 'thermal printer', 'pos', 'receipt', 'ticket',
      'epson tm', 'tm-', 'tm20', 'tm80', 'tm82', 'tm90', 'tm-t',
      'star', 'bixolon', 'citizen', 'xprinter', 'pos58',
      'pos80', 'posprinter', '58mm', '80mm', 'usb receipt'
    ];
    const lower = text.toLowerCase();
    return thermalKeywords.some(k => lower.includes(k));
  }

  /**
   * Check if printing capabilities are available
   */
  public hasPrintingCapabilities(): boolean {
    return !!(window.printerApi?.printRaw || window.api?.printRaw);
  }

  /**
   * Send raw ESC/POS commands to the printer
   */
  public async printRaw(
    data: string | Uint8Array,
    printerName?: string
  ): Promise<PrintResult> {
    try {
      if (!this.hasPrintingCapabilities()) {
        console.warn('Printing capabilities not available');
        return {
          success: false,
          error: 'Printer API not available - printing capabilities not found'
        };
      }

      // Determine target printer
      let targetPrinter = printerName || this.activePrinter;
      if (!targetPrinter) {
        const printers = await this.getAvailablePrinters();
        targetPrinter = printers.find(p => p.isDefault)?.name;
        if (!targetPrinter) {
          return {
            success: false,
            error: 'No printer specified and no default printer found'
          };
        }
      }

      // Ensure data is Uint8Array or string based on API requirements
      let printData: Uint8Array | string = 
        typeof data === 'string'
          ? data
          : data;

      // Route through whichever API is available
      if (window.printerApi?.printRaw) {
        return await window.printerApi.printRaw(printData, targetPrinter);
      } else if (window.api?.printRaw) {
        // Convert Uint8Array to string if needed for window.api
        if (printData instanceof Uint8Array) {
          const decoder = new TextDecoder();
          printData = decoder.decode(printData);
        }
        return await window.api.printRaw(printData, targetPrinter);
      } else {
        throw new Error('No compatible printing API found');
      }
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
      const testCommands = [
        '\x1B\x40',                        // Initialize printer
        '\x1B\x61\x01',                    // Center align
        'WilPOS TEST PAGE\n\n',            // Title
        `Printer: ${targetPrinter}\n`,     // Printer name
        `Date: ${new Date().toLocaleString()}\n\n\n`, // Current date
        '\x1D\x56\x00'                     // Cut paper
      ].join('');

      return await this.printRaw(testCommands, targetPrinter);
    } catch (error) {
      console.error('Error in testPrinter:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Print a receipt with formatted ESC/POS commands
   */
  public async printReceipt(
    receiptData: {
      businessName: string;
      address?: string;
      phone?: string;
      taxId?: string;
      receiptNumber: string | number;
      date: string;
      customer?: string;
      cashier?: string;
      items: Array<{
        name: string;
        quantity: number;
        price: number;
        subtotal: number;
      }>;
      subtotal: number;
      tax: number;
      discount?: number;
      total: number;
      paymentMethod: string;
      amountPaid?: number;
      change?: number;
      footer?: string;
    },
    printerName?: string
  ): Promise<PrintResult> {
    try {
      const targetPrinter = printerName || this.activePrinter;

      if (!targetPrinter) {
        return {
          success: false,
          error: 'No printer specified'
        };
      }

      // Get printer settings to adjust formatting
      let settings = {
        paperWidth: 40, // Default character width
        cutPaper: true,
        openCashDrawer: false
      };

      try {
        if (window.api?.getSettings) {
          const appSettings = await window.api.getSettings();

          // Adjust settings based on printer type
          if (appSettings.tipo_impresora === 'termica58') {
            settings.paperWidth = 32; // Narrower paper
          } else if (appSettings.tipo_impresora === 'termica') {
            settings.paperWidth = 42; // Standard thermal width
          }

          settings.cutPaper = appSettings.auto_cut !== false;
          settings.openCashDrawer = !!appSettings.open_cash_drawer;
        }
      } catch (settingsError) {
        console.warn('Error loading printer settings:', settingsError);
      }

      // Create ESC/POS commands array
      const commands = [];

      // Initialize printer
      commands.push('\x1B\x40'); // ESC @

      // Center align for header
      commands.push('\x1B\x61\x01'); // ESC a 1

      // Business name in bold/emphasized
      commands.push('\x1B\x45\x01'); // ESC E 1
      commands.push(`${receiptData.businessName}\n`);
      commands.push('\x1B\x45\x00'); // ESC E 0

      // Address and contact info
      if (receiptData.address) {
        commands.push(`${receiptData.address}\n`);
      }

      if (receiptData.phone) {
        commands.push(`Tel: ${receiptData.phone}\n`);
      }

      if (receiptData.taxId) {
        commands.push(`RNC: ${receiptData.taxId}\n`);
      }

      // Divider
      commands.push(`${'='.repeat(settings.paperWidth)}\n`);

      // Receipt info
      commands.push(`FACTURA #${receiptData.receiptNumber}\n`);
      commands.push(`Fecha: ${receiptData.date}\n`);

      if (receiptData.customer) {
        commands.push(`Cliente: ${receiptData.customer}\n`);
      }

      if (receiptData.cashier) {
        commands.push(`Cajero: ${receiptData.cashier}\n`);
      }

      // Divider
      commands.push(`${'-'.repeat(settings.paperWidth)}\n`);

      // Left align for items
      commands.push('\x1B\x61\x00'); // ESC a 0

      // Column headers - adapt width based on paper size
      const itemWidth = Math.floor(settings.paperWidth * 0.5);
      const qtyWidth = 4;
      const priceWidth = 8;
      const totalWidth = 8;

      commands.push('CANT  DESCRIPCION' + ' '.repeat(itemWidth - 14) + ' PRECIO  TOTAL\n');
      commands.push(`${'-'.repeat(settings.paperWidth)}\n`);

      // Items
      for (const item of receiptData.items) {
        const quantity = item.quantity.toString().padEnd(qtyWidth);
        const name = item.name.substring(0, itemWidth - 2).padEnd(itemWidth);
        const price = this.formatMoney(item.price).padStart(priceWidth);
        const subtotal = this.formatMoney(item.subtotal).padStart(totalWidth);

        commands.push(`${quantity}${name}${price} ${subtotal}\n`);
      }

      // Divider
      commands.push(`${'-'.repeat(settings.paperWidth)}\n`);

      // Right align for totals
      commands.push('\x1B\x61\x02'); // ESC a 2

      // Subtotal
      commands.push(`SUBTOTAL: ${this.formatMoney(receiptData.subtotal)}\n`);

      // Tax
      commands.push(`IMPUESTOS: ${this.formatMoney(receiptData.tax)}\n`);

      // Discount if any
      if (receiptData.discount && receiptData.discount > 0) {
        commands.push(`DESCUENTO: ${this.formatMoney(receiptData.discount)}\n`);
      }

      // Total (emphasized)
      commands.push('\x1B\x45\x01'); // ESC E 1
      commands.push(`TOTAL: ${this.formatMoney(receiptData.total)}\n`);
      commands.push('\x1B\x45\x00'); // ESC E 0

      // Payment info
      commands.push(`METODO DE PAGO: ${receiptData.paymentMethod}\n`);

      if (receiptData.paymentMethod === 'Efectivo' && typeof receiptData.amountPaid === 'number') {
        commands.push(`RECIBIDO: ${this.formatMoney(receiptData.amountPaid)}\n`);
        if (typeof receiptData.change === 'number') {
          commands.push(`CAMBIO: ${this.formatMoney(receiptData.change)}\n`);
        }
      }

      // Center align for footer
      commands.push('\x1B\x61\x01'); // ESC a 1

      // Thank you message
      commands.push('\n');
      commands.push(`${receiptData.footer || 'Gracias por su compra'}\n\n`);

      // Cut paper if enabled
      if (settings.cutPaper) {
        commands.push('\x1D\x56\x00'); // GS V 0
      }

      // Open cash drawer if enabled
      if (settings.openCashDrawer) {
        commands.push('\x1B\x70\x00\x32\x32'); // ESC p 0 50 50
      }

      // Join all commands and send to printer
      const commandString = commands.join('');
      return await this.printRaw(commandString, targetPrinter);
    } catch (error) {
      console.error('Error printing receipt:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Format a PreviewSale for receipt printing
   */
  public prepareReceiptData(sale: PreviewSale, settings: any) {
    // Extract business info from settings
    const businessName = settings?.nombre_negocio || 'WilPOS';
    const address = settings?.direccion;
    const phone = settings?.telefono;
    const taxId = settings?.rnc;
    
    // Format date
    const date = new Date(sale.fecha_venta).toLocaleString();
    
    // Prepare items
    const items = sale.detalles.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal
    }));
    
    // Prepare receipt data
    return {
      businessName,
      address,
      phone,
      taxId,
      receiptNumber: sale.id || 'N/A',
      date,
      customer: sale.cliente || 'Cliente General',
      cashier: sale.usuario || 'N/A',
      items,
      subtotal: sale.total - sale.impuestos,
      tax: sale.impuestos,
      discount: sale.descuento,
      total: sale.total,
      paymentMethod: sale.metodo_pago,
      amountPaid: sale.monto_recibido,
      change: sale.cambio,
      footer: settings?.mensaje_recibo || 'Gracias por su compra'
    };
  }

  /**
   * Open the cash drawer with enhanced error handling
   */
  public async openCashDrawer(printerName?: string): Promise<PrintResult> {
    try {
      const targetPrinter = printerName || this.activePrinter;

      if (!targetPrinter) {
        return {
          success: false,
          error: 'No printer specified'
        };
      }

      // Try different drawer kick commands for better compatibility
      const drawerCommands = [
        '\x1B\x70\x00\x19\x19',  // ESC p 0 25 25 - Standard
        '\x1B\x70\x00\x32\x32',  // ESC p 0 50 50 - Longer pulse
        '\x1B\x07'                // ESC BEL - Some Epson printers
      ].join('');

      return await this.printRaw(drawerCommands, targetPrinter);
    } catch (error) {
      console.error('Error opening cash drawer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Format money for thermal receipt
   */
  private formatMoney(amount: number): string {
    if (typeof amount !== 'number') {
      amount = 0;
    }
    return amount.toFixed(2);
  }

  /**
   * Check printer status
   */
  public async checkPrinterStatus(printerName?: string): Promise<PrinterStatus> {
    try {
      const targetPrinter = printerName || this.activePrinter;

      if (!targetPrinter) {
        return {
          available: false,
          message: 'No printer configured'
        };
      }

      // Get list of available printers
      const printers = await this.getAvailablePrinters(true);

      // Check if configured printer exists
      const printer = printers.find(p => p.name === targetPrinter);

      if (!printer) {
        return {
          available: false,
          printerName: targetPrinter,
          message: 'Configured printer not available'
        };
      }

      // Additional check for specific printer types
      const isThermal = printer.isThermal || this.isThermalPrinter(printer.name) || (printer.portName && this.isThermalPrinter(printer.portName));

      return {
        available: true,
        printerName: targetPrinter,
        message: isThermal ? 'Thermal printer available' : 'Standard printer available'
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