// src/services/ThermalPrintService.ts
import PrinterService from './PrinterService';
import { PreviewSale } from '../types/sales';

export enum ThermalPaperSize {
  PAPER_80MM = '80mm',
  PAPER_58MM = '58mm'
}

export interface PrintResult {
  success: boolean;
  message?: string;
}

export class ThermalPrintService {
  private static instance: ThermalPrintService;
  private printerName?: string;
  private paperSize: ThermalPaperSize = ThermalPaperSize.PAPER_58MM; // Por defecto 58mm para POS58
  private printerService: PrinterService;
  private usbPrinterDetected: boolean = false;
  private serialPortDetected: boolean = false;

  private constructor() {
    this.printerService = PrinterService.getInstance();
    this.loadSettings();
    console.log("ThermalPrintService inicializado");
  }

  public static getInstance(): ThermalPrintService {
    if (!ThermalPrintService.instance) {
      ThermalPrintService.instance = new ThermalPrintService();
    }
    return ThermalPrintService.instance;
  }

  private async loadSettings(): Promise<void> {
    try {
      if (window.api?.getSettings) {
        const settings = await window.api.getSettings();
        this.printerName = settings.impresora_termica || undefined;

        // Configurar tamaño de papel basado en configuración
        if (settings.tipo_impresora === 'termica58' || 
            (this.printerName && this.printerName.toLowerCase().includes('58'))) {
          this.paperSize = ThermalPaperSize.PAPER_58MM;
          console.log("Configurado tamaño de papel a 58mm según configuración o nombre");
        } else if (settings.tipo_impresora === 'termica' || 
                  settings.tipo_impresora === 'termica80' || 
                  (this.printerName && this.printerName.toLowerCase().includes('80'))) {
          this.paperSize = ThermalPaperSize.PAPER_80MM;
          console.log("Configurado tamaño de papel a 80mm según configuración o nombre");
        }
        
        console.log(`Configuración de impresora cargada – Nombre: "${this.printerName}", Tamaño: ${this.paperSize}`);
      }
    } catch (e) {
      console.error('Error cargando configuración de impresora térmica:', e);
    }
  }

  public async checkPrinterStatus(): Promise<{ available: boolean; printerName?: string; message?: string }> {
    console.log("Verificando estado de impresora...");
    try {
      const result = await this.printerService.getPrinters();
      console.log(`Encontradas ${Array.isArray(result.printers) ? result.printers.length : 0} impresoras`);

      // 1) USB o serie
      const usbOrSerial = result.printers.filter(p =>
        ['usb-windows','usb-linux','usb-macos','serial'].includes(p.source || '')
      );
      if (usbOrSerial.length > 0) {
        const dev = usbOrSerial[0];
        this.usbPrinterDetected = true;
        this.printerName = dev.name;
        // Configurar tamaño por nombre
        if (dev.name?.toLowerCase().includes('58')) {
          this.paperSize = ThermalPaperSize.PAPER_58MM;
        } else if (dev.name?.toLowerCase().includes('80')) {
          this.paperSize = ThermalPaperSize.PAPER_80MM;
        }
        return {
          available: true,
          printerName: dev.name,
          message: `Detectada impresora USB/Serie: "${dev.name}"`
        };
      }

      // 2) Impresora configurada exactamente
      if (this.printerName) {
        console.log(`Buscando impresora configurada: "${this.printerName}"`);
        const exact = result.printers.find(p => p.name === this.printerName);
        if (exact) {
          return {
            available: true,
            printerName: this.printerName,
            message: `Impresora configurada "${this.printerName}" disponible`
          };
        }
        const partial = result.printers.find(p =>
          p.name.toLowerCase().includes(this.printerName!.toLowerCase()) ||
          this.printerName!.toLowerCase().includes(p.name.toLowerCase())
        );
        if (partial) {
          return {
            available: true,
            printerName: partial.name,
            message: `Encontrada impresora similar "${partial.name}" para configurada "${this.printerName}"`
          };
        }
        return { available: false, message: `Impresora configurada "${this.printerName}" no encontrada` };
      }

      // 3) Primera térmica
      const thermal = result.printers.find(p => p.isThermal);
      if (thermal) {
        this.printerName = thermal.name;
        // Configurar tamaño por nombre
        if (thermal.name?.toLowerCase().includes('58')) {
          this.paperSize = ThermalPaperSize.PAPER_58MM;
        } else if (thermal.name?.toLowerCase().includes('80')) {
          this.paperSize = ThermalPaperSize.PAPER_80MM;
        }
        return {
          available: true,
          printerName: thermal.name,
          message: `Detectada impresora térmica "${thermal.name}"`
        };
      }

      // 4) Default
      const def = result.printers.find(p => p.isDefault);
      if (def) {
        return {
          available: true,
          printerName: def.name,
          message: `Usando impresora predeterminada "${def.name}"`
        };
      }

      return { available: false, message: 'No se detectaron impresoras' };
    } catch (e) {
      console.error('Error verificando estado de impresora:', e);
      return {
        available: false,
        message: `Error verificando impresora: ${e instanceof Error ? e.message : 'Error desconocido'}`
      };
    }
  }

  public async getAllPrinters(): Promise<{ printers: any[] }> {
    try {
      const result = await this.printerService.getPrinters();
      return Array.isArray(result.printers) ? result : { printers: [] };
    } catch (error) {
      console.error('Error obteniendo impresoras:', error);
      return { printers: [] };
    }
  }

  private generateThermalReceiptHTML(sale: PreviewSale): string {
    const contentWidth = this.paperSize === ThermalPaperSize.PAPER_58MM ? '48mm' : '72mm';
    const charWidth = this.paperSize === ThermalPaperSize.PAPER_58MM ? 32 : 42;
    
    try {
      const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat('es-DO', { 
          style: 'currency', 
          currency: 'DOP',
          minimumFractionDigits: 2 
        }).format(amount);
      };
      
      // Crear tabla para productos
      let productsTable = '';
      for (const item of sale.detalles) {
        productsTable += `
          <tr>
            <td>${item.quantity}x</td>
            <td>${item.name.substring(0, 18)}</td>
            <td align="right">${formatCurrency(item.subtotal)}</td>
          </tr>
        `;
      }
      
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura ${sale.id || ''}</title>
          <style>
            @page { margin: 0; size: ${this.paperSize} auto; }
            body {
              font-family: Arial, sans-serif;
              width: ${contentWidth};
              padding: 3mm;
              margin: 0;
              font-size: 10pt;
              text-align: center;
            }
            h1 { font-size: 12pt; margin: 0; }
            h2 { font-size: 10pt; margin: 0 0 3mm 0; }
            .header { text-align: center; margin-bottom: 5mm; }
            table { width: 100%; border-collapse: collapse; }
            table.products { margin: 3mm 0; }
            table.products th { text-align: left; border-bottom: 1px dashed #000; font-size: 9pt; }
            table.products td { text-align: left; font-size: 9pt; padding: 1mm 0; }
            .totals { margin-top: 2mm; text-align: right; }
            .total-row { display: flex; justify-content: space-between; margin: 1mm 0; }
            .grand-total { font-weight: bold; margin: 2mm 0; border-top: 1px dashed #000; padding-top: 2mm; }
            .footer { text-align: center; margin-top: 5mm; font-size: 8pt; border-top: 1px dashed #000; padding-top: 2mm; }
          </style>
        </head>
        <body>
          <!-- Header Section -->
          <div class="header">
            <h1>WILPOS</h1>
            <h2>COMPROBANTE DE VENTA</h2>
            <div>Factura #${sale.id || 'N/A'}</div>
            <div>Fecha: ${new Date(sale.fecha_venta).toLocaleString()}</div>
            <div>Cliente: ${sale.cliente || 'Cliente General'}</div>
            <div>Cajero: ${sale.usuario || 'Usuario'}</div>
          </div>

          <!-- Items Section -->
          <div style="text-align:center; font-weight:bold;">DETALLE DE VENTA</div>
          <table class="products">
            <tr>
              <th>CANT</th>
              <th>DESCRIPCIÓN</th>
              <th style="text-align:right">IMPORTE</th>
            </tr>
            ${productsTable}
          </table>

          <!-- Totals -->
          <div class="totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>${formatCurrency(sale.total - sale.impuestos)}</span>
            </div>
            
            ${sale.impuestos > 0 ? `
              <div class="total-row">
                <span>ITBIS:</span>
                <span>${formatCurrency(sale.impuestos)}</span>
              </div>
            ` : ''}
            
            ${sale.descuento > 0 ? `
              <div class="total-row">
                <span>Descuento:</span>
                <span>-${formatCurrency(sale.descuento)}</span>
              </div>
            ` : ''}
            
            <div class="grand-total">
              <span>TOTAL:</span>
              <span>${formatCurrency(sale.total)}</span>
            </div>

            <!-- Payment Information -->
            ${sale.metodo_pago === 'Efectivo' ? `
              <div class="total-row">
                <span>Recibido:</span>
                <span>${formatCurrency(sale.monto_recibido)}</span>
              </div>
              <div class="total-row">
                <span>Cambio:</span>
                <span>${formatCurrency(sale.cambio)}</span>
              </div>
            ` : `
              <div class="total-row">
                <span>Método de pago:</span>
                <span>${sale.metodo_pago}</span>
              </div>
            `}
          </div>

          <!-- Footer Section -->
          <div class="footer">
            <p>Gracias por su compra</p>
            <p>WILPOS - Sistema de Punto de Venta</p>
            <p>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
          </div>
        </body>
        </html>
      `;
    } catch (error) {
      console.error('Error generando HTML:', error);
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura ${sale.id || 'N/A'}</title>
        </head>
        <body>
          <h2>Factura #${sale.id || 'N/A'}</h2>
          <p>Total: RD$${sale.total.toFixed(2)}</p>
          <p>Fecha: ${new Date().toLocaleString()}</p>
          <p>Gracias por su compra</p>
        </body>
        </html>
      `;
    }
  }

  private generateESCPOSCommands(sale: PreviewSale): string {
    try {
      const formatCurrency = (amount: number): string => {
        return `RD$ ${amount.toFixed(2)}`;
      };
      
      // Definir constantes ESC/POS
      const ESC = '\x1B';
      const GS = '\x1D';
      const LF = '\x0A';
      
      // Comandos de formato
      const INIT = `${ESC}@`;                   // Inicializar
      const ALIGN_CENTER = `${ESC}a\x01`;       // Alineación centrada
      const ALIGN_LEFT = `${ESC}a\x00`;         // Alineación izquierda
      const ALIGN_RIGHT = `${ESC}a\x02`;        // Alineación derecha
      const FONT_NORMAL = `${ESC}!\x00`;        // Fuente normal
      const FONT_BOLD = `${ESC}E\x01`;          // Negrita activada
      const FONT_BOLD_OFF = `${ESC}E\x00`;      // Negrita desactivada
      const FONT_DOUBLE = `${ESC}!\x30`;        // Fuente doble altura/ancho
      const FONT_SMALL = `${ESC}!\x01`;         // Fuente pequeña
      const LINE_FEED = `${LF}`;                // Salto de línea
      const DOUBLE_LINE_FEED = `${LF}${LF}`;    // Doble salto de línea
      const CUT_PAPER = `${GS}V\x42\x00`;       // Cortar papel
      
      // Definir ancho según tamaño
      const width = this.paperSize === ThermalPaperSize.PAPER_58MM ? 32 : 48;
      
      // Función para centrar texto
      const center = (text: string, length: number): string => {
        const spaces = Math.max(0, length - text.length);
        const padLeft = Math.floor(spaces / 2);
        return ' '.repeat(padLeft) + text;
      };
      
      // Función para rellenar a la derecha
      const padRight = (text: string, length: number): string => {
        return (text + ' '.repeat(length)).substring(0, length);
      };
      
      // Función para crear línea de separación
      const divider = (): string => {
        return '-'.repeat(width) + LINE_FEED;
      };
      
      // Encabezado del recibo
      let receipt = INIT + ALIGN_CENTER;
      receipt += FONT_DOUBLE + "WILPOS" + LINE_FEED;
      receipt += FONT_NORMAL + "COMPROBANTE DE VENTA" + DOUBLE_LINE_FEED;
      receipt += FONT_NORMAL + `Factura #${sale.id || 'N/A'}` + LINE_FEED;
      receipt += `Fecha: ${new Date(sale.fecha_venta).toLocaleString()}` + LINE_FEED;
      receipt += `Cliente: ${sale.cliente || 'Cliente General'}` + LINE_FEED;
      receipt += `Cajero: ${sale.usuario || 'Usuario'}` + DOUBLE_LINE_FEED;
      
      // Título de detalles
      receipt += FONT_BOLD + center("DETALLE DE VENTA", width) + LINE_FEED;
      receipt += FONT_BOLD_OFF + divider();
      
      // Encabezados de columna
      receipt += ALIGN_LEFT;
      receipt += padRight("CANT", 5) + padRight("DESCRIPCION", width - 20) + padRight("IMPORTE", 15) + LINE_FEED;
      receipt += divider();
      
      // Productos
      for (const item of sale.detalles) {
        const quantity = padRight(item.quantity.toString(), 5);
        const name = padRight(item.name.length > (width - 25) ? item.name.substring(0, width - 28) + "..." : item.name, width - 20);
        const price = padRight(formatCurrency(item.subtotal), 15);
        receipt += quantity + name + price + LINE_FEED;
      }
      
      receipt += divider();
      
      // Totales
      receipt += ALIGN_RIGHT;
      receipt += `Subtotal: ${formatCurrency(sale.total - sale.impuestos)}` + LINE_FEED;
      
      if (sale.impuestos > 0) {
        receipt += `ITBIS: ${formatCurrency(sale.impuestos)}` + LINE_FEED;
      }
      
      if (sale.descuento > 0) {
        receipt += `Descuento: -${formatCurrency(sale.descuento)}` + LINE_FEED;
      }
      
      receipt += FONT_BOLD + `TOTAL: ${formatCurrency(sale.total)}` + LINE_FEED + FONT_BOLD_OFF;
      
      // Información de pago
      if (sale.metodo_pago === 'Efectivo') {
        receipt += `Recibido: ${formatCurrency(sale.monto_recibido)}` + LINE_FEED;
        receipt += `Cambio: ${formatCurrency(sale.cambio)}` + LINE_FEED;
      } else {
        receipt += `Método de pago: ${sale.metodo_pago}` + LINE_FEED;
      }
      
      // Pie de página
      receipt += DOUBLE_LINE_FEED + ALIGN_CENTER;
      receipt += "Gracias por su compra" + LINE_FEED;
      receipt += "WILPOS - Sistema de Punto de Venta" + LINE_FEED;
      receipt += `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}` + LINE_FEED;
      
      // Cortar papel y finalizar
      receipt += LINE_FEED + LINE_FEED + LINE_FEED + CUT_PAPER + INIT;
      
      return receipt;
    } catch (error) {
      console.error('Error generando ESC/POS:', error);
      return '\x1B@FACTURA\nTotal...\n\x1Bd\x04'; // Comando mínimo en caso de error
    }
  }

  public async printReceipt(sale: PreviewSale): Promise<PrintResult> {
    try {
      console.log('Iniciando impresión de recibo...');
      
      // Verificar estado de impresora
      const status = await this.checkPrinterStatus();
      if (!status.available || !status.printerName) {
        console.error('No hay impresora disponible:', status.message);
        return { success: false, message: status.message || 'No hay impresora disponible' };
      }

      console.log(`Imprimiendo en: ${status.printerName} (${this.paperSize})`);
      
      // Intentar primero impresión directa con comandos ESC/POS
      if (window.printerApi?.printRaw) {
        try {
          console.log('Intentando impresión directa ESC/POS...');
          const escpos = this.generateESCPOSCommands(sale);
          console.log(`Comandos ESC/POS generados (${escpos.length} bytes)`);
          
          const raw = await window.printerApi.printRaw(escpos, status.printerName);
          if (raw.success) {
            console.log('✅ Impresión ESC/POS exitosa');
            return { success: true, message: 'Impresión directa exitosa' };
          } else {
            console.warn('⚠️ Impresión ESC/POS falló:', raw.error || 'Error desconocido');
          }
        } catch (rawError) {
          console.warn('⚠️ Error en impresión ESC/POS:', rawError);
        }
      }

      // Si falla ESC/POS, intentar con HTML
      console.log('Intentando impresión mediante HTML...');
      const html = this.generateThermalReceiptHTML(sale);
      const result = await this.printerService.print({
        html,
        printerName: status.printerName,
        silent: true,
        options: { 
          thermalPrinter: true, 
          width: this.paperSize 
        }
      });
      
      if (!result.success) {
        console.error('❌ Error en impresión HTML:', result.error);
        throw new Error(result.error || 'Error de impresión');
      }
      
      console.log('✅ Impresión HTML exitosa');
      return { success: true, message: 'Recibo enviado a impresora' };
    } catch (error) {
      console.error('❌ Error fatal imprimiendo recibo:', error);
      return { 
        success: false, 
        message: `Error: ${error instanceof Error ? error.message : 'Desconocido'}` 
      };
    }
  }

  public async testPrinter(): Promise<PrintResult> {
    try {
      const status = await this.checkPrinterStatus();
      if (!status.available || !status.printerName) {
        return { success: false, message: 'No hay impresora disponible' };
      }
      
      // Generar página de prueba
      const testCommands = 
        '\x1B@' +                                // Inicializar impresora
        '\x1Ba\x01' +                           // Centrar texto
        '\x1B!\x30' + 'WILPOS' + '\x0A' +       // Texto grande
        '\x1B!\x00' + 'PRUEBA DE IMPRESORA' + '\x0A\x0A' +  // Texto normal
        'Si puede leer esto,\nla impresora está funcionando correctamente\x0A\x0A' +
        `Fecha y hora: ${new Date().toLocaleString()}\x0A` +
        `Impresora: ${status.printerName}\x0A` +
        `Tipo de papel: ${this.paperSize}\x0A\x0A` +
        'WILPOS - Sistema de Punto de Venta\x0A\x0A\x0A' +
        '\x1D\x56\x42\x00';                     // Cortar papel
      
      // Intentar impresión directa primero
      if (window.printerApi?.printRaw) {
        try {
          const raw = await window.printerApi.printRaw(testCommands, status.printerName);
          if (raw.success) {
            return { success: true, message: 'Prueba de impresora exitosa' };
          }
        } catch (rawError) {
          console.warn('Error en prueba directa:', rawError);
        }
      }
      
      // Si falla, intentar con HTML
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Prueba de Impresora</title>
          <style>
            @page { margin: 0; size: ${this.paperSize} auto; }
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 10mm;
              width: ${this.paperSize === ThermalPaperSize.PAPER_58MM ? '48mm' : '72mm'};
              margin: 0 auto;
            }
            .title { font-size: 14pt; font-weight: bold; margin-bottom: 5mm; }
            .content { font-size: 10pt; margin-bottom: 5mm; }
            .footer { margin-top: 10mm; font-size: 8pt; border-top: 1px dashed #000; padding-top: 2mm; }
          </style>
        </head>
        <body>
          <div class="title">WILPOS<br>PRUEBA DE IMPRESORA</div>
          <div class="content">
            <p>Si puede leer esto, la impresora está funcionando correctamente</p>
            <p>Fecha: ${new Date().toLocaleString()}</p>
            <p>Impresora: ${status.printerName}</p>
            <p>Tipo: ${this.paperSize}</p>
          </div>
          <div class="footer">WILPOS - Sistema de Punto de Venta</div>
        </body>
        </html>
      `;
      
      const result = await this.printerService.print({
        html,
        printerName: status.printerName,
        silent: true,
        options: { thermalPrinter: true, width: this.paperSize }
      });
      
      return result.success
        ? { success: true, message: 'Prueba de impresora exitosa' }
        : { success: false, message: result.error || 'Error en prueba de impresión' };
    } catch (error) {
      console.error('Error en prueba de impresora:', error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Desconocido'}`
      };
    }
  }
}

export default ThermalPrintService;