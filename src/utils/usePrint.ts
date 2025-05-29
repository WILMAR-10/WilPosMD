// src/hooks/usePrint.ts
import { useState, useEffect, useCallback } from 'react';
import { printService, PrinterInfo, PrintOptions, PrintResult } from '../services/PrintService';
import { PreviewSale } from '../types/sales';
import { useSettings } from '../services/DatabaseService';

export interface UsePrintReturn {
  // Estado
  printers: PrinterInfo[];
  loading: boolean;
  error: string | null;
  
  // Acciones
  refreshPrinters: () => Promise<void>;
  printInvoice: (sale: PreviewSale, options?: PrintOptions) => Promise<PrintResult>;
  printLabel: (productData: {
    name: string;
    price: number;
    barcode?: string;
    category?: string;
  }, quantity?: number, options?: PrintOptions) => Promise<PrintResult>;
  testPrint: (printerName?: string) => Promise<PrintResult>;
  openDrawer: (printerName?: string) => Promise<PrintResult>;
  
  // Utilidades
  getCurrentPrinter: () => string | null;
  isReady: boolean;
}

/**
 * Hook para manejo de impresión - Principio de Responsabilidad Única
 * Encapsula toda la lógica de impresión para componentes React
 */
export function usePrint(): UsePrintReturn {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useSettings();

  // Inicializar servicio cuando cambian las configuraciones
  useEffect(() => {
    if (settings) {
      printService.initialize({
        nombre_negocio: settings.nombre_negocio,
        direccion: settings.direccion,
        telefono: settings.telefono,
        rnc: settings.rnc,
        mensaje_recibo: settings.mensaje_recibo,
        moneda: settings.moneda,
        impresora_termica: settings.impresora_termica,
        auto_cut: settings.auto_cut,
        open_cash_drawer: settings.open_cash_drawer,
      }).then(() => {
        refreshPrinters();
      });
    }
  }, [settings]);

  // Actualizar lista de impresoras
  const refreshPrinters = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const printerList = await printService.refreshPrinters();
      setPrinters(printerList);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al obtener impresoras';
      setError(errorMessage);
      console.error('Error refreshing printers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Wrapper para imprimir factura con manejo de errores
  const printInvoice = useCallback(async (sale: PreviewSale, options?: PrintOptions): Promise<PrintResult> => {
    try {
      setError(null);
      return await printService.printInvoice(sale, options);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al imprimir factura';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  // Wrapper para imprimir etiqueta con manejo de errores
  const printLabel = useCallback(async (
    productData: {
      name: string;
      price: number;
      barcode?: string;
      category?: string;
    }, 
    quantity = 1, 
    options?: PrintOptions
  ): Promise<PrintResult> => {
    try {
      setError(null);
      return await printService.printLabel(productData, quantity, options);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al imprimir etiqueta';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  // Wrapper para prueba de impresión
  const testPrint = useCallback(async (printerName?: string): Promise<PrintResult> => {
    try {
      setError(null);
      return await printService.testPrint(printerName);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error en prueba de impresión';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  // Wrapper para abrir cajón
  const openDrawer = useCallback(async (printerName?: string): Promise<PrintResult> => {
    try {
      setError(null);
      return await printService.openDrawer(printerName);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al abrir cajón';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  // Obtener impresora actual
  const getCurrentPrinter = useCallback(() => {
    return printService.getCurrentPrinter();
  }, []);

  // Determinar si el servicio está listo
  const isReady = !loading && printers.length > 0 && !!settings;

  return {
    // Estado
    printers,
    loading,
    error,
    
    // Acciones
    refreshPrinters,
    printInvoice,
    printLabel,
    testPrint,
    openDrawer,
    
    // Utilidades
    getCurrentPrinter,
    isReady
  };
}

/**
 * Hook simplificado para casos básicos de impresión
 */
export function useSimplePrint() {
  const { printInvoice, testPrint, isReady, error } = usePrint();
  
  return {
    printInvoice,
    testPrint,
    isReady,
    error
  };
}