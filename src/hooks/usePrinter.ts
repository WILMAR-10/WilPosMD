// src/hooks/usePrinter.ts - Hook unificado y simplificado con guardado
import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../services/DatabaseService';

// Tipos unificados
export interface PrinterInfo {
  name: string;
  isDefault: boolean;
  status: string;
  isThermal: boolean;
  paperWidth: number | null;
}

export interface PrintResult {
  success: boolean;
  error?: string;
  message?: string;
}

export interface PrintOptions {
  copies?: number;
  openDrawer?: boolean;
  cutPaper?: boolean;
}

export interface InvoiceData {
  id?: number;
  businessName?: string;
  businessInfo?: string;
  fecha_venta: string;
  cliente: string;
  usuario?: string;
  total: number;
  subtotal?: number;
  impuestos?: number;
  descuento?: number;
  metodo_pago: string;
  monto_recibido?: number;
  cambio?: number;
  mensaje?: string;
  detalles: Array<{
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
}

export interface LabelData {
  name: string;
  price: number;
  barcode?: string;
  category?: string;
}

export interface BarcodeData {
  text?: string;
  barcode?: string;
  name?: string;
  price?: number;
}

export interface QRData {
  text?: string;
  url?: string;
  title?: string;
}

/**
 * Hook principal UNIFICADO para impresión
 */
export function usePrinter() {
  const { settings, saveSettings } = useSettings();
  
  // Estados
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Configuración
  const [invoicePrinter, setInvoicePrinter] = useState<string | null>(null);
  const [labelPrinter, setLabelPrinter] = useState<string | null>(null);

  // Cargar configuración inicial
  useEffect(() => {
    if (settings) {
      setInvoicePrinter(settings.impresora_termica || null);
      setLabelPrinter(settings.impresora_etiquetas || null);
      setIsReady(true);
    }
  }, [settings]);

  // Cargar impresoras al inicio
  useEffect(() => {
    refreshPrinters();
  }, []);

  // Escuchar cambios de configuración de otros componentes
  useEffect(() => {
    const handleConfigUpdate = (event: CustomEvent) => {
      const { invoicePrinter: newInvoice, labelPrinter: newLabel } = event.detail;
      setInvoicePrinter(newInvoice || null);
      setLabelPrinter(newLabel || null);
    };

    window.addEventListener('printer-config-updated', handleConfigUpdate as EventListener);
    
    return () => {
      window.removeEventListener('printer-config-updated', handleConfigUpdate as EventListener);
    };
  }, []);

  /**
   * Actualizar lista de impresoras
   */
  const refreshPrinters = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Usar printerAPI (con mayúscula) si está disponible, sino usar printerApi
      let apiToUse = window.printerAPI || window.printerApi;
      
      if (!apiToUse?.getPrinters) {
        throw new Error('API de impresión no disponible');
      }

      const result = await apiToUse.getPrinters();
      
      if (result.success) {
        setPrinters(result.printers || []);
        console.log(`🖨️ Encontradas ${result.printers?.length || 0} impresoras`);
      } else {
        throw new Error(result.error || 'Error al obtener impresoras');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
      console.error('Error refreshing printers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Limpiar errores
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Guardar configuración de impresoras
   */
  const savePrinterConfig = useCallback(async (config: { 
    invoicePrinter?: string; 
    labelPrinter?: string; 
  }) => {
    try {
      if (!settings) {
        throw new Error('No se pueden cargar las configuraciones actuales');
      }

      const updatedSettings = {
        ...settings,
        impresora_termica: config.invoicePrinter || invoicePrinter || '',
        impresora_etiquetas: config.labelPrinter || labelPrinter || ''
      };

      const result = await saveSettings(updatedSettings);
      
      if (result) {
        // Actualizar estado local
        if (config.invoicePrinter !== undefined) {
          setInvoicePrinter(config.invoicePrinter);
        }
        if (config.labelPrinter !== undefined) {
          setLabelPrinter(config.labelPrinter);
        }

        return { success: true };
      } else {
        throw new Error('No se recibió confirmación del guardado');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('Error saving printer config:', err);
      return { success: false, error: errorMsg };
    }
  }, [settings, saveSettings, invoicePrinter, labelPrinter]);

  /**
   * Probar impresora con contenido de prueba
   */
  const testPrinter = useCallback(async (printerName: string): Promise<PrintResult> => {
    try {
      let apiToUse = window.printerAPI || window.printerApi;
      
      if (!apiToUse?.testPrinter) {
        throw new Error('Función de prueba no disponible');
      }

      const result = await apiToUse.testPrinter(printerName);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al probar impresora';
      console.error('Test printer error:', err);
      return { success: false, error: errorMsg };
    }
  }, []);

  /**
   * Abrir cajón de dinero
   */
  const openCashDrawer = useCallback(async (printerName?: string): Promise<PrintResult> => {
    try {
      let apiToUse = window.printerAPI || window.printerApi;
      
      if (!apiToUse?.openCashDrawer) {
        throw new Error('Función de cajón no disponible');
      }

      const targetPrinter = printerName || invoicePrinter;
      if (!targetPrinter) {
        throw new Error('No hay impresora configurada para el cajón');
      }

      const result = await apiToUse.openCashDrawer(targetPrinter);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al abrir cajón';
      console.error('Open cash drawer error:', err);
      return { success: false, error: errorMsg };
    }
  }, [invoicePrinter]);

  /**
   * Imprimir factura
   */
  const printInvoice = useCallback(async (
    data: InvoiceData, 
    options: PrintOptions = {}
  ): Promise<PrintResult> => {
    try {
      if (!invoicePrinter) {
        throw new Error('No hay impresora configurada para facturas');
      }

      let apiToUse = window.printerAPI || window.printerApi;
      
      if (!apiToUse?.printInvoice) {
        throw new Error('Función de impresión de facturas no disponible');
      }

      // Aplicar configuraciones por defecto
      const printOptions = {
        openDrawer: settings?.open_cash_drawer || false,
        cutPaper: settings?.auto_cut !== false,
        copies: 1,
        ...options
      };

      // La API espera 2 parámetros: datos y nombre de impresora
      const result = await apiToUse.printInvoice(data, invoicePrinter);

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al imprimir factura';
      console.error('Print invoice error:', err);
      return { success: false, error: errorMsg };
    }
  }, [invoicePrinter, settings]);

  /**
   * Imprimir etiqueta
   */
  const printLabel = useCallback(async (
    data: LabelData,
    options: PrintOptions = {}
  ): Promise<PrintResult> => {
    try {
      if (!labelPrinter) {
        throw new Error('No hay impresora configurada para etiquetas');
      }

      let apiToUse = window.printerAPI || window.printerApi;
      
      if (!apiToUse?.printLabel) {
        throw new Error('Función de impresión de etiquetas no disponible');
      }

      const printOptions = {
        cutPaper: settings?.auto_cut !== false,
        copies: 1,
        ...options
      };

      const result = await apiToUse.printLabel(data, labelPrinter);

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al imprimir etiqueta';
      console.error('Print label error:', err);
      return { success: false, error: errorMsg };
    }
  }, [labelPrinter, settings]);

  /**
   * Imprimir código de barras
   */
  const printBarcode = useCallback(async (
    data: BarcodeData,
    options: PrintOptions = {}
  ): Promise<PrintResult> => {
    try {
      const targetPrinter = labelPrinter || invoicePrinter;
      if (!targetPrinter) {
        throw new Error('No hay impresora configurada');
      }

      let apiToUse = window.printerAPI || window.printerApi;
      
      if (!apiToUse?.printBarcode) {
        throw new Error('Función de impresión de códigos de barras no disponible');
      }

      const printOptions = {
        cutPaper: settings?.auto_cut !== false,
        copies: 1,
        ...options
      };

      const result = await apiToUse.printBarcode(data, targetPrinter);

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al imprimir código de barras';
      console.error('Print barcode error:', err);
      return { success: false, error: errorMsg };
    }
  }, [labelPrinter, invoicePrinter, settings]);

  /**
   * Imprimir código QR
   */
  const printQR = useCallback(async (
    data: QRData,
    options: PrintOptions = {}
  ): Promise<PrintResult> => {
    try {
      const targetPrinter = labelPrinter || invoicePrinter;
      if (!targetPrinter) {
        throw new Error('No hay impresora configurada');
      }

      let apiToUse = window.printerAPI || window.printerApi;
      
      if (!apiToUse?.printQR) {
        throw new Error('Función de impresión de códigos QR no disponible');
      }

      const printOptions = {
        cutPaper: settings?.auto_cut !== false,
        copies: 1,
        ...options
      };

      const result = await apiToUse.printQR(data, targetPrinter);

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al imprimir código QR';
      console.error('Print QR error:', err);
      return { success: false, error: errorMsg };
    }
  }, [labelPrinter, invoicePrinter, settings]);

  /**
   * Verificar si hay impresoras configuradas
   */
  const hasConfiguredPrinters = useCallback(() => {
    return !!(invoicePrinter || labelPrinter);
  }, [invoicePrinter, labelPrinter]);

  /**
   * Obtener impresora recomendada para facturas
   */
  const getRecommendedInvoicePrinter = useCallback(() => {
    // Priorizar impresoras térmicas
    const thermal = printers.find(p => p.isThermal && p.status === 'ready');
    if (thermal) return thermal.name;

    // Impresora por defecto del sistema
    const defaultPrinter = printers.find(p => p.isDefault && p.status === 'ready');
    if (defaultPrinter) return defaultPrinter.name;

    // Primera impresora disponible
    const available = printers.find(p => p.status === 'ready');
    return available?.name || null;
  }, [printers]);

  return {
    // Estados
    printers,
    loading,
    error,
    isReady,

    // Configuración actual
    invoicePrinter,
    labelPrinter,

    // Acciones principales
    refreshPrinters,
    clearError,
    savePrinterConfig,

    // Funciones de impresión
    testPrinter,
    openCashDrawer,
    printInvoice,
    printLabel,
    printBarcode,
    printQR,

    // Utilidades
    hasConfiguredPrinters,
    getRecommendedInvoicePrinter
  };
}