// src/services/ReceiptLineService.ts
import { PreviewSale, CartItem } from '../types/sales';
import { PrintResult, PrinterStatus, Printer } from '../types/printer';

/**
 * Servicio para impresión de recibos usando ReceiptLine
 * Esta clase maneja la integración con la librería ReceiptLine para
 * generar comandos de impresión para impresoras térmicas y de etiquetas
 */
export default class ReceiptLineService {
  private static instance: ReceiptLineService;
  public activePrinter?: string;
  public activeLabelPrinter?: string;
  private printerCache: Printer[] = [];
  private lastCacheTime: number = 0;
  private cacheExpiration: number = 60000; // 1 minuto de caché

  private constructor() {
    // Cargar impresoras configuradas desde configuración
    this.loadConfiguredPrinters();
  }

  /**
   * Obtener instancia singleton
   */
  public static getInstance(): ReceiptLineService {
    if (!ReceiptLineService.instance) {
      ReceiptLineService.instance = new ReceiptLineService();
    }
    return ReceiptLineService.instance;
  }

  /**
   * Cargar configuración de impresoras
   * @private
   */
  private async loadConfiguredPrinters(): Promise<void> {
    try {
      if (window.api?.getSettings) {
        const settings = await window.api.getSettings();
        this.activePrinter = settings?.impresora_termica;
        this.activeLabelPrinter = settings?.impresora_etiquetas;
        
        console.log('Impresoras configuradas cargadas:', {
          receipt: this.activePrinter,
          label: this.activeLabelPrinter
        });
      }
    } catch (error) {
      console.error('Error al cargar configuración de impresoras:', error);
    }
  }

  /**
   * Establecer impresora activa para recibos
   * @param printerName Nombre de la impresora
   */
  public setReceiptPrinter(printerName?: string): void {
    this.activePrinter = printerName;
    console.log('Impresora de recibos establecida:', printerName);
  }

  /**
   * Establecer impresora activa para etiquetas
   * @param printerName Nombre de la impresora
   */
  public setLabelPrinter(printerName?: string): void {
    this.activeLabelPrinter = printerName;
    console.log('Impresora de etiquetas establecida:', printerName);
  }

  /**
   * Obtener todas las impresoras disponibles en el sistema
   * @param forceRefresh Forzar actualización de caché
   */
  public async getAvailablePrinters(forceRefresh = false): Promise<Printer[]> {
    try {
      // Usar caché si está disponible y no ha expirado
      const now = Date.now();
      if (!forceRefresh && 
          this.printerCache.length > 0 && 
          (now - this.lastCacheTime) < this.cacheExpiration) {
        return this.printerCache;
      }

      // Verificar si API está disponible
      if (!window.printerApi?.getPrinters && !window.api?.getPrinters) {
        console.warn('API de impresoras no disponible');
        return [];
      }

      // Obtener impresoras
      let printers: Printer[] = [];
      
      if (window.printerApi?.getPrinters) {
        const response = await window.printerApi.getPrinters();
        if (response.success && Array.isArray(response.printers)) {
          printers = response.printers;
        } else {
          throw new Error(response.error || 'Error al obtener impresoras');
        }
      } else if (window.api?.getPrinters) {
        printers = await window.api.getPrinters();
      }

      // Detectar impresoras térmicas
      printers = printers.map(printer => ({
        ...printer,
        isThermal: printer.isThermal || this.isThermalPrinter(printer.name)
      }));

      // Actualizar caché
      this.printerCache = printers;
      this.lastCacheTime = now;

      return printers;
    } catch (error) {
      console.error('Error al obtener impresoras:', error);
      // Devolver caché en caso de error
      return this.printerCache.length > 0 ? this.printerCache : [];
    }
  }

  /**
   * Verifica si es probable que sea una impresora térmica basado en su nombre
   * @private
   * @param name Nombre de la impresora
   */
  private isThermalPrinter(name?: string): boolean {
    if (!name) return false;
    
    const thermalKeywords = [
      'thermal', 'térmica', 'termica', 'pos', 'receipt', 'recibo', 'ticket',
      'epson tm', 'tm-', 'tm20', 'tm80', 'tm82', 'tm90', 'tm-t',
      'star', 'bixolon', 'citizen', 'xprinter', 'pos58', 
      'pos80', 'posprinter', '58mm', '80mm', 'usb receipt',
      'label', 'etiqueta', 'zebra', 'dymo', 'brother'
    ];
    
    const lower = name.toLowerCase();
    return thermalKeywords.some(k => lower.includes(k));
  }

  /**
   * Verificar si una impresora está disponible
   * @param printerName Nombre de la impresora
   */
  public async checkPrinterStatus(printerName?: string): Promise<PrinterStatus> {
    try {
      const targetPrinter = printerName || this.activePrinter;
      
      if (!targetPrinter) {
        return {
          available: false,
          message: 'No hay impresora configurada'
        };
      }
      
      // Obtener lista de impresoras disponibles
      const printers = await this.getAvailablePrinters(true);
      
      // Verificar si la impresora configurada existe
      const printer = printers.find(p => p.name === targetPrinter);
      
      if (!printer) {
        return {
          available: false,
          printerName: targetPrinter,
          message: 'Impresora configurada no disponible'
        };
      }
      
      // Verificar si es térmica
      const isThermal = printer.isThermal || this.isThermalPrinter(printer.name);
      
      return {
        available: true,
        printerName: targetPrinter,
        message: isThermal ? 'Impresora térmica disponible' : 'Impresora estándar disponible'
      };
    } catch (error) {
      console.error('Error verificando estado de impresora:', error);
      return {
        available: false,
        message: 'Error verificando estado de impresora'
      };
    }
  }

  /**
   * Imprimir recibo utilizando ReceiptLine
   * @param sale Datos de la venta
   * @param settings Configuración
   * @param printerName Nombre de la impresora (opcional)
   */
  public async printReceipt(
    sale: PreviewSale,
    settings: any,
    printerName?: string
  ): Promise<PrintResult> {
    try {
      const targetPrinter = printerName || this.activePrinter;
      
      if (!targetPrinter) {
        return {
          success: false,
          error: 'No hay impresora configurada'
        };
      }
      
      // Crear documento ReceiptLine a partir de los datos de venta
      const receiptDoc = this.createReceiptDocument(sale, settings);
      
      // Tipo de impresora
      const printerType = settings?.tipo_impresora || 'normal';
      
      // Opciones de impresión
      const printOptions = {
        printerName: targetPrinter,
        copies: 1,
        silent: true,
        options: {
          paperWidth: printerType === 'termica58' ? '58mm' : '80mm',
          thermalPrinter: true,
          // Opciones adicionales de ReceiptLine
          cpl: printerType === 'termica58' ? 32 : 42, // Caracteres por línea
          encoding: 'multilingual',
          spacing: true,
          cutting: settings?.auto_cut !== false,
          gamma: 1.8,
          command: 'escpos'
        }
      };
      
      // Imprimir a través de la API
      if (window.printerApi?.print) {
        const result = await window.printerApi.print({
          content: [{ type: 'receiptline', value: receiptDoc, style: '' }],
          ...printOptions
        } as any);
        
        // Abrir cajón si está configurado
        if (result.success && settings?.open_cash_drawer) {
          await this.openCashDrawer(targetPrinter);
        }
        
        return result;
      } else if (window.api?.print) {
        const result = await window.api.print({
          html: `<pre>${receiptDoc}</pre>`,
          printerName: targetPrinter,
          options: printOptions.options
        });
        
        if (result.success && settings?.open_cash_drawer) {
          await this.openCashDrawer(targetPrinter);
        }
        
        return result;
      }
      
      return {
        success: false,
        error: 'API de impresión no disponible'
      };
    } catch (error) {
      console.error('Error imprimiendo recibo:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Crear documento ReceiptLine a partir de datos de venta
   * @private
   * @param sale Datos de la venta
   * @param settings Configuración
   */
  private createReceiptDocument(sale: PreviewSale, settings: any): string {
    // Extraer información del negocio
    const businessName = settings?.nombre_negocio || 'WilPOS';
    const address = settings?.direccion || '';
    const phone = settings?.telefono || '';
    const rnc = settings?.rnc || '';
    const footer = settings?.mensaje_recibo || 'Gracias por su compra';
    
    // Formatear fecha
    const date = new Date(sale.fecha_venta).toLocaleString();
    
    // Construir documento ReceiptLine
    let doc = `
^${businessName}
${address ? address + '\\n' : ''}
${phone ? 'Tel: ' + phone + '\\n' : ''}
${rnc ? 'RNC: ' + rnc + '\\n' : ''}
------------------------------
^FACTURA #${sale.id || ''}
Fecha: ${date}
Cliente: ${sale.cliente || 'Cliente General'}
Atendido por: ${sale.usuario || ''}
------------------------------
CANT | DESCRIPCION | PRECIO | TOTAL
`;

    // Detalles de la venta
    sale.detalles.forEach(item => {
      doc += `${item.quantity} | ${item.name} | ${this.formatMoney(item.price)} | ${this.formatMoney(item.subtotal)}\n`;
    });

    doc += `
------------------------------
^Subtotal: ${this.formatMoney(sale.total - sale.impuestos)}
^ITBIS: ${this.formatMoney(sale.impuestos)}
${sale.descuento > 0 ? '^Descuento: ' + this.formatMoney(sale.descuento) + '\\n' : ''}
^TOTAL: ${this.formatMoney(sale.total)}
^Método de pago: ${sale.metodo_pago}
`;

    // Si es pago en efectivo, mostrar cambio
    if (sale.metodo_pago === 'Efectivo' && typeof sale.monto_recibido === 'number') {
      doc += `
^Recibido: ${this.formatMoney(sale.monto_recibido)}
^Cambio: ${this.formatMoney(sale.cambio)}
`;
    }

    // Mensaje de pie
    doc += `
^${footer}
=
`;

    return doc;
  }

  /**
   * Imprimir etiqueta utilizando ReceiptLine
   * @param labelData Datos de la etiqueta
   * @param printerName Nombre de la impresora (opcional)
   */
  public async printLabel(
    labelData: { 
      productName: string; 
      barcode?: string; 
      price: number;
      quantity?: number;
    },
    printerName?: string
  ): Promise<PrintResult> {
    try {
      const targetPrinter = printerName || this.activeLabelPrinter;
      
      if (!targetPrinter) {
        return {
          success: false,
          error: 'No hay impresora de etiquetas configurada'
        };
      }
      
      // Crear documento ReceiptLine para etiqueta
      const labelDoc = this.createLabelDocument(labelData);
      
      // Opciones de impresión para etiquetas
      const printOptions = {
        printerName: targetPrinter,
        copies: labelData.quantity || 1,
        silent: true,
        options: {
          paperWidth: '58mm',
          thermalPrinter: true,
          cpl: 32, // Etiquetas suelen ser más estrechas
          encoding: 'multilingual',
          spacing: false,
          cutting: true,
          margin: 0,
          command: 'escpos'
        }
      };
      
      // Imprimir a través de la API
      if (window.printerApi?.print) {
        return await window.printerApi.print({
          content: [{ type: 'receiptline', value: labelDoc, style: '' }],
          ...printOptions
        } as any);
      } else if (window.api?.print) {
        return await window.api.print({
          html: `<pre>${labelDoc}</pre>`,
          printerName: targetPrinter,
          options: printOptions.options
        });
      }
      
      return {
        success: false,
        error: 'API de impresión no disponible'
      };
    } catch (error) {
      console.error('Error imprimiendo etiqueta:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Crear documento ReceiptLine para etiqueta
   * @private
   * @param labelData Datos de la etiqueta
   */
  private createLabelDocument(labelData: { 
    productName: string; 
    barcode?: string; 
    price: number;
  }): string {
    let doc = `
^${labelData.productName}
`;

    if (labelData.barcode) {
      doc += `
{code:${labelData.barcode};option:ean,hri}
`;
    }

    doc += `
^Precio: ${this.formatMoney(labelData.price)}
=
`;

    return doc;
  }

  /**
   * Probar impresora
   * @param printerName Nombre de la impresora
   * @param mode Modo de prueba: 'receipt' o 'label'
   */
  public async testPrinter(
    printerName: string,
    mode: 'receipt' | 'label' = 'receipt'
  ): Promise<PrintResult> {
    try {
      if (!printerName) {
        return {
          success: false,
          error: 'No se especificó nombre de impresora'
        };
      }
      
      // Crear documento de prueba según el modo
      const testDoc = mode === 'receipt' 
        ? this.createTestReceiptDocument(printerName)
        : this.createTestLabelDocument(printerName);
      
      // Opciones de impresión
      const printOptions = {
        printerName,
        copies: 1,
        silent: true,
        options: {
          paperWidth: mode === 'receipt' ? '80mm' : '58mm',
          thermalPrinter: true,
          cpl: mode === 'receipt' ? 42 : 32,
          encoding: 'multilingual',
          spacing: mode === 'receipt',
          cutting: true,
          command: 'escpos'
        }
      };
      
      // Imprimir a través de la API
      if (window.printerApi?.print) {
        return await window.printerApi.print({
          content: [{ type: 'receiptline', value: testDoc, style: '' }],
          ...printOptions
        } as any);
      } else if (window.api?.print) {
        return await window.api.print({
          html: `<pre>${testDoc}</pre>`,
          printerName,
          options: printOptions.options
        });
      }
      
      return {
        success: false,
        error: 'API de impresión no disponible'
      };
    } catch (error) {
      console.error('Error en prueba de impresora:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Crear documento de prueba para recibos
   * @private
   * @param printerName Nombre de la impresora
   */
  private createTestReceiptDocument(printerName: string): string {
    return `
^WilPOS - PRUEBA DE IMPRESORA
------------------------------
Tipo: Impresora de Recibos
Nombre: ${printerName}
Fecha: ${new Date().toLocaleString()}

"Esta es una prueba de impresión"
_de la impresora de recibos_
-------------------------------
\`INVERTIDO\`
^DOBLE ANCHO
^^DOBLE ALTO
^^^2X TAMAÑO
^^^^3X TAMAÑO

{code:1234567890128;option:ean,hri}

^Prueba completada correctamente
=
`;
  }

  /**
   * Crear documento de prueba para etiquetas
   * @private
   * @param printerName Nombre de la impresora
   */
  private createTestLabelDocument(printerName: string): string {
    return `
^PRUEBA DE ETIQUETA
^${printerName}

{code:1234567890128;option:ean,hri}

^Producto de prueba
^Precio: RD$99.99
=
`;
  }

  /**
   * Abrir cajón de dinero
   * @param printerName Nombre de la impresora
   */
  public async openCashDrawer(printerName?: string): Promise<PrintResult> {
    try {
      const targetPrinter = printerName || this.activePrinter;
      
      if (!targetPrinter) {
        return {
          success: false,
          error: 'No hay impresora configurada'
        };
      }
      
      // Usar diferentes comandos de apertura para mayor compatibilidad
      const drawerCommands = '\x1B\x70\x00\x19\x19\x1B\x70\x00\x32\x32\x1B\x07';
      
      if (window.printerApi?.printRaw) {
        return await window.printerApi.printRaw(drawerCommands, targetPrinter);
      } else if (window.api?.printRaw) {
        return await window.api.printRaw(drawerCommands, targetPrinter);
      }
      
      return {
        success: false,
        error: 'API de impresión raw no disponible'
      };
    } catch (error) {
      console.error('Error abriendo cajón:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Formatear moneda
   * @private
   * @param amount Monto
   */
  private formatMoney(amount: number): string {
    if (typeof amount !== 'number') {
      amount = 0;
    }
    return amount.toFixed(2);
  }
}