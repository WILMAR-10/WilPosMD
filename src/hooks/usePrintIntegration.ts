// src/hooks/usePrintIntegration.ts - Hook para integración de impresión con otros componentes
import { useCallback } from 'react';
import { usePrinter, InvoiceData, LabelData, PrintOptions } from './usePrinter';
import { useSettings } from '../services/DatabaseService';

/**
 * Hook especializado para integración de impresión con componentes del sistema
 * Maneja automáticamente las configuraciones y proporciona funciones simplificadas
 */
export function usePrintIntegration() {
  const { settings } = useSettings();
  const {
    invoicePrinter,
    labelPrinter,
    hasConfiguredPrinters,
    printInvoice,
    printLabel,
    printBarcode,
    openCashDrawer,
    isReady
  } = usePrinter();

  /**
   * Verificar si el sistema de impresión está listo
   */
  const isPrintSystemReady = useCallback(() => {
    return isReady && hasConfiguredPrinters();
  }, [isReady, hasConfiguredPrinters]);

  /**
   * Obtener configuraciones de impresión del sistema
   */
  const getPrintSettings = useCallback(() => {
    return {
      invoicePrinter: invoicePrinter || '',
      labelPrinter: labelPrinter || '',
      autoCut: settings?.auto_cut !== false,
      openCashDrawer: settings?.open_cash_drawer || false,
      businessName: settings?.nombre_negocio || 'WilPOS',
      businessAddress: settings?.direccion || '',
      businessPhone: settings?.telefono || '',
      businessEmail: settings?.email || '',
      businessRNC: settings?.rnc || '',
      businessWebsite: settings?.sitio_web || '',
      currency: settings?.moneda || 'RD$',
      taxName: settings?.impuesto_nombre || 'ITEBIS',
      taxRate: settings?.impuesto_porcentaje || 0.18,
      thankYouMessage: settings?.mensaje_recibo || 'Gracias por su compra',
      logo: settings?.logo || undefined
    };
  }, [settings, invoicePrinter, labelPrinter]);

  /**
   * Imprimir factura desde Caja con configuraciones automáticas
   */
  const printSaleInvoice = useCallback(async (saleData: {
    id?: number;
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
    detalles: Array<{
      name: string;
      quantity: number;
      price: number;
      subtotal: number;
    }>;
  }, options?: Partial<PrintOptions>) => {
    try {
      if (!isPrintSystemReady()) {
        throw new Error('Sistema de impresión no configurado. Ve a Configuración > Impresoras');
      }

      const printSettings = getPrintSettings();
      
      // Construir datos de factura con información del negocio
      const invoiceData: InvoiceData = {
        ...saleData,
        businessName: printSettings.businessName,
        businessInfo: [
          printSettings.businessAddress,
          printSettings.businessPhone,
          printSettings.businessEmail,
          printSettings.businessRNC ? `RNC: ${printSettings.businessRNC}` : '',
          printSettings.businessWebsite
        ].filter(Boolean).join('\n'),
        mensaje: printSettings.thankYouMessage
      };

      // Opciones de impresión con configuraciones del sistema
      const printOptions: PrintOptions = {
        openDrawer: printSettings.openCashDrawer,
        cutPaper: printSettings.autoCut,
        copies: 1,
        ...options
      };

      const result = await printInvoice(invoiceData, printOptions);
      
      if (!result.success) {
        throw new Error(result.error || 'Error al imprimir factura');
      }

      return {
        success: true,
        message: 'Factura impresa correctamente',
        drawerOpened: printSettings.openCashDrawer
      };

    } catch (error) {
      console.error('Error printing sale invoice:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al imprimir'
      };
    }
  }, [isPrintSystemReady, getPrintSettings, printInvoice]);

  /**
   * Imprimir etiqueta de producto desde Inventario
   */
  const printProductLabel = useCallback(async (product: {
    name: string;
    price: number;
    barcode?: string;
    category?: string;
  }, copies: number = 1) => {
    try {
      if (!isPrintSystemReady()) {
        throw new Error('Sistema de impresión no configurado. Ve a Configuración > Impresoras');
      }

      const labelData: LabelData = {
        name: product.name,
        price: product.price,
        barcode: product.barcode,
        category: product.category
      };

      const printSettings = getPrintSettings();
      const printOptions: PrintOptions = {
        cutPaper: printSettings.autoCut,
        copies
      };

      const result = await printLabel(labelData, printOptions);
      
      if (!result.success) {
        throw new Error(result.error || 'Error al imprimir etiqueta');
      }

      return {
        success: true,
        message: `Etiqueta${copies > 1 ? 's' : ''} impresa${copies > 1 ? 's' : ''} correctamente`
      };

    } catch (error) {
      console.error('Error printing product label:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al imprimir'
      };
    }
  }, [isPrintSystemReady, printLabel]);

  /**
   * Imprimir código de barras para productos
   */
  const printProductBarcode = useCallback(async (product: {
    name?: string;
    barcode: string;
    price?: number;
  }, copies: number = 1) => {
    try {
      if (!isPrintSystemReady()) {
        throw new Error('Sistema de impresión no configurado. Ve a Configuración > Impresoras');
      }

      const result = await printBarcode({
        text: product.barcode,
        barcode: product.barcode,
        name: product.name,
        price: product.price
      }, {
        copies,
        cutPaper: getPrintSettings().autoCut
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Error al imprimir código de barras');
      }

      return {
        success: true,
        message: `Código${copies > 1 ? 's' : ''} de barras impreso${copies > 1 ? 's' : ''} correctamente`
      };

    } catch (error) {
      console.error('Error printing barcode:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al imprimir'
      };
    }
  }, [isPrintSystemReady, printBarcode, getPrintSettings]);

  /**
   * Abrir cajón de dinero (para uso en Caja)
   */
  const openDrawer = useCallback(async () => {
    try {
      if (!invoicePrinter) {
        throw new Error('No hay impresora configurada para abrir el cajón');
      }

      const result = await openCashDrawer();
      
      if (!result.success) {
        throw new Error(result.error || 'Error al abrir cajón');
      }

      return {
        success: true,
        message: 'Cajón abierto correctamente'
      };

    } catch (error) {
      console.error('Error opening cash drawer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al abrir cajón'
      };
    }
  }, [invoicePrinter, openCashDrawer]);

  /**
   * Verificar estado del sistema de impresión
   */
  const getSystemStatus = useCallback(() => {
    const status = {
      ready: isPrintSystemReady(),
      invoicePrinter: invoicePrinter || null,
      labelPrinter: labelPrinter || null,
      hasInvoicePrinter: !!invoicePrinter,
      hasLabelPrinter: !!labelPrinter,
      settings: getPrintSettings()
    };

    let message = '';
    let level: 'success' | 'warning' | 'error' = 'success';

    if (!status.ready) {
      message = 'Sistema de impresión no configurado';
      level = 'error';
    } else if (!status.hasInvoicePrinter) {
      message = 'Impresora de facturas no configurada';
      level = 'warning';
    } else if (!status.hasLabelPrinter) {
      message = 'Impresora de etiquetas no configurada (opcional)';
      level = 'warning';
    } else {
      message = 'Sistema de impresión configurado correctamente';
      level = 'success';
    }

    return {
      ...status,
      message,
      level
    };
  }, [isPrintSystemReady, invoicePrinter, labelPrinter, getPrintSettings]);

  /**
   * Obtener recomendaciones de configuración
   */
  const getConfigurationTips = useCallback(() => {
    const tips: string[] = [];
    
    if (!invoicePrinter) {
      tips.push('Configura una impresora para facturas en Configuración > Impresoras');
    }
    
    if (!labelPrinter) {
      tips.push('Opcionalmente, configura una impresora para etiquetas de productos');
    }
    
    if (settings?.open_cash_drawer && !invoicePrinter) {
      tips.push('Para usar el cajón automático, necesitas configurar una impresora de facturas');
    }
    
    if (!settings?.auto_cut) {
      tips.push('Activa el corte automático para mejorar la experiencia de impresión');
    }

    return tips;
  }, [invoicePrinter, labelPrinter, settings]);

  return {
    // Estado del sistema
    isPrintSystemReady,
    getSystemStatus,
    getConfigurationTips,

    // Configuraciones
    getPrintSettings,

    // Funciones de impresión especializadas
    printSaleInvoice,
    printProductLabel,
    printProductBarcode,
    openDrawer,

    // Información del sistema
    hasInvoicePrinter: !!invoicePrinter,
    hasLabelPrinter: !!labelPrinter,
    invoicePrinterName: invoicePrinter,
    labelPrinterName: labelPrinter
  };
}

export default usePrintIntegration;