// src/services/InvoiceManager.ts
import { PreviewSale } from '../types/sales';
import ThermalPrintService from './ThermalPrintService';
import ReceiptLineService from './ReceiptLineService';
import { PrintInvoiceOptions, SavePdfOptions } from '../types/printer';

/**
 * Gestiona la generación de facturas, impresión y creación de PDF
 * Maneja tanto impresión térmica como estándar
 */
export default class InvoiceManager {
  private static instance: InvoiceManager;
  private thermalPrintService: ThermalPrintService;
  private receiptLineService: ReceiptLineService;
  
  // Constructor privado (patrón singleton)
  private constructor() {
    this.thermalPrintService = ThermalPrintService.getInstance();
    this.receiptLineService = ReceiptLineService.getInstance();
  }
  
  // Obtener instancia singleton
  public static getInstance(): InvoiceManager {
    if (!InvoiceManager.instance) {
      InvoiceManager.instance = new InvoiceManager();
    }
    return InvoiceManager.instance;
  }
  
  /**
   * Imprimir factura con mejor manejo de errores y opciones de fallback
   * @param sale Datos de la venta a imprimir
   * @param htmlContent Representación HTML de la factura
   * @param options Opciones de impresión
   * @returns Estado de éxito
   */
  public async printInvoice(sale: PreviewSale, htmlContent: string, options?: PrintInvoiceOptions): Promise<boolean> {
    try {
      // Obtener configuración o usar valores predeterminados
      const settings = await this.getSettings();
      
      // Intentar primero con el nuevo servicio ReceiptLine (primera opción)
      try {
        const result = await this.receiptLineService.printReceipt(
          sale,
          settings,
          options?.printerName || settings?.impresora_termica
        );
        
        if (result.success) {
          console.log('Factura impresa correctamente con ReceiptLine');
          return true;
        }
        
        console.warn('Impresión con ReceiptLine falló, usando método alternativo:', result.error);
      } catch (error) {
        console.warn('Error con ReceiptLine, usando método alternativo:', error);
      }
      
      // Determinar si debemos usar impresora térmica
      const useThermal = !!settings?.impresora_termica;
      
      // Para impresión térmica (ESC/POS)
      if (useThermal && settings?.impresora_termica) {
        const printerStatus = await this.thermalPrintService.checkPrinterStatus(settings.impresora_termica);
        
        if (printerStatus.available) {
          // Preparar datos del recibo a partir de la venta
          const receiptData = this.thermalPrintService.prepareReceiptData(sale, settings);
          
          // Imprimir usando servicio térmico
          const result = await this.thermalPrintService.printReceipt(
            receiptData,
            settings.impresora_termica
          );
          
          if (result.success) {
            return true;
          }
          
          // Registrar fallo pero continuar al fallback
          console.warn('Impresión térmica falló, probando impresión estándar:', result.error);
        }
      }
      
      // Para impresión HTML regular como fallback
      return await this.printHtml(htmlContent, options, settings);
    } catch (error) {
      console.error('Error de impresión de factura:', error);
      
      // Intentar impresión de fallback como último recurso
      try {
        if (typeof window.print === 'function') {
          window.print();
          return true;
        }
      } catch (fallbackError) {
        console.error('Impresión de fallback falló:', fallbackError);
      }
      
      throw error;
    }
  }
  
  /**
   * Impresión HTML mejorada con mejor manejo de errores
   * @param htmlContent HTML a imprimir
   * @param options Opciones de impresión
   * @param settings Configuración de la app
   * @returns Estado de éxito
   */
  private async printHtml(htmlContent: string, options?: PrintInvoiceOptions, settings?: any): Promise<boolean> {
    try {
      // Usar window.printerApi.print si está disponible
      if (window.printerApi?.print) {
        // Preparar opciones de impresión con valores predeterminados
        const printOptions = {
          html: htmlContent,
          printerName: options?.printerName || settings?.impresora_termica,
          silent: options?.silent !== false,
          copies: options?.copies || 1,
          options: {
            paperWidth: options?.options?.paperWidth || 
              (settings?.tipo_impresora === 'termica58' ? '58mm' : '80mm'),
            printSpeed: options?.options?.printSpeed || 'normal',
            fontSize: options?.options?.fontSize || 'normal',
            thermalPrinter: true,
            ...options?.options
          }
        };
        
        const result = await window.printerApi.print(printOptions);
        if (!result.success) {
          throw new Error(result.error || 'Error de impresión desconocido');
        }
        return true;
      }
      
      // Si API print no está disponible, intentar window.print()
      if (typeof window.print === 'function') {
        // Crear iframe oculto para impresión
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        // Establecer contenido e imprimir
        if (iframe.contentDocument) {
          iframe.contentDocument.open();
          iframe.contentDocument.write(htmlContent);
          iframe.contentDocument.close();
          
          // Esperar a que el contenido se cargue antes de imprimir
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (iframe.contentWindow) {
            iframe.contentWindow.print();
          }
        }
        
        // Limpiar después de imprimir
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
        
        return true;
      }
      
      throw new Error('No hay método de impresión disponible');
    } catch (error) {
      console.error('Error de impresión HTML:', error);
      throw error;
    }
  }
  
  /**
   * Guardar factura como PDF con mejor manejo de errores
   * @param sale Datos de venta para la factura
   * @param htmlContent Representación HTML de la factura
   * @param options Opciones de guardado
   * @returns Ruta al PDF guardado
   */
  public async saveAsPdf(sale: PreviewSale, htmlContent: string, options?: {
    directory?: string;
    filename?: string;
    overwrite?: boolean;
  }): Promise<string | undefined> {
    try {
      // Comprobar si la API PDF está disponible
      const hasPdfApi = !!(window.printerApi?.savePdf || window.api?.savePdf);
      
      if (!hasPdfApi) {
        throw new Error('API PDF no disponible');
      }
      
      // Obtener directorio predeterminado si no se especifica
      let directory = options?.directory;
      if (!directory) {
        const settings = await this.getSettings();
        directory = settings?.ruta_pdf;
        
        if (!directory) {
          // Probar diferentes métodos para obtener una ruta predeterminada
          if (window.printerApi?.getPdfPath) {
            const pdfPath = await window.printerApi.getPdfPath();
            directory = pdfPath || undefined;
          } else if (window.api?.getAppPaths) {
            const paths = await window.api.getAppPaths();
            directory = `${paths.userData}/facturas`;
          }
        }
        
        if (!directory) {
          throw new Error('No se especificó directorio y no se pudo obtener ruta predeterminada');
        }
        
        // Asegurar que el directorio existe
        if (window.api?.ensureDir) {
          await window.api.ensureDir(directory);
        }
      }
      
      // Generar nombre de archivo único si no se proporciona
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = options?.filename || 
        `factura-${sale.id || 'nueva'}-${timestamp}.pdf`;
      
      // Crear ruta completa
      const fullPath = `${directory}/${filename}`;
      
      // Preparar opciones de guardado
      const saveOptions = {
        path: fullPath,
        html: htmlContent,
        options: {
          printBackground: true,
          margins: {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
          }
        }
      };
      
      // Guardar en PDF usando la API disponible
      const savePdfFn = window.printerApi?.savePdf || window.api?.savePdf;
      if (savePdfFn) {
        const result = await savePdfFn(saveOptions);
        
        if (!result.success) {
          throw new Error(result.error || 'Error de PDF desconocido');
        }
        
        return result.path || fullPath;
      }
      
      throw new Error('Función de guardado PDF no disponible');
    } catch (error) {
      console.error('Error al guardar PDF:', error);
      throw error;
    }
  }
  
  /**
   * Obtención de configuración mejorada con caché
   */
  private settingsCache: any = null;
  private settingsCacheTime: number = 0;
  private settingsCacheExpiration: number = 30000; // 30 segundos
  
  private async getSettings(): Promise<any> {
    try {
      const now = Date.now();
      
      // Devolver configuración en caché si es válida
      if (this.settingsCache && (now - this.settingsCacheTime) < this.settingsCacheExpiration) {
        return this.settingsCache;
      }
      
      if (window.api?.getSettings) {
        const settings = await window.api.getSettings();
        
        // Actualizar caché
        this.settingsCache = settings;
        this.settingsCacheTime = now;
        
        return settings;
      }
      
      return null;
    } catch (error) {
      console.error('Error al cargar configuración:', error);
      
      // Devolver caché incluso si ha expirado en caso de error
      if (this.settingsCache) {
        return this.settingsCache;
      }
      
      return null;
    }
  }
}