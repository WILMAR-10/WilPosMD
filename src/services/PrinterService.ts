// src/services/PrintingService.ts
// Servicio unificado para manejar todas las operaciones de impresión y PDF
import { PreviewSale } from '../types/sales';

// Tipos de impresora soportados
export enum PrinterType {
  STANDARD = 'normal',
  THERMAL_80MM = 'termica',
  THERMAL_58MM = 'termica58'
}

// Opciones de impresión simplificadas
export interface PrintOptions {
  printerName?: string;
  silent?: boolean;
  copies?: number;
}

// Opciones para guardar PDF
export interface SavePdfOptions {
  directory: string;
  filename?: string;
  overwrite?: boolean;
}

/**
 * Servicio unificado de impresión - maneja tanto impresoras normales como térmicas
 * usando las APIs nativas de Electron
 */
export class PrintingService {
  private static instance: PrintingService;
  private printerName: string | undefined = undefined;
  private printerType: PrinterType = PrinterType.STANDARD;
  private savePdfEnabled: boolean = true;
  private pdfSavePath: string = '';

  // Constructor privado (patrón singleton)
  private constructor() {
    this.loadSettings();
  }

  // Obtener instancia singleton
  public static getInstance(): PrintingService {
    if (!PrintingService.instance) {
      PrintingService.instance = new PrintingService();
    }
    return PrintingService.instance;
  }

  /**
   * Cargar configuración de impresora desde la aplicación
   */
  private async loadSettings(): Promise<void> {
    try {
      if (window.api?.getSettings) {
        const settings = await window.api.getSettings();
        
        if (settings) {
          this.printerName = settings.impresora_termica || undefined;
          this.printerType = settings.tipo_impresora as PrinterType || PrinterType.STANDARD;
          this.savePdfEnabled = settings.guardar_pdf !== false;
          this.pdfSavePath = settings.ruta_pdf || '';
          
          console.log("Configuración de impresora cargada:", {
            printerName: this.printerName,
            printerType: this.printerType,
            savePdfEnabled: this.savePdfEnabled,
            pdfSavePath: this.pdfSavePath
          });
        }
      }
    } catch (error) {
      console.error('Error cargando configuración de impresora:', error);
    }
  }

  /**
   * Verificar estado de la impresora
   */
  public async checkPrinterStatus(): Promise<{
    available: boolean;
    printerName?: string;
    message?: string;
  }> {
    try {
      const printers = await this.getAvailablePrinters();
      
      // Si hay una impresora configurada, verificar si está disponible
      if (this.printerName) {
        const configuredPrinter = printers.find(p => p.name === this.printerName);
        
        if (configuredPrinter) {
          return {
            available: true,
            printerName: this.printerName,
            message: `Impresora configurada "${this.printerName}" disponible`
          };
        }
        
        return {
          available: false,
          message: `Impresora configurada "${this.printerName}" no encontrada`
        };
      }
      
      // Si no hay impresora configurada, buscar una impresora térmica
      const thermalPrinters = printers.filter(p => this.isThermalPrinter(p.name));
      
      if (thermalPrinters.length > 0) {
        const printer = thermalPrinters[0];
        return {
          available: true,
          printerName: printer.name,
          message: `Impresora térmica detectada: "${printer.name}"`
        };
      }
      
      // Si no hay impresoras térmicas, usar la impresora predeterminada
      const defaultPrinter = printers.find(p => p.isDefault);
      if (defaultPrinter) {
        return {
          available: true,
          printerName: defaultPrinter.name,
          message: `Usando impresora predeterminada: "${defaultPrinter.name}"`
        };
      }
      
      return {
        available: false,
        message: 'No se detectaron impresoras'
      };
    } catch (error) {
      console.error('Error verificando estado de impresora:', error);
      return {
        available: false,
        message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }

  /**
   * Obtener todas las impresoras disponibles
   */
  public async getAvailablePrinters(): Promise<Array<{
    name: string;
    description?: string;
    isDefault?: boolean;
    isThermal?: boolean;
  }>> {
    try {
      let printers: any[] = [];
      
      // Usar nueva API de electronPrinter
      if (window.electronPrinter?.getPrinters) {
        printers = await window.electronPrinter.getPrinters();
      }
      
      // Detectar impresoras térmicas
      return printers.map(p => ({
        name: p.name,
        description: p.description,
        isDefault: p.isDefault,
        isThermal: this.isThermalPrinter(p.name) || p.isThermal
      }));
    } catch (error) {
      console.error('Error obteniendo impresoras:', error);
      return [];
    }
  }

  /**
   * Detectar si una impresora es térmica basado en su nombre
   */
  private isThermalPrinter(name: string): boolean {
    const lowerName = name.toLowerCase();
    return lowerName.includes('thermal') ||
           lowerName.includes('receipt') ||
           lowerName.includes('pos') ||
           lowerName.includes('80mm') ||
           lowerName.includes('58mm');
  }

  /**
   * Generar HTML optimizado para impresora térmica
   */
  private generateThermalHTML(sale: PreviewSale): string {
    // Ancho según el tipo de impresora
    const contentWidth = this.printerType === PrinterType.THERMAL_58MM ? '48mm' : '72mm';
    const paperSize = this.printerType === PrinterType.THERMAL_58MM ? '58mm' : '80mm';
    
    try {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura ${sale.id || ''}</title>
          <style>
            @page { 
              margin: 0mm; 
              size: ${paperSize};
            }
            body {
              font-family: 'Arial', sans-serif;
              width: ${contentWidth};
              margin: 0;
              padding: 3mm;
              font-size: 10pt;
              line-height: 1.2;
            }
            .header {
              text-align: center;
              margin-bottom: 5mm;
            }
            .company {
              font-size: 12pt;
              font-weight: bold;
              margin-bottom: 2mm;
            }
            .title {
              font-size: 10pt;
              font-weight: bold;
              text-align: center;
              border-top: 1px dashed #000;
              border-bottom: 1px dashed #000;
              padding: 2mm 0;
              margin: 2mm 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              text-align: left;
              font-size: 9pt;
              padding: 1mm;
            }
            .right {
              text-align: right;
            }
            .total-line {
              display: flex;
              justify-content: space-between;
              font-size: 9pt;
              margin: 1mm 0;
            }
            .grand-total {
              font-weight: bold;
              font-size: 11pt;
              margin-top: 2mm;
              border-top: 1px solid #000;
              padding-top: 2mm;
            }
            .footer {
              text-align: center;
              font-size: 8pt;
              margin-top: 5mm;
              border-top: 1px dashed #000;
              padding-top: 2mm;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company">WILPOS</div>
            <div>Factura #${sale.id || 'N/A'}</div>
            <div>Fecha: ${new Date(sale.fecha_venta).toLocaleDateString()}</div>
            <div>Cliente: ${sale.cliente || 'Cliente General'}</div>
          </div>
          
          <div class="title">DETALLE DE VENTA</div>
          
          <table>
            <tr>
              <th>CANT</th>
              <th>DESCRIPCIÓN</th>
              <th class="right">PRECIO</th>
              <th class="right">TOTAL</th>
            </tr>
            ${sale.detalles.map(item => `
              <tr>
                <td>${item.quantity}</td>
                <td>${item.name.substring(0, 15)}${item.name.length > 15 ? '...' : ''}</td>
                <td class="right">RD$${item.price.toFixed(2)}</td>
                <td class="right">RD$${item.subtotal.toFixed(2)}</td>
              </tr>
            `).join('')}
          </table>
          
          <div style="border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm;">
            <div class="total-line">
              <span>Subtotal:</span>
              <span>RD$${(sale.total - sale.impuestos).toFixed(2)}</span>
            </div>
            <div class="total-line">
              <span>Impuestos:</span>
              <span>RD$${sale.impuestos.toFixed(2)}</span>
            </div>
            ${sale.descuento > 0 ? `
              <div class="total-line">
                <span>Descuento:</span>
                <span>-RD$${sale.descuento.toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="grand-total">
              <span>TOTAL:</span>
              <span>RD$${sale.total.toFixed(2)}</span>
            </div>
            
            ${sale.metodo_pago === 'Efectivo' ? `
              <div class="total-line">
                <span>Recibido:</span>
                <span>RD$${sale.monto_recibido.toFixed(2)}</span>
              </div>
              <div class="total-line">
                <span>Cambio:</span>
                <span>RD$${sale.cambio.toFixed(2)}</span>
              </div>
            ` : `
              <div class="total-line">
                <span>Método de pago:</span>
                <span>${sale.metodo_pago}</span>
              </div>
            `}
          </div>
          
          <div class="footer">
            <p>Gracias por su compra</p>
            <p>WILPOS - Sistema de Punto de Venta</p>
            <p>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
          </div>
        </body>
        </html>
      `;
    } catch (error) {
      console.error('Error generando HTML térmico:', error);
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Factura Simplificada</title>
        </head>
        <body>
          <h2>Factura #${sale.id || 'N/A'}</h2>
          <p>Total: RD$${sale.total.toFixed(2)}</p>
          <p>Gracias por su compra</p>
        </body>
        </html>
      `;
    }
  }

  /**
   * Generar HTML para impresoras normales
   */
  public generateStandardHTML(sale: PreviewSale): string {
    try {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura ${sale.id || 'Temporal'}</title>
          <style>
            @page {
              margin: 10mm;
              size: A4;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
            }
            .invoice-container {
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .invoice-title {
              font-size: 18px;
              margin: 15px 0;
              text-align: center;
              font-weight: bold;
            }
            .invoice-details {
              display: flex;
              justify-content: space-between;
              margin-bottom: 20px;
            }
            .invoice-details div {
              margin-bottom: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            table th, table td {
              padding: 8px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            table th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            .totals {
              margin-top: 20px;
              text-align: right;
            }
            .totals div {
              margin-bottom: 5px;
            }
            .total-line {
              font-weight: bold;
              font-size: 16px;
              border-top: 2px solid #000;
              padding-top: 5px;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header">
              <div class="company-name">WILPOS</div>
              <div>Sistema de Punto de Venta</div>
            </div>
            
            <div class="invoice-title">FACTURA #${sale.id || 'N/A'}</div>
            
            <div class="invoice-details">
              <div>
                <div><strong>Fecha:</strong> ${new Date(sale.fecha_venta).toLocaleString()}</div>
                <div><strong>Cliente:</strong> ${sale.cliente || 'Cliente General'}</div>
              </div>
              <div>
                <div><strong>Método de pago:</strong> ${sale.metodo_pago}</div>
                <div><strong>Estado:</strong> ${sale.estado || 'Completada'}</div>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>ITBIS</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${sale.detalles.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>RD$${item.price.toFixed(2)}</td>
                    <td>${item.is_exempt ? 'Exento' : (item.itebis * 100).toFixed(0) + '%'}</td>
                    <td>RD$${item.subtotal.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="totals">
              <div><strong>Subtotal:</strong> RD$${(sale.total - sale.impuestos).toFixed(2)}</div>
              <div><strong>ITBIS:</strong> RD$${sale.impuestos.toFixed(2)}</div>
              ${sale.descuento > 0 ? `<div><strong>Descuento:</strong> -RD$${sale.descuento.toFixed(2)}</div>` : ''}
              <div class="total-line"><strong>TOTAL:</strong> RD$${sale.total.toFixed(2)}</div>
              
              ${sale.metodo_pago === 'Efectivo' ? `
                <div><strong>Monto recibido:</strong> RD$${sale.monto_recibido.toFixed(2)}</div>
                <div><strong>Cambio:</strong> RD$${sale.cambio.toFixed(2)}</div>
              ` : ''}
            </div>
            
            <div class="footer">
              <p>Gracias por su compra</p>
              <p>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } catch (error) {
      console.error('Error generando HTML estándar:', error);
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura Simplificada</title>
          <style>
            body { font-family: Arial; padding: 20px; }
          </style>
        </head>
        <body>
          <h2>Factura #${sale.id || 'N/A'}</h2>
          <p>Fecha: ${new Date().toLocaleString()}</p>
          <p>Total: RD$${sale.total.toFixed(2)}</p>
          <p>Gracias por su compra</p>
        </body>
        </html>
      `;
    }
  }

  /**
   * Imprimir factura - método simplificado y más confiable
   */
  public async printInvoice(
    sale: PreviewSale,
    options?: PrintOptions
  ): Promise<{ success: boolean; message?: string }> {
    try {
      if (!window.electronPrinter?.print) {
        throw new Error('API de impresión no disponible');
      }
      
      // Determinar qué HTML generar según el tipo de impresora
      const isThermalPrinter = this.printerType === PrinterType.THERMAL_80MM || 
                               this.printerType === PrinterType.THERMAL_58MM;
      
      const htmlContent = isThermalPrinter 
        ? this.generateThermalHTML(sale)
        : this.generateStandardHTML(sale);
      
      // Opciones para la API de impresión
      const printOptions = {
        html: htmlContent,
        printerName: options?.printerName || this.printerName || undefined,
        silent: options?.silent !== undefined ? options.silent : true,
        copies: options?.copies || 1,
        options: {
          // Opciones específicas para impresoras térmicas
          thermalPrinter: isThermalPrinter,
          pageSize: isThermalPrinter ? 
            (this.printerType === PrinterType.THERMAL_58MM ? '58mm' : '80mm') : 'A4',
          printBackground: true
        }
      };
      
      console.log('Enviando trabajo de impresión a:', printOptions.printerName || 'Impresora predeterminada');
      
      // Usar la nueva API de electronPrinter
      const result = await window.electronPrinter.print(printOptions);
      
      // Si automáticamente guardamos PDF y la impresión fue exitosa
      if (result.success && this.savePdfEnabled && this.pdfSavePath) {
        try {
          await this.saveAsPdf(sale, htmlContent, {
            directory: this.pdfSavePath,
            filename: `factura-${sale.id || 'temp'}-${new Date().toISOString().split('T')[0]}.pdf`
          });
        } catch (pdfError) {
          console.warn('Error guardando PDF automáticamente:', pdfError);
        }
      }
      
      return {
        success: result.success,
        message: result.success ? 'Impresión exitosa' : (result.error || 'Error de impresión')
      };
    } catch (error) {
      console.error('Error al imprimir:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Guardar factura como PDF
   */
  public async saveAsPdf(
    sale: PreviewSale,
    htmlContent: string,
    options: SavePdfOptions
  ): Promise<string | null> {
    try {
      if (!window.api?.savePdf) {
        throw new Error('API para guardar PDF no disponible');
      }
      
      // Asegurar que tenemos una ruta
      if (!options.directory) {
        throw new Error('Se requiere un directorio para guardar el PDF');
      }
      
      // Generar nombre de archivo si no se proporciona
      const filename = options.filename || 
        `factura-${sale.id || 'temp'}-${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Ruta completa
      const filePath = `${options.directory}/${filename}`;
      
      // Guardar PDF
      const result = await window.api.savePdf({
        html: htmlContent,
        path: filePath,
        options: {
          printBackground: true,
          margins: { top: 5, right: 5, bottom: 5, left: 5 },
          pageSize: 'A4'
        }
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Error al guardar PDF');
      }
      
      return result.path || filePath;
    } catch (error) {
      console.error('Error al guardar como PDF:', error);
      return null;
    }
  }

  /**
   * Imprimir página de prueba
   */
  public async printTestPage(): Promise<{ success: boolean; message: string }> {
    try {
      if (!window.electronPrinter?.print) {
        throw new Error('API de impresión no disponible');
      }
      
      // HTML de prueba simplificado
      const testHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Página de Prueba</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              text-align: center;
            }
            .title {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 15px;
            }
            .content {
              margin: 20px 0;
              padding: 15px;
              border: 1px dashed #333;
              text-align: left;
            }
            .footer {
              margin-top: 30px;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="title">WILPOS - PÁGINA DE PRUEBA</div>
          
          <div>Esta es una página de prueba para verificar la impresión</div>
          
          <div class="content">
            <p><strong>Información de la impresora:</strong></p>
            <p>Nombre: ${this.printerName || 'Predeterminada'}</p>
            <p>Tipo: ${this.printerType}</p>
            <p>Fecha: ${new Date().toLocaleString()}</p>
          </div>
          
          <div class="content">
            <p><strong>Texto de prueba:</strong></p>
            <p>ABCDEFGHIJKLMNÑOPQRSTUVWXYZ</p>
            <p>abcdefghijklmnñopqrstuvwxyz</p>
            <p>0123456789</p>
            <p>!@#$%^&*()_+-=[]{}|;:,./<>?</p>
          </div>
          
          <div class="footer">
            Si puede leer este texto, la impresora está funcionando correctamente.
          </div>
        </body>
        </html>
      `;
      
      // Opciones de impresión
      const printOptions = {
        html: testHTML,
        printerName: this.printerName,
        silent: false,
        copies: 1,
        options: {
          thermalPrinter: this.printerType !== PrinterType.STANDARD,
          pageSize: this.printerType === PrinterType.THERMAL_58MM ? '58mm' : 
                    this.printerType === PrinterType.THERMAL_80MM ? '80mm' : 'A4',
          printBackground: true
        }
      };
      
      // Usar la nueva API de electronPrinter
      const result = await window.electronPrinter.print(printOptions);
      
      return {
        success: result.success,
        message: result.success ? 
          `Página de prueba enviada a ${this.printerName || 'impresora predeterminada'}` : 
          (result.error || 'Error al imprimir página de prueba')
      };
    } catch (error) {
      console.error('Error al imprimir página de prueba:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }
}

export default PrintingService;