// src/utils/PrinterDiagnostic.ts
import ThermalPrintService from '../services/ThermalPrintService';
import ReceiptLineService from '../services/ReceiptLineService';
import { PrinterStatus } from '../types/printer';

export interface DiagnosticResult {
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: string[];
  printers?: Array<{
    name: string;
    isDefault?: boolean;
    isThermal?: boolean;
    portName?: string;
    status?: string;
  }>;
  activePrinter?: string | null;
  systemInfo?: Record<string, any>;
}

/**
 * Clase utilitaria para diagnosticar problemas de impresora
 * Proporciona herramientas para probar y solucionar problemas de conexión de impresoras
 */
export class PrinterDiagnostic {
  private thermalPrintService: ThermalPrintService;
  private receiptLineService: ReceiptLineService;
  
  constructor() {
    this.thermalPrintService = ThermalPrintService.getInstance();
    this.receiptLineService = ReceiptLineService.getInstance();
  }
  
  /**
   * Ejecutar un diagnóstico completo en el sistema de impresión
   * Comprueba impresoras disponibles, configuración y realiza pruebas de impresión
   */
  public async runFullDiagnostic(): Promise<DiagnosticResult> {
    try {
      // Comprobar entorno del sistema
      const systemInfo = await this.getSystemInfo();
      
      // Obtener todas las impresoras disponibles (usando ambos servicios)
      const printersThermal = await this.thermalPrintService.getAvailablePrinters(true);
      const printersReceiptLine = await this.receiptLineService.getAvailablePrinters(true);
      
      // Unificar lista de impresoras (eliminar duplicados por nombre)
      const printerNames = new Set();
      let printers = [...printersThermal];
      
      for (const printer of printersReceiptLine) {
        if (!printerNames.has(printer.name)) {
          printers.push(printer);
          printerNames.add(printer.name);
        }
      }
      
      if (!printers || printers.length === 0) {
        return {
          status: 'error',
          message: 'No se detectaron impresoras en el sistema',
          systemInfo
        };
      }
      
      // Detectar impresoras USB
      const usbPrinters = printers.filter(p =>
        (p.portName?.toLowerCase().includes('usb')) ||
        (p.name.toLowerCase().includes('usb')) ||
        (p.name.toLowerCase().includes('80mm'))
      );
      console.log('Impresoras USB detectadas:', usbPrinters);

      // Obtener estado actual de la impresora
      // Intentar con ambos servicios
      const activePrinter = this.receiptLineService.activePrinter || this.thermalPrintService.activePrinter;
      const printerStatus = activePrinter ? 
        await this.receiptLineService.checkPrinterStatus(activePrinter) : 
        { available: false, message: 'No hay impresora activa' };
      
      // Transformar info de impresora para la salida
      const printerList = printers.map(printer => ({
        name: printer.name,
        isDefault: printer.isDefault,
        isThermal: printer.isThermal,
        portName: printer.portName,
        status: printer.name === activePrinter ? 
          (printerStatus.available ? 'Activa' : 'Error') : 'Disponible'
      }));
      
      // Determinar estado general
      let status: 'success' | 'warning' | 'error' = 'success';
      let message = 'El sistema de impresión funciona correctamente';
      const details: string[] = [];
      
      // Comprobar si hay impresoras térmicas
      const thermalPrinters = printers.filter(p => p.isThermal);
      if (thermalPrinters.length === 0) {
        status = 'warning';
        message = 'No se detectaron impresoras térmicas';
        details.push('El sistema usará impresoras estándar para imprimir recibos');
      } else {
        details.push(`Se encontraron ${thermalPrinters.length} impresora(s) térmica(s)`);
        thermalPrinters.forEach(p => {
          details.push(`Impresora térmica: ${p.name}${p.portName ? ` (Puerto: ${p.portName})` : ''}`);
        });
      }
      
      // Comprobar si hay impresoras USB
      if (usbPrinters.length > 0) {
        details.push(`Se encontraron ${usbPrinters.length} impresora(s) USB`);
        status = 'success';
        message = 'Impresora USB detectada';
      }
      
      // Comprobar si la impresora activa está disponible
      if (activePrinter && !printerStatus.available) {
        status = 'warning';
        message = printerStatus.message || 'Impresora no disponible';
        details.push('No hay impresora funcional configurada para recibos');
      } else if (activePrinter) {
        details.push(`Impresora activa: ${activePrinter}`);
      }

      // Verificar si ReceiptLine está disponible
      try {
        const hasReceiptLine = typeof window.printerApi?.print === 'function';
        details.push(`ReceiptLine: ${hasReceiptLine ? 'Disponible' : 'No disponible'}`);
        
        if (!hasReceiptLine) {
          status = status === 'success' ? 'warning' : status;
          details.push('Se recomienda instalar ReceiptLine para mejor compatibilidad');
        }
      } catch (err) {
        details.push('No se pudo verificar ReceiptLine');
      }
      
      return {
        status,
        message,
        details,
        printers: printerList,
        activePrinter,
        systemInfo
      };
    } catch (error) {
      console.error('Error al ejecutar diagnóstico de impresora:', error);
      return {
        status: 'error',
        message: 'Error al ejecutar diagnóstico de impresora',
        details: [error instanceof Error ? error.message : 'Error desconocido']
      };
    }
  }
  
  /**
   * Probar una impresora específica
   * @param printerName Nombre de la impresora a probar
   * @param mode Modo de prueba: 'receipt' para recibos, 'label' para etiquetas
   */
  public async testPrinter(
    printerName?: string, 
    mode: 'receipt' | 'label' = 'receipt'
  ): Promise<DiagnosticResult> {
    try {
      const targetPrinter = printerName || (
        mode === 'receipt' 
          ? this.receiptLineService.activePrinter 
          : this.receiptLineService.activeLabelPrinter
      );
      
      if (!targetPrinter) {
        return {
          status: 'error',
          message: 'No se especificó impresora o no hay configurada'
        };
      }
      
      // Intentar imprimir una página de prueba usando ReceiptLine primero
      try {
        // Usar el servicio ReceiptLine para la prueba
        const result = await this.receiptLineService.testPrinter(targetPrinter, mode);
        
        if (result.success) {
          return {
            status: 'success',
            message: `Página de prueba enviada a ${targetPrinter}`,
            details: [result.message || 'Verifique la impresora para ver el resultado']
          };
        }
        
        // Si falló ReceiptLine, intentar con ThermalPrintService
        console.warn('La prueba con ReceiptLine falló, intentando con método alternativo:', result.error);
      } catch (err) {
        console.warn('Error al probar con ReceiptLine:', err);
      }
      
      // Fallback a ThermalPrintService para impresora térmica
      const result = await this.thermalPrintService.testPrinter(targetPrinter);
      
      if (result.success) {
        return {
          status: 'success',
          message: `Prueba enviada a ${targetPrinter}`,
          details: [result.message || 'Verifique la impresora para ver el resultado']
        };
      } else {
        return {
          status: 'error',
          message: `Error al imprimir en ${targetPrinter}`,
          details: [result.error || 'Error desconocido']
        };
      }
    } catch (error) {
      console.error('Error al probar impresora:', error);
      return {
        status: 'error',
        message: 'La prueba falló con excepción',
        details: [error instanceof Error ? error.message : 'Error desconocido']
      };
    }
  }
  
  /**
   * Obtener información del entorno del sistema
   * Recopila información sobre SO, Electron y versiones de la aplicación
   */
  public async getSystemInfo(): Promise<Record<string, any>> {
    const info: Record<string, any> = {
      timestamp: new Date().toISOString(),
      platform: 'Desconocido',
      electronVersion: 'Desconocido',
      nodeVersion: 'Desconocido',
      appVersion: 'Desconocido'
    };
    
    try {
      // Intentar obtener versiones de window.versions (desde preload)
      if (window.versions) {
        info.electronVersion = window.versions.electron();
        info.nodeVersion = window.versions.node();
        info.chromeVersion = window.versions.chrome();
      }
      
      // Intentar detectar plataforma desde navigator
      if (navigator.platform) {
        info.platform = navigator.platform;
      }
      
      // Obtener información básica de la aplicación - info de impresora se recopila en otro lugar
      if (window.api?.getAppPaths) {
        const paths = await window.api.getAppPaths();
        if (paths) {
          info.appPaths = {
            userData: paths.userData,
            docsPath: paths.documents
          };
        }
      }
      
      return info;
    } catch (error) {
      console.error('Error al obtener info del sistema:', error);
      return {
        ...info,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }
  
  /**
   * Probar apertura de cajón de dinero
   * @param printerName Nombre de impresora opcional
   */
  public async testCashDrawer(printerName?: string): Promise<DiagnosticResult> {
    try {
      // Intentar con ReceiptLine primero
      try {
        const result = await this.receiptLineService.openCashDrawer(printerName);
        
        if (result.success) {
          return {
            status: 'success',
            message: 'Comando de cajón enviado correctamente',
            details: ['Verifique si el cajón se abrió']
          };
        }
        
        console.warn('Apertura de cajón con ReceiptLine falló, intentando método alternativo:', result.error);
      } catch (err) {
        console.warn('Error con apertura ReceiptLine:', err);
      }
      
      // Fallback a ThermalPrintService
      const result = await this.thermalPrintService.openCashDrawer(printerName);
      
      if (result.success) {
        return {
          status: 'success',
          message: 'Comando de cajón enviado correctamente',
          details: ['Verifique si el cajón se abrió']
        };
      } else {
        return {
          status: 'error',
          message: 'Error al enviar comando de cajón',
          details: [result.error || 'La impresora podría no soportar control de cajón']
        };
      }
    } catch (error) {
      console.error('Error al probar cajón:', error);
      return {
        status: 'error',
        message: 'Prueba de cajón falló con excepción',
        details: [error instanceof Error ? error.message : 'Error desconocido']
      };
    }
  }
  
  /**
   * Crear un informe de diagnóstico detallado en formato HTML
   * Útil para soporte y solución de problemas
   */
  public async generateDiagnosticReport(): Promise<string> {
    try {
      const diagnosticResult = await this.runFullDiagnostic();
      const timestamp = new Date().toLocaleString();
      
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>WilPOS - Informe de Diagnóstico de Impresoras</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              line-height: 1.5;
            }
            h1, h2 {
              color: #333;
              border-bottom: 1px solid #ddd;
              padding-bottom: 5px;
            }
            .status {
              padding: 10px;
              margin: 10px 0;
              border-radius: 5px;
            }
            .success {
              background-color: #d4f7d4;
              border: 1px solid #34c240;
            }
            .warning {
              background-color: #fff4d4;
              border: 1px solid #ffc107;
            }
            .error {
              background-color: #ffd4d4;
              border: 1px solid #ff3b30;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f2f2f2;
            }
            .footer {
              margin-top: 40px;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <h1>WilPOS - Informe de Diagnóstico de Impresoras</h1>
          <p>Generado: ${timestamp}</p>
          
          <div class="status ${diagnosticResult.status}">
            <h2>Resultado del Diagnóstico: ${diagnosticResult.status.toUpperCase()}</h2>
            <p><strong>${diagnosticResult.message}</strong></p>
            ${diagnosticResult.details ? `
              <ul>
                ${diagnosticResult.details.map(detail => `<li>${detail}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
          
          <h2>Información de Impresoras</h2>
          ${diagnosticResult.printers && diagnosticResult.printers.length > 0 ? `
            <table>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Puerto</th>
                <th>Estado</th>
                <th>Predeterminada</th>
              </tr>
              ${diagnosticResult.printers.map(printer => `
                <tr>
                  <td>${printer.name}</td>
                  <td>${printer.isThermal ? 'Térmica' : 'Estándar'}</td>
                  <td>${printer.portName || 'N/A'}</td>
                  <td>${printer.status}</td>
                  <td>${printer.isDefault ? 'Sí' : 'No'}</td>
                </tr>
              `).join('')}
            </table>
            <p>Impresora activa: ${diagnosticResult.activePrinter || 'Ninguna'}</p>
          ` : '<p>No se detectaron impresoras</p>'}
          
          <h2>Información del Sistema</h2>
          ${diagnosticResult.systemInfo ? `
            <table>
              <tr>
                <th>Propiedad</th>
                <th>Valor</th>
              </tr>
              ${Object.entries(diagnosticResult.systemInfo).map(([key, value]) => `
                <tr>
                  <td>${key}</td>
                  <td>${JSON.stringify(value)}</td>
                </tr>
              `).join('')}
            </table>
          ` : '<p>Información del sistema no disponible</p>'}
          
          <div class="footer">
            <p>WilPOS - Sistema de Punto de Venta</p>
            <p>Para soporte, contacte al administrador del sistema</p>
          </div>
        </body>
        </html>
      `;
    } catch (error) {
      console.error('Error al generar informe de diagnóstico:', error);
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Informe de Error</title>
        </head>
        <body>
          <h1>Error al Generar Informe de Diagnóstico</h1>
          <p>${error instanceof Error ? error.message : 'Error desconocido'}</p>
        </body>
        </html>
      `;
    }
  }
}

export default PrinterDiagnostic;