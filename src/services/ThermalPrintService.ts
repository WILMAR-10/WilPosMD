// src/services/ThermalPrintService.ts - Versión simplificada
import { PreviewSale } from '../types/sales';

// Tipos de papel térmico soportados
export enum ThermalPaperSize {
  PAPER_80MM = '80mm',
  PAPER_58MM = '58mm'
}

// Resultado de la impresión
export interface PrintResult {
  success: boolean;
  message?: string;
}

/**
 * Servicio simplificado para manejo de impresoras térmicas
 * Sigue el patrón Singleton para tener una única instancia global
 */
export class ThermalPrintService {
  private static instance: ThermalPrintService;
  private printerName: string | undefined = undefined;
  private paperSize: ThermalPaperSize = ThermalPaperSize.PAPER_80MM;
  
  /**
   * Constructor privado para el patrón singleton
   */
  private constructor() {
    this.loadSettings();
  }
  
  /**
   * Obtener la instancia única del servicio
   */
  public static getInstance(): ThermalPrintService {
    if (!ThermalPrintService.instance) {
      ThermalPrintService.instance = new ThermalPrintService();
    }
    return ThermalPrintService.instance;
  }
  
  /**
   * Cargar configuración de la aplicación
   */
  private async loadSettings(): Promise<void> {
    try {
      if (window.api?.getSettings) {
        const settings = await window.api.getSettings();
        
        if (settings) {
          this.printerName = settings.impresora_termica || undefined;
          
          // Configurar tamaño de papel basado en configuración
          if (settings.tipo_impresora === 'termica58') {
            this.paperSize = ThermalPaperSize.PAPER_58MM;
          } else {
            this.paperSize = ThermalPaperSize.PAPER_80MM;
          }
        }
      }
    } catch (error) {
      console.error('Error loading thermal printer settings:', error);
    }
  }
  
  /**
   * Verificar si hay una impresora térmica disponible
   */
  public async checkPrinterStatus(): Promise<{ available: boolean; printerName?: string; message?: string }> {
    try {
      // Obtener todas las impresoras disponibles
      const printers = await this.getAllPrinters();
      
      // Si tenemos una impresora configurada, verificar si está disponible
      if (this.printerName) {
        const configuredPrinter = printers.printers.find(p => p.name === this.printerName);
        
        if (configuredPrinter) {
          return { 
            available: true, 
            printerName: this.printerName,
            message: `Impresora configurada "${this.printerName}" disponible`
          };
        }
        
        return {
          available: false,
          message: `Impresora configurada "${this.printerName}" no disponible`
        };
      }
      
      // Si no hay impresora configurada, buscar impresoras térmicas
      const thermalPrinter = printers.printers.find(p => this.isThermalPrinter(p.name));
      if (thermalPrinter) {
        // Guardar la impresora detectada para usos futuros
        this.printerName = thermalPrinter.name;
        
        return { 
          available: true, 
          printerName: thermalPrinter.name,
          message: `Impresora térmica detectada: "${thermalPrinter.name}"`
        };
      }
      
      // Si no hay impresoras térmicas, usar la impresora predeterminada
      const defaultPrinter = printers.printers.find(p => p.isDefault);
      if (defaultPrinter) {
        return {
          available: true,
          printerName: defaultPrinter.name,
          message: `No se detectaron impresoras térmicas. Usando impresora predeterminada "${defaultPrinter.name}"`
        };
      }
      
      return {
        available: false,
        message: 'No se detectaron impresoras'
      };
    } catch (error) {
      console.error('Error checking printer status:', error);
      return {
        available: false,
        message: `Error al verificar impresora: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }
  
  /**
   * Obtener todas las impresoras disponibles
   */
  public async getAllPrinters(): Promise<{ printers: any[] }> {
    try {
      // Intentar usar printerApi
      if (window.printerApi?.getPrinters) {
        const res = await window.printerApi.getPrinters();
        if (res.success) {
          return { printers: res.printers };
        }
      }
      
      // Intentar con window.api como fallback
      if (window.api?.getPrinters) {
        const printers = await window.api.getPrinters();
        return { printers };
      }
      
      return { printers: [] };
    } catch (error) {
      console.warn('Error getting printers:', error);
      return { printers: [] };
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
   * Genera HTML optimizado para impresora térmica
   */
  private generateThermalReceiptHTML(sale: PreviewSale): string {
    // Ajustar ancho según el tamaño de papel
    const contentWidth = this.paperSize === ThermalPaperSize.PAPER_58MM ? '48mm' : '72mm';
    
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
              size: ${this.paperSize};
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
      console.error('Error generating thermal receipt HTML:', error);
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
   * Imprimir un recibo directamente en la impresora térmica
   */
  public async printReceipt(sale: PreviewSale): Promise<PrintResult> {
    try {
      // Generar HTML específico para impresora térmica
      const html = this.generateThermalReceiptHTML(sale);
      
      // Preparar opciones de impresión
      const printOptions = {
        html,
        printerName: this.printerName,
        silent: true,
        options: {
          thermalPrinter: true,
          pageSize: this.paperSize
        }
      };
      
      // Usar API de impresión disponible
      if (window.printerApi?.print) {
        const result = await window.printerApi.print(printOptions);
        
        if (!result.success) {
          throw new Error(result.error || 'Error al imprimir');
        }
        
        return { success: true, message: 'Impresión enviada a la impresora térmica' };
      } else if (window.api?.printInvoice) {
        const result = await window.api.printInvoice(printOptions);
        
        if (!result.success) {
          throw new Error(result.error || 'Error al imprimir');
        }
        
        return { success: true, message: 'Impresión enviada a la impresora térmica' };
      } else {
        throw new Error('API de impresión no disponible');
      }
    } catch (error) {
      console.error('Error printing receipt:', error);
      return { 
        success: false, 
        message: `Error al imprimir: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }
  
  /**
   * Imprimir una página de prueba para verificar la impresora
   */
  public async testPrinter(): Promise<PrintResult> {
    try {
      // HTML de prueba simple
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Prueba de Impresora</title>
          <style>
            @page { 
              margin: 0mm; 
              size: ${this.paperSize};
            }
            body {
              font-family: 'Arial', sans-serif;
              text-align: center;
              padding: 5mm;
            }
            .title {
              font-size: 12pt;
              font-weight: bold;
              margin-bottom: 5mm;
            }
            .section {
              margin: 5mm 0;
              text-align: left;
            }
          </style>
        </head>
        <body>
          <div class="title">PRUEBA DE IMPRESORA TÉRMICA</div>
          
          <div class="section">
            Impresora: ${this.printerName || 'Predeterminada'}
            Tamaño: ${this.paperSize}
            Fecha: ${new Date().toLocaleString()}
          </div>
          
          <div class="section">
            ABCDEFGHIJKLMNÑOPQRSTUVWXYZ
            1234567890
          </div>
          
          <div style="border-top: 1px dashed #000; margin-top: 5mm; padding-top: 5mm;">
            Si puede leer este texto, la impresora funciona correctamente.
          </div>
        </body>
        </html>
      `;
      
      // Opciones de impresión
      const printOptions = {
        html,
        printerName: this.printerName,
        silent: true,
        options: {
          thermalPrinter: true,
          pageSize: this.paperSize
        }
      };
      
      // Usar API de impresión disponible
      if (window.printerApi?.print) {
        const result = await window.printerApi.print(printOptions);
        
        if (!result.success) {
          throw new Error(result.error || 'Error al imprimir página de prueba');
        }
        
        return { success: true, message: 'Página de prueba enviada a la impresora' };
      } else if (window.api?.printInvoice) {
        const result = await window.api.printInvoice(printOptions);
        
        if (!result.success) {
          throw new Error(result.error || 'Error al imprimir página de prueba');
        }
        
        return { success: true, message: 'Página de prueba enviada a la impresora' };
      } else {
        throw new Error('API de impresión no disponible');
      }
    } catch (error) {
      console.error('Error printing test page:', error);
      return { 
        success: false, 
        message: `Error al imprimir página de prueba: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }
}

export default ThermalPrintService;