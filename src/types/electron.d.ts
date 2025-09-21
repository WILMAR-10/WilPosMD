// src/types/electron.d.ts - Actualizado con API unificada
declare global {
  interface Window {
    versions: {
      node: () => string;
      chrome: () => string;
      electron: () => string;
    };

    api?: {
      // Window controls
      openFolder: (folderPath: string) => Promise<boolean>;
      minimize: () => Promise<boolean>;
      maximize: () => Promise<boolean>;
      close: () => Promise<boolean>;
      
      // Authentication
      login: (credentials: { username: string; password: string }) => Promise<{
        success: boolean;
        user?: any;
        message?: string;
      }>;
      logout: () => Promise<boolean>;
      
      // Database operations
      initializeDatabase: () => Promise<boolean>;
      getProducts: () => Promise<any[]>;
      addProduct: (product: any) => Promise<any>;
      updateProduct: (id: number, product: any) => Promise<any>;
      deleteProduct: (id: number) => Promise<boolean>;
      getCategories: () => Promise<any[]>;
      addCategory: (category: any) => Promise<any>;
      updateCategory: (id: number, category: any) => Promise<any>;
      deleteCategory: (id: number) => Promise<boolean>;
      getCustomers: () => Promise<any[]>;
      addCustomer: (customer: any) => Promise<any>;
      updateCustomer: (id: number, customer: any) => Promise<any>;
      deleteCustomer: (id: number) => Promise<boolean>;
      getUsers: () => Promise<any[]>;
      addUser: (user: any) => Promise<any>;
      updateUser: (id: number, user: any) => Promise<any>;
      deleteUser: (id: number) => Promise<boolean>;
      createSale: (sale: any, details?: any[]) => Promise<any>;
      getSales: (filters?: any) => Promise<any[]>;
      getSaleDetails: (id: number) => Promise<any>;
      cancelSale: (id: number) => Promise<{ success: boolean; error?: string }>;
      
      // Reports
      getDailySalesReport: (date: string) => Promise<any>;
      getMonthlyReport: (month: string, year: string) => Promise<any>;
      getSalesReport: (startDate: string, endDate: string) => Promise<any>;
      getTopProducts: (startDate: string, endDate: string, limit?: number) => Promise<any>;
      
      // Descuentos
      getDiscounts: () => Promise<any>;
      getDiscountById: (id: number) => Promise<any>;
      getActiveDiscounts: () => Promise<any>;
      createDiscount: (discount: any) => Promise<any>;
      updateDiscount: (id: number, discount: any) => Promise<any>;
      deleteDiscount: (id: number) => Promise<boolean>;
      toggleDiscountActive: (id: number) => Promise<boolean>;
      getApplicableDiscounts: (productos: any[], total: number, categoria?: string) => Promise<any>;
      getDiscountByCoupon: (codigo: string) => Promise<any>;
      
      // Ofertas
      getOffers: () => Promise<any>;
      getOfferById: (id: number) => Promise<any>;
      getActiveOffers: () => Promise<any>;
      createOffer: (offer: any) => Promise<any>;
      updateOffer: (id: number, offer: any) => Promise<any>;
      deleteOffer: (id: number) => Promise<boolean>;
      toggleOfferActive: (id: number) => Promise<boolean>;
      getApplicableOffers: (productos: any[]) => Promise<any>;
      calculateOfferDiscount: (offer: any, productos: any[]) => Promise<number>;
      
      // Descuentos aplicados
      getAppliedDiscounts: () => Promise<any>;
      getAppliedDiscountsByVenta: (ventaId: number) => Promise<any>;
      createAppliedDiscount: (appliedDiscount: any) => Promise<any>;
      getDiscountTotalsByPeriod: (startDate: string, endDate: string) => Promise<any>;
      getMostUsedDiscounts: (startDate: string, endDate: string, limit?: number) => Promise<any>;
      getDiscountEffectiveness: (startDate: string, endDate: string) => Promise<any>;
      
      // Reportes Financieros
      getBalanceSheet: (fechaHasta?: string) => Promise<any>;
      getIncomeStatement: (fechaInicio: string, fechaFin: string) => Promise<any>;
      getCashFlowStatement: (fechaInicio: string, fechaFin: string) => Promise<any>;
      
      // Settings
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<any>;
      
      // File system
      getAppPaths: () => Promise<{
        userData: string;
        documents: string;
        downloads: string;
        temp: string;
        exe: string;
        appData: string;
        appPath: string;
      }>;
      ensureDir: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
      
      // Window management
      openComponentWindow: (component: string) => Promise<{
        windowId: number;
        cached: boolean;
        success: boolean;
        error?: string;
      }>;
      identifyWindow: () => Promise<{
        type: string;
        id?: number;
        component?: string;
        error?: string;
      }>;
      
      // Sync events
      registerSyncListener: () => void;
      unregisterSyncListener: () => void;
      broadcastSyncEvent: (event: any) => void;
    };

    // API DE IMPRESIÓN UNIFICADA (nombre correcto)
    printerAPI: {
      // Obtener impresoras
      getPrinters: () => Promise<{
        success: boolean;
        printers: Array<{
          name: string;
          isDefault: boolean;
          status: string;
          isThermal: boolean;
          paperWidth: number | null;
        }>;
        error?: string;
      }>;

      // Imprimir factura
      printInvoice: (
        saleData: {
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
        },
        printerName: string
      ) => Promise<{
        success: boolean;
        error?: string;
        message?: string;
      }>;

      // Imprimir etiqueta
      printLabel: (
        labelData: {
          name: string;
          price: number;
          barcode?: string;
          category?: string;
        },
        printerName: string
      ) => Promise<{
        success: boolean;
        error?: string;
        message?: string;
      }>;

      // Imprimir código de barras
      printBarcode: (
        barcodeData: {
          text?: string;
          barcode?: string;
          name?: string;
          price?: number;
        },
        printerName: string
      ) => Promise<{
        success: boolean;
        error?: string;
        message?: string;
      }>;

      // Imprimir código QR
      printQR: (
        qrData: {
          text?: string;
          url?: string;
          title?: string;
        },
        printerName: string
      ) => Promise<{
        success: boolean;
        error?: string;
        message?: string;
      }>;

      // Imprimir datos raw
      printRaw: (
        data: string | Uint8Array,
        printerName: string
      ) => Promise<{
        success: boolean;
        error?: string;
        message?: string;
      }>;

      // Probar impresora
      testPrinter: (printerName: string) => Promise<{
        success: boolean;
        error?: string;
        message?: string;
      }>;

      // Abrir cajón de dinero
      openCashDrawer: (printerName: string) => Promise<{
        success: boolean;
        error?: string;
        message?: string;
      }>;

      // Guardar PDF
      savePdf: (options: {
        html: string;
        path: string;
        printBackground?: boolean;
        margins?: {
          top?: number;
          right?: number;
          bottom?: number;
          left?: number;
        };
        format?: string;
      }) => Promise<{
        success: boolean;
        path?: string;
        error?: string;
      }>;
    };

    // Mantener compatibilidad con APIs anteriores
    printApi?: {
      getPrinters: () => Promise<{ success: boolean; printers: any[]; error?: string }>;
      printFactura: (html: string, printerName: string) => Promise<{ success: boolean; error?: string }>;
      printEtiqueta: (html: string, printerName: string) => Promise<{ success: boolean; error?: string }>;
      printBarcode: (html: string, printerName: string) => Promise<{ success: boolean; error?: string }>;
      printQR: (html: string, printerName: string) => Promise<{ success: boolean; error?: string }>;
      printRaw: (data: string | Uint8Array, printerName?: string) => Promise<{ success: boolean; error?: string }>;
      testPrinter: (printerName?: string) => Promise<{ success: boolean; error?: string }>;
      savePdf: (options: any) => Promise<{ success: boolean; path?: string; error?: string }>;
    };

    printerApi?: {
      getPrinters: () => Promise<{ success: boolean; printers: any[]; error?: string }>;
      printRaw: (data: string | Uint8Array, printerName?: string) => Promise<{ success: boolean; error?: string }>;
      testPrinter: (printerName?: string) => Promise<{ success: boolean; error?: string }>;
      savePdf: (options: any) => Promise<{ success: boolean; path?: string; error?: string }>;
      printFactura: (html: string, printerName: string) => Promise<{ success: boolean; error?: string }>;
      printEtiqueta: (html: string, printerName: string) => Promise<{ success: boolean; error?: string }>;
      printBarcode: (html: string, printerName: string) => Promise<{ success: boolean; error?: string }>;
      printQR: (html: string, printerName: string) => Promise<{ success: boolean; error?: string }>;
      openCashDrawer: (printerName: string) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

export {};