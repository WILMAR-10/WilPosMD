// src/services/PrintService.ts
import { PreviewSale } from '../types/sales';

export interface PrinterInfo {
  name: string;
  isDefault?: boolean;
  isThermal?: boolean;
  status?: 'available' | 'offline' | 'error';
}

export interface PrintOptions {
  printerName?: string;
  copies?: number;
  cutPaper?: boolean;
  openDrawer?: boolean;
}

export interface PrintResult {
  success: boolean;
  error?: string;
  jobId?: string;
}

export interface BusinessSettings {
  nombre_negocio?: string;
  direccion?: string;
  telefono?: string;
  rnc?: string;
  mensaje_recibo?: string;
  moneda?: string;
  impresora_termica?: string;
  auto_cut?: boolean;
  open_cash_drawer?: boolean;
}

/**
 * Servicio unificado de impresión - Principio de Responsabilidad Única
 * Maneja toda la lógica de impresión en un solo lugar
 */
export class PrintService {
  private static instance: PrintService;
  private settings: BusinessSettings = {};
  private availablePrinters: PrinterInfo[] = [];

  private constructor() {}

  static getInstance(): PrintService {
    if (!PrintService.instance) {
      PrintService.instance = new PrintService();
    }
    return PrintService.instance;
  }

  /**
   * Inicializa el servicio con configuraciones
   */
  async initialize(settings: BusinessSettings): Promise<void> {
    this.settings = settings;
    await this.refreshPrinters();
  }

  /**
   * Obtiene lista actualizada de impresoras
   */
  async refreshPrinters(): Promise<PrinterInfo[]> {
    try {
      if (!window.api?.getPrinters) {
        console.warn('Printer API not available');
        return [];
      }

      const printers = await window.api.getPrinters();
      this.availablePrinters = printers.map(printer => ({
        name: printer.name,
        isDefault: printer.isDefault,
        isThermal: this.detectThermalPrinter(printer.name),
        status: 'available'
      }));

      return this.availablePrinters;
    } catch (error) {
      console.error('Error refreshing printers:', error);
      return [];
    }
  }

  /**
   * Detecta si una impresora es térmica basándose en el nombre
   */
  private detectThermalPrinter(printerName: string): boolean {
    const thermalKeywords = [
      'thermal', 'pos', 'receipt', 'epson tm', 'tm-',
      'star', 'bixolon', 'citizen', 'xprinter', '58mm', '80mm'
    ];
    
    const name = printerName.toLowerCase();
    return thermalKeywords.some(keyword => name.includes(keyword));
  }

  /**
   * Obtiene la impresora configurada o la predeterminada
   */
  private getTargetPrinter(options?: PrintOptions): string | null {
    if (options?.printerName) {
      return options.printerName;
    }

    if (this.settings.impresora_termica) {
      return this.settings.impresora_termica;
    }

    const defaultPrinter = this.availablePrinters.find(p => p.isDefault);
    return defaultPrinter?.name || null;
  }

  /**
   * Imprime una factura de venta
   */
  async printInvoice(sale: PreviewSale, options?: PrintOptions): Promise<PrintResult> {
    try {
      const printer = this.getTargetPrinter(options);
      if (!printer) {
        return { success: false, error: 'No hay impresora disponible' };
      }

      const escCommands = this.generateInvoiceESC(sale);
      return await this.printRaw(escCommands, printer, options);
    } catch (error) {
      console.error('Error printing invoice:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }

  /**
   * Imprime etiqueta de producto
   */
  async printLabel(productData: {
    name: string;
    price: number;
    barcode?: string;
    category?: string;
  }, quantity = 1, options?: PrintOptions): Promise<PrintResult> {
    try {
      const printer = this.getTargetPrinter(options);
      if (!printer) {
        return { success: false, error: 'No hay impresora disponible' };
      }

      const escCommands = this.generateLabelESC(productData, quantity);
      return await this.printRaw(escCommands, printer, options);
    } catch (error) {
      console.error('Error printing label:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }

  /**
   * Prueba de impresión
   */
  async testPrint(printerName?: string): Promise<PrintResult> {
    try {
      const printer = printerName || this.getTargetPrinter();
      if (!printer) {
        return { success: false, error: 'No hay impresora disponible' };
      }

      const testCommands = this.generateTestESC();
      return await this.printRaw(testCommands, printer);
    } catch (error) {
      console.error('Error in test print:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }

  /**
   * Abre el cajón de dinero
   */
  async openDrawer(printerName?: string): Promise<PrintResult> {
    try {
      const printer = printerName || this.getTargetPrinter();
      if (!printer) {
        return { success: false, error: 'No hay impresora disponible' };
      }

      // Comando ESC/POS para abrir cajón
      const drawerCommand = '\x1B\x70\x00\x32\x32';
      return await this.printRaw(drawerCommand, printer);
    } catch (error) {
      console.error('Error opening drawer:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }

  /**
   * Envía comandos ESC/POS raw a la impresora
   */
  private async printRaw(commands: string, printerName: string, options?: PrintOptions): Promise<PrintResult> {
    try {
      if (!window.api?.printRaw) {
        return { success: false, error: 'API de impresión no disponible' };
      }

      // Agregar comandos de configuración basados en opciones
      let finalCommands = '\x1B\x40' + commands; // Inicializar impresora

      // Corte de papel
      if (options?.cutPaper ?? this.settings.auto_cut ?? true) {
        finalCommands += '\x1D\x56\x00'; // Corte completo
      }

      // Abrir cajón
      if (options?.openDrawer ?? this.settings.open_cash_drawer ?? false) {
        finalCommands += '\x1B\x70\x00\x32\x32';
      }

      const result = await window.api.printRaw(finalCommands, printerName);
      return result;
    } catch (error) {
      console.error('Error in printRaw:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }

  /**
   * Genera comandos ESC/POS para factura
   */
  private generateInvoiceESC(sale: PreviewSale): string {
    const commands: string[] = [];

    // Centrar texto
    commands.push('\x1B\x61\x01');

    // Nombre del negocio (negrita)
    commands.push('\x1B\x45\x01');
    commands.push(`${this.settings.nombre_negocio || 'WilPOS'}\n`);
    commands.push('\x1B\x45\x00');

    // Información del negocio
    if (this.settings.direccion) {
      commands.push(`${this.settings.direccion}\n`);
    }
    if (this.settings.telefono) {
      commands.push(`Tel: ${this.settings.telefono}\n`);
    }
    if (this.settings.rnc) {
      commands.push(`RNC: ${this.settings.rnc}\n`);
    }

    // Línea separadora
    commands.push('================================\n');

    // Información de la factura
    commands.push(`FACTURA #${sale.id || 'N/A'}\n`);
    commands.push(`Fecha: ${new Date(sale.fecha_venta).toLocaleString()}\n`);
    commands.push(`Cliente: ${sale.cliente || 'Cliente General'}\n`);
    commands.push(`Cajero: ${sale.usuario || 'N/A'}\n`);

    // Línea separadora
    commands.push('--------------------------------\n');

    // Alinear a la izquierda para items
    commands.push('\x1B\x61\x00');

    // Encabezados de productos
    commands.push('CANT DESCRIPCION    PRECIO TOTAL\n');
    commands.push('--------------------------------\n');

    // Items
    sale.detalles.forEach(item => {
      const qty = item.quantity.toString().padEnd(4);
      const name = item.name.substring(0, 12).padEnd(12);
      const price = this.formatMoney(item.price).padStart(6);
      const total = this.formatMoney(item.subtotal).padStart(6);
      
      commands.push(`${qty}${name}${price}${total}\n`);
    });

    // Línea separadora
    commands.push('--------------------------------\n');

    // Alinear a la derecha para totales
    commands.push('\x1B\x61\x02');

    // Totales
    commands.push(`SUBTOTAL: ${this.formatMoney(sale.total - sale.impuestos)}\n`);
    if (sale.impuestos > 0) {
      commands.push(`IMPUESTOS: ${this.formatMoney(sale.impuestos)}\n`);
    }
    if (sale.descuento > 0) {
      commands.push(`DESCUENTO: ${this.formatMoney(sale.descuento)}\n`);
    }

    // Total final (negrita)
    commands.push('\x1B\x45\x01');
    commands.push(`TOTAL: ${this.formatMoney(sale.total)}\n`);
    commands.push('\x1B\x45\x00');

    // Información de pago
    commands.push(`\nMETODO: ${sale.metodo_pago}\n`);
    if (sale.metodo_pago === 'Efectivo') {
      commands.push(`RECIBIDO: ${this.formatMoney(sale.monto_recibido || 0)}\n`);
      commands.push(`CAMBIO: ${this.formatMoney(sale.cambio || 0)}\n`);
    }

    // Centrar para mensaje final
    commands.push('\x1B\x61\x01');
    commands.push('\n');
    commands.push(this.settings.mensaje_recibo || 'Gracias por su compra');
    commands.push('\n\n');

    return commands.join('');
  }

  /**
   * Genera comandos ESC/POS para etiqueta de producto
   */
  private generateLabelESC(productData: {
    name: string;
    price: number;
    barcode?: string;
    category?: string;
  }, quantity: number): string {
    const commands: string[] = [];

    for (let i = 0; i < quantity; i++) {
      // Centrar texto
      commands.push('\x1B\x61\x01');

      // Nombre del producto (negrita)
      commands.push('\x1B\x45\x01');
      commands.push(`${productData.name}\n`);
      commands.push('\x1B\x45\x00');

      // Categoría si existe
      if (productData.category) {
        commands.push(`Cat: ${productData.category}\n`);
      }

      // Precio (grande y negrita)
      commands.push('\x1B\x45\x01');
      commands.push('\x1D\x21\x01'); // Doble altura
      commands.push(`${this.formatMoney(productData.price)}\n`);
      commands.push('\x1D\x21\x00'); // Tamaño normal
      commands.push('\x1B\x45\x00');

      // Código de barras si existe
      if (productData.barcode) {
        commands.push(`COD: ${productData.barcode}\n`);
      }

      // Separador entre etiquetas
      if (i < quantity - 1) {
        commands.push('\n' + '-'.repeat(32) + '\n');
      }

      commands.push('\n');
    }

    return commands.join('');
  }

  /**
   * Genera comandos ESC/POS para prueba
   */
  private generateTestESC(): string {
    const commands: string[] = [];

    commands.push('\x1B\x61\x01'); // Centrar
    commands.push('\x1B\x45\x01'); // Negrita
    commands.push('PRUEBA DE IMPRESORA\n');
    commands.push('\x1B\x45\x00'); // Normal

    commands.push(`Fecha: ${new Date().toLocaleString()}\n`);
    commands.push(`Sistema: ${this.settings.nombre_negocio || 'WilPOS'}\n`);
    commands.push('\n');
    commands.push('Impresion exitosa!\n');
    commands.push('\n');

    return commands.join('');
  }

  /**
   * Formatea dinero para recibos térmicos
   */
  private formatMoney(amount: number): string {
    const symbol = this.settings.moneda || 'RD$';
    return `${symbol}${amount.toFixed(2)}`;
  }

  /**
   * Getters para información del servicio
   */
  getAvailablePrinters(): PrinterInfo[] {
    return [...this.availablePrinters];
  }

  getCurrentPrinter(): string | null {
    return this.settings.impresora_termica || null;
  }

  updateSettings(settings: Partial<BusinessSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }
}

// Singleton export
export const printService = PrintService.getInstance();