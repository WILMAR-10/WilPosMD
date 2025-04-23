// src/services/InvoiceManager.ts - Versión con tipos corregidos
import { PreviewSale } from '../types/sales';
import { PrintInvoiceRequest, SavePdfResult } from '../types/printer';

// Interfaz para impresoras
export interface Printer {
  name: string;
  displayName?: string;
  description?: string;
  status?: number;
  isDefault?: boolean;
}

// Interfaces mejoradas para opciones de impresión
export interface PrintOptions {
  silent: boolean;      // Impresión sin diálogo de confirmación
  printerName?: string; // Impresora específica a usar
  copies?: number;      // Número de copias
  printBackground?: boolean; // Imprimir gráficos y colores de fondo
  options?: {          // Opciones adicionales específicas para la impresora
    paperWidth?: string;
    printSpeed?: string;
    fontSize?: string;
    [key: string]: any;
  };
}

// Interfaces para opciones de guardado PDF
export interface SavePdfOptions {
  directory: string;    // Directorio donde guardar
  filename?: string;    // Nombre de archivo personalizado
  overwrite?: boolean;  // Sobrescribir si existe
}

// Interfaces para las opciones de API
interface PrintInvoiceOptions {
  html: string;
  printerName?: string;
  silent?: boolean;
  copies?: number;
  options?: {
    paperWidth?: string;
    printSpeed?: string;
    fontSize?: string;
    [key: string]: any;
  };
}

// Interfaces para los resultados de las operaciones de la API
interface PrintInvoiceResult {
  success: boolean;
  error?: string;
  needManualPrint?: boolean;
}

export class InvoiceManager {
  // Instancia singleton
  private static instance: InvoiceManager;
  
  // Opciones predeterminadas
  private defaultPrintOptions: PrintOptions = {
    silent: true,
    copies: 1,
    printBackground: true
  };
  
  private defaultSaveOptions: SavePdfOptions = {
    directory: '',
    overwrite: true
  };
  
  // Constructor privado para patrón singleton
  private constructor() {
    // Inicializar valores predeterminados desde la configuración
    this.loadSettings();
  }
  
  // Obtener instancia singleton
  public static getInstance(): InvoiceManager {
    if (!InvoiceManager.instance) {
      InvoiceManager.instance = new InvoiceManager();
    }
    return InvoiceManager.instance;
  }
  
  // Cargar configuración
  private async loadSettings(): Promise<void> {
    try {
      if (window.api?.getSettings) {
        const settings = await window.api.getSettings();
        
        // Actualizar opciones de impresión desde configuración
        if (settings) {
          this.defaultPrintOptions.printerName = settings.impresora_termica;
          
          // Actualizar directorio para guardar PDF
          if (settings.guardar_pdf && settings.ruta_pdf) {
            this.defaultSaveOptions.directory = settings.ruta_pdf;
          } else if (window.api.getAppPaths) {
            // Alternativa: usar carpeta de documentos
            try {
              const paths = await window.api.getAppPaths();
              this.defaultSaveOptions.directory = paths.documents + '/WilPOS/Facturas';
            } catch (pathError) {
              console.error('Error obteniendo rutas de app:', pathError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error cargando configuración de facturas:', error);
    }
  }
  
  // Imprimir factura - Método actualizado para manejar fallbacks de impresoras
  public async printInvoice(
    sale: PreviewSale,
    htmlContent: string,
    options?: { silent?: boolean; printerName?: string; copies?: number; printOptions?: Record<string, any> }
  ): Promise<boolean> {
    try {
      if (!window.api || !window.api.printInvoice) {
        console.error('API de impresión no disponible');
        return false;
      }
      
      // Log the printer being used
      console.log('Intentando imprimir con:', 
        options?.printerName || this.defaultPrintOptions.printerName || 'Impresora predeterminada del sistema');
      
      // Fetch available printers for fallback logic
      let availablePrinters: Printer[] = [];
      try {
        if (window.api.getPrinters) {
          availablePrinters = await window.api.getPrinters();
          console.log('Impresoras disponibles:', availablePrinters.map(p => p.name));
        }
      } catch (error) {
        console.warn('No se pudo obtener lista de impresoras:', error);
      }
      
      // Use the provided printer name, or find a default one from available printers
      let effectivePrinterName = options?.printerName || this.defaultPrintOptions.printerName;
      
      // If no printer specified or it's empty, try to find the default
      if (!effectivePrinterName || effectivePrinterName.trim() === '') {
        const defaultPrinter = availablePrinters.find(p => p.isDefault);
        if (defaultPrinter) {
          console.log('Usando impresora predeterminada:', defaultPrinter.name);
          effectivePrinterName = defaultPrinter.name;
        }
      }
      
      // Final print with effective printer and enhanced options
      const printOptions: PrintInvoiceOptions = {
        html: htmlContent,
        printerName: effectivePrinterName || undefined,
        silent: options?.silent ?? this.defaultPrintOptions.silent,
        copies: options?.copies || 1,
        options: {
          // Enhanced thermal printer options
          paperWidth: '80mm',
          printSpeed: '200mm',
          fontSize: '12pt',
          scaleFactor: 100,
          printBackground: true,
          margins: { 
            marginType: 'custom',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
          },
          mediaSize: {
            name: 'CUSTOM',
            width_microns: 80000, // 80mm in microns
            height_microns: 200000,
            custom_display_name: 'Ticket 80mm'
          },
          // Add any custom options passed by the caller
          ...options?.printOptions
        }
      };

      console.log('Print options:', {
        printerName: printOptions.printerName,
        silent: printOptions.silent,
        copies: printOptions.copies
      });
      
      const result = await window.api.printInvoice(printOptions);
      return result && result.success === true;
    } catch (error) {
      console.error('Error al imprimir:', error);
      return false;
    }
  }
  
  // Guardar factura como PDF con mejor manejo de errores
  public async saveAsPdf(
    sale: PreviewSale,
    htmlContent: string,
    options?: Partial<SavePdfOptions>
  ): Promise<string | null> {
    try {
      const saveOptions = { ...this.defaultSaveOptions, ...options };
      
      if (!window.api?.savePdf) {
        console.warn('API para guardar PDF no disponible');
        return null;
      }
      
      // Generar nombre de archivo si no se proporciona
      if (!saveOptions.filename) {
        const date = new Date().toISOString().split('T')[0];
        saveOptions.filename = `factura-${sale.id || 'temp'}-${date}.pdf`;
      }
      
      // Crear directorio si no existe
      try {
        // En un contexto Electron, podemos usar la API para asegurar que existe el directorio
        const targetDir = saveOptions.directory;
        if (window.api.getAppPaths) {
          await window.api.getAppPaths(); // Verificar que la API está disponible
          console.log('Guardando PDF en:', targetDir);
          // La creación del directorio se maneja en el proceso principal
        }
      } catch (dirError) {
        console.warn('Error al verificar directorio:', dirError);
        // Continuar de todas formas - el proceso principal manejará la creación del directorio
      }
      
      // Verificar que el contenido HTML no esté vacío
      if (!htmlContent || htmlContent.trim() === '') {
        console.error('Contenido HTML vacío para PDF');
        return null;
      }

      // Full path will be constructed in main process
      const filePath = `${saveOptions.directory}/${saveOptions.filename}`;
      
      // Save PDF
      const result = await window.api.savePdf({
        html: htmlContent,
        path: filePath,
        options: {
          printBackground: true,
          margins: { top: 5, right: 5, bottom: 5, left: 5 },
          pageSize: 'A4'
        }
      }) as SavePdfResult;
      
      if (result.success) {
        try {
          // Intentar abrir la carpeta si está configurado para hacerlo
          if (window.api.openFolder && saveOptions.directory) {
            window.api.openFolder(saveOptions.directory)
              .catch(err => console.warn('No se pudo abrir carpeta:', err));
          }
        } catch (openError) {
          console.warn('Error al intentar abrir carpeta:', openError);
        }
      }
      
      return result.success ? (result.path || filePath) : null;
    } catch (error) {
      console.error('Error al guardar factura como PDF:', error);
      return null;
    }
  }
  
  // Método mejorado para generar HTML optimizado para impresora térmica
  public generateThermalPrintHTML(sale: PreviewSale): string {
    try {
      // Ensure sale has all required properties
      if (!sale || !sale.detalles || !Array.isArray(sale.detalles)) {
        console.error('Invalid sale object for thermal print HTML generation', sale);
        throw new Error('Datos de venta inválidos para impresión');
      }
  
      // Create a valid HTML document structure for thermal printers
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura ${sale.id || 'Temporal'}</title>
          <style>
            @page {
              margin: 0;
              size: 80mm auto;
            }
            body {
              font-family: 'Arial', 'Helvetica', sans-serif;
              margin: 0;
              padding: 5mm;
              width: 70mm;
              font-size: 10pt;
              line-height: 1.2;
            }
            .header {
              text-align: center;
              margin-bottom: 3mm;
            }
            .company {
              font-size: 12pt;
              font-weight: bold;
              margin-bottom: 1mm;
            }
            .invoice-id {
              font-size: 10pt;
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
              font-size: 9pt;
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
              font-size: 12pt;
              margin: 2mm 0;
              border-top: 1px solid #000;
              padding-top: 2mm;
            }
            .footer {
              text-align: center;
              font-size: 9pt;
              margin-top: 5mm;
              border-top: 1px dashed #000;
              padding-top: 2mm;
            }
          </style>
        </head>
        <body>
          <!-- Header Section -->
          <div class="header">
            <div class="company">WILPOS</div>
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
            ${sale.detalles.map(item => `
              <tr>
                <td>${item.quantity}</td>
                <td>${item.name.substring(0, 18)}${item.name.length > 18 ? '...' : ''}</td>
                <td class="right">${this.formatCurrency(item.price)}</td>
                <td class="right">${this.formatCurrency(item.subtotal)}</td>
              </tr>
            `).join('')}
          </table>
  
          <!-- Totals Section -->
          <div>
            <div class="total-row">
              <span>Subtotal:</span>
              <span>${this.formatCurrency(sale.total - sale.impuestos)}</span>
            </div>
            ${sale.impuestos > 0 ? `
              <div class="total-row">
                <span>Impuestos:</span>
                <span>${this.formatCurrency(sale.impuestos)}</span>
              </div>
            ` : ''}
            ${sale.descuento > 0 ? `
              <div class="total-row">
                <span>Descuento:</span>
                <span>-${this.formatCurrency(sale.descuento)}</span>
              </div>
            ` : ''}
            <div class="grand-total">
              <span>TOTAL:</span>
              <span>${this.formatCurrency(sale.total)}</span>
            </div>
  
            <!-- Payment Information -->
            ${sale.metodo_pago === 'Efectivo' ? `
              <div class="total-row">
                <span>Recibido:</span>
                <span>${this.formatCurrency(sale.monto_recibido)}</span>
              </div>
              <div class="total-row">
                <span>Cambio:</span>
                <span>${this.formatCurrency(sale.cambio)}</span>
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
      console.error('Error generating thermal print HTML:', error);
      // Return a simplified fallback template
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura Simplificada</title>
          <style>
            body { font-family: Arial; padding: 10mm; }
          </style>
        </head>
        <body>
          <h2>Factura #${sale?.id || 'N/A'}</h2>
          <p>Fecha: ${new Date().toLocaleString()}</p>
          <p>Total: ${this.formatCurrency(sale?.total || 0)}</p>
          <p>Gracias por su compra</p>
          <p>WILPOS - Sistema de Punto de Venta</p>
        </body>
        </html>
      `;
    }
  }
  

  /**
   * Generate HTML content optimized for printing
   * @param sale The sale data to use for the invoice
   * @returns HTML string for printing
   */
  public generatePrintHTML(sale: PreviewSale): string {
    try {
      // Build a complete HTML document for printing
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
                    <td>${this.formatCurrency(item.price)}</td>
                    <td>${item.is_exempt ? 'Exento' : (item.itebis * 100).toFixed(0) + '%'}</td>
                    <td>${this.formatCurrency(item.subtotal)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="totals">
              <div><strong>Subtotal:</strong> ${this.formatCurrency(sale.total - sale.impuestos)}</div>
              <div><strong>ITBIS:</strong> ${this.formatCurrency(sale.impuestos)}</div>
              ${sale.descuento > 0 ? `<div><strong>Descuento:</strong> -${this.formatCurrency(sale.descuento)}</div>` : ''}
              <div class="total-line"><strong>TOTAL:</strong> ${this.formatCurrency(sale.total)}</div>
              
              ${sale.metodo_pago === 'Efectivo' ? `
                <div><strong>Monto recibido:</strong> ${this.formatCurrency(sale.monto_recibido)}</div>
                <div><strong>Cambio:</strong> ${this.formatCurrency(sale.cambio)}</div>
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
      console.error('Error generating print HTML:', error);
      // Return a simplified fallback template
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
          <h2>Factura #${sale?.id || 'N/A'}</h2>
          <p>Fecha: ${new Date().toLocaleString()}</p>
          <p>Total: ${this.formatCurrency(sale?.total || 0)}</p>
          <p>Gracias por su compra</p>
        </body>
        </html>
      `;
    }
  }

  // Método mejorado para formatear moneda
  private formatCurrency(amount: number): string {
    try {
      return new Intl.NumberFormat('es-DO', { 
        style: 'currency', 
        currency: 'DOP',
        minimumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      return `RD$ ${amount.toFixed(2)}`; // Formato alternativo
    }
  }

  // Calcular subtotal (total - impuestos)
  private calculateSubtotal(sale: PreviewSale): number {
    try {
      return sale.total - (sale.impuestos || 0);
    } catch (error) {
      return sale.total;
    }
  }
 }

export default InvoiceManager;