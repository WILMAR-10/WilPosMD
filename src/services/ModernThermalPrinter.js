// src/services/ModernThermalPrinter.js - Servicio moderno para impresión térmica
const { printer: ThermalPrinter, types: PrinterTypes } = require('thermal-printer');

class ModernThermalPrinter {
  constructor() {
    this.printer = null;
    this.isReady = false;
  }

  /**
   * Inicializar la impresora con configuración automática
   */
  async initialize(printerName = '80mm Series Printer') {
    try {
      console.log('🔧 Inicializando impresora térmica moderna...');

      // Configuración de la impresora térmica
      this.printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: 'printer:' + printerName,
        characterSet: 'SLOVENIA',
        removeSpecialCharacters: false,
        lineCharacter: '-',
        options: {
          timeout: 5000
        }
      });

      // Test de conexión
      const isConnected = await this.printer.isPrinterConnected();
      if (isConnected) {
        this.isReady = true;
        console.log('✅ Impresora térmica moderna inicializada correctamente');
        return { success: true, message: 'Impresora inicializada' };
      } else {
        throw new Error('No se pudo conectar con la impresora');
      }

    } catch (error) {
      console.error('❌ Error inicializando impresora moderna:', error);
      this.isReady = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Imprimir factura con formato profesional
   */
  async printInvoice(saleData) {
    if (!this.isReady || !this.printer) {
      return { success: false, error: 'Impresora no inicializada' };
    }

    try {
      console.log('🖨️ Imprimiendo factura con impresora moderna...');

      // Limpiar buffer
      this.printer.clear();

      // ENCABEZADO
      this.printer.alignCenter();
      this.printer.setTextSize(1, 1);
      this.printer.bold(true);
      this.printer.println(saleData.businessName || 'WILPOS');
      this.printer.bold(false);
      this.printer.setTextSize(0, 0);
      
      if (saleData.businessInfo) {
        this.printer.println(saleData.businessInfo);
      }
      
      this.printer.drawLine();
      this.printer.newLine();

      // INFORMACIÓN DE LA VENTA
      this.printer.alignLeft();
      this.printer.bold(true);
      this.printer.println(`FACTURA No: ${saleData.id || 'N/A'}`);
      this.printer.bold(false);
      
      const fecha = new Date(saleData.fecha_venta || Date.now()).toLocaleString('es-DO');
      this.printer.println(`Fecha: ${fecha}`);
      this.printer.println(`Cliente: ${saleData.cliente || 'Cliente General'}`);
      
      if (saleData.usuario) {
        this.printer.println(`Cajero: ${saleData.usuario}`);
      }
      
      this.printer.drawLine();

      // PRODUCTOS
      if (saleData.detalles && Array.isArray(saleData.detalles)) {
        this.printer.bold(true);
        this.printer.println('PRODUCTOS:');
        this.printer.bold(false);
        
        saleData.detalles.forEach(item => {
          const qty = (item.quantity || 1).toString().padStart(2);
          const name = (item.name || 'Producto').substring(0, 20);
          const total = this.formatMoney(item.subtotal || 0);
          
          this.printer.println(`${qty} ${name}`);
          this.printer.rightText(total);
        });
      }

      this.printer.drawLine();

      // TOTALES
      this.printer.alignRight();
      
      const subtotal = saleData.total - (saleData.impuestos || 0) + (saleData.descuento || 0);
      this.printer.println(`Subtotal: ${this.formatMoney(subtotal)}`);
      
      if (saleData.descuento > 0) {
        this.printer.println(`Descuento: -${this.formatMoney(saleData.descuento)}`);
      }
      
      if (saleData.impuestos > 0) {
        this.printer.println(`ITBIS: ${this.formatMoney(saleData.impuestos)}`);
      }
      
      this.printer.drawLine();
      
      // TOTAL DESTACADO
      this.printer.bold(true);
      this.printer.setTextSize(1, 1);
      this.printer.println(`TOTAL: ${this.formatMoney(saleData.total)}`);
      this.printer.setTextSize(0, 0);
      this.printer.bold(false);

      // MÉTODO DE PAGO
      this.printer.alignLeft();
      this.printer.println(`Pago: ${saleData.metodo_pago || 'Efectivo'}`);
      
      if (saleData.metodo_pago === 'Efectivo' && saleData.monto_recibido) {
        this.printer.println(`Recibido: ${this.formatMoney(saleData.monto_recibido)}`);
        const cambio = (saleData.monto_recibido || 0) - (saleData.total || 0);
        if (cambio > 0) {
          this.printer.println(`Cambio: ${this.formatMoney(cambio)}`);
        }
      }

      // PIE DE PÁGINA
      this.printer.newLine();
      this.printer.alignCenter();
      this.printer.drawLine();
      this.printer.println(saleData.mensaje || 'Gracias por su compra');
      this.printer.println('Vuelva pronto');
      this.printer.println(new Date().toLocaleDateString('es-DO'));
      this.printer.newLine();

      // CÓDIGO QR
      const qrData = `FACTURA:${saleData.id}|TOTAL:${saleData.total}|FECHA:${new Date().toISOString().split('T')[0]}`;
      this.printer.printQR(qrData, {
        cellSize: 3,
        correction: 'M',
        model: 2
      });

      this.printer.newLine();
      this.printer.newLine();

      // CORTE
      this.printer.cut();

      // EJECUTAR IMPRESIÓN
      await this.printer.execute();
      
      console.log('✅ Factura impresa correctamente con impresora moderna');
      return { success: true, message: 'Factura impresa correctamente' };

    } catch (error) {
      console.error('❌ Error imprimiendo factura moderna:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Probar la impresora con mensaje simple
   */
  async testPrint() {
    if (!this.isReady || !this.printer) {
      return { success: false, error: 'Impresora no inicializada' };
    }

    try {
      console.log('🧪 Probando impresora moderna...');

      this.printer.clear();
      this.printer.alignCenter();
      this.printer.setTextSize(1, 1);
      this.printer.bold(true);
      this.printer.println('PRUEBA WILPOS');
      this.printer.bold(false);
      this.printer.setTextSize(0, 0);
      
      this.printer.drawLine();
      this.printer.println('Sistema de impresion moderno');
      this.printer.println('Funcionando correctamente');
      this.printer.drawLine();
      
      this.printer.println(new Date().toLocaleString('es-DO'));
      this.printer.newLine();
      this.printer.newLine();
      
      this.printer.cut();
      await this.printer.execute();
      
      console.log('✅ Prueba de impresión moderna exitosa');
      return { success: true, message: 'Prueba exitosa' };

    } catch (error) {
      console.error('❌ Error en prueba de impresión moderna:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Abrir cajón de dinero
   */
  async openCashDrawer() {
    if (!this.isReady || !this.printer) {
      return { success: false, error: 'Impresora no inicializada' };
    }

    try {
      console.log('💰 Abriendo cajón de dinero...');
      
      this.printer.openCashDrawer();
      await this.printer.execute();
      
      console.log('✅ Cajón de dinero abierto');
      return { success: true, message: 'Cajón abierto' };

    } catch (error) {
      console.error('❌ Error abriendo cajón:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Formatear dinero
   */
  formatMoney(amount) {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2
    }).format(amount || 0);
  }

  /**
   * Obtener estado de la impresora
   */
  getStatus() {
    return {
      isReady: this.isReady,
      printerConnected: this.printer ? true : false
    };
  }

  /**
   * Desconectar impresora
   */
  disconnect() {
    if (this.printer) {
      this.printer = null;
    }
    this.isReady = false;
    console.log('🔌 Impresora moderna desconectada');
  }
}

module.exports = { ModernThermalPrinter };