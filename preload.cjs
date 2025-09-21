// preload.cjs - Versión unificada con sistema de impresión corregido
const { contextBridge, ipcRenderer } = require('electron');

/**
 * Utility para crear wrappers de IPC con manejo de errores consistente
 */
function createIpcWrapper(channel) {
  return async (...args) => {
    try {
      return await ipcRenderer.invoke(channel, ...args);
    } catch (error) {
      console.error(`Error en ${channel}:`, error);
      return { success: false, error: error.message };
    }
  };
}

/**
 * Crear múltiples wrappers de una vez
 */
function createIpcWrappers(channels) {
  const wrappers = {};
  channels.forEach(channel => {
    const methodName = channel.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    wrappers[methodName] = createIpcWrapper(channel);
  });
  return wrappers;
}

// Exponer información de versiones
contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
});

// API principal unificada
contextBridge.exposeInMainWorld('api', {
  // === CONTROL DE VENTANAS ===
  minimize: createIpcWrapper('minimize'),
  maximize: createIpcWrapper('maximize'),
  close: createIpcWrapper('close'),
  
  // === GESTIÓN DE VENTANAS ===
  openComponentWindow: createIpcWrapper('openComponentWindow'),
  identifyWindow: createIpcWrapper('identifyWindow'),
  
  // === SISTEMA DE ARCHIVOS ===
  openFolder: createIpcWrapper('openFolder'),
  ensureDir: createIpcWrapper('ensureDir'),
  getAppPaths: createIpcWrapper('getAppPaths'),
  
  // === BASE DE DATOS ===
  initializeDatabase: createIpcWrapper('initialize-database'),
  
  // === AUTENTICACIÓN ===
  login: createIpcWrapper('login'),
  logout: createIpcWrapper('logout'),
  
  // === PRODUCTOS ===
  ...createIpcWrappers([
    'productos:obtener',
    'productos:insertar', 
    'productos:actualizar',
    'productos:eliminar'
  ]),
  getProducts: createIpcWrapper('productos:obtener'),
  addProduct: createIpcWrapper('productos:insertar'),
  updateProduct: createIpcWrapper('productos:actualizar'),
  deleteProduct: createIpcWrapper('productos:eliminar'),
  
  // === USUARIOS ===
  ...createIpcWrappers([
    'usuarios:obtener',
    'usuarios:insertar',
    'usuarios:actualizar',
    'usuarios:eliminar'
  ]),
  getUsers: createIpcWrapper('usuarios:obtener'),
  addUser: createIpcWrapper('usuarios:insertar'),
  updateUser: createIpcWrapper('usuarios:actualizar'),
  deleteUser: createIpcWrapper('usuarios:eliminar'),
  
  // === CATEGORÍAS ===
  ...createIpcWrappers([
    'categorias:obtener',
    'categorias:insertar',
    'categorias:actualizar',
    'categorias:eliminar'
  ]),
  getCategories: createIpcWrapper('categorias:obtener'),
  addCategory: createIpcWrapper('categorias:insertar'),
  updateCategory: createIpcWrapper('categorias:actualizar'),
  deleteCategory: createIpcWrapper('categorias:eliminar'),
  
  // === CLIENTES ===
  ...createIpcWrappers([
    'clientes:obtener',
    'clientes:insertar',
    'clientes:actualizar',
    'clientes:eliminar'
  ]),
  getCustomers: createIpcWrapper('clientes:obtener'),
  addCustomer: createIpcWrapper('clientes:insertar'),
  updateCustomer: createIpcWrapper('clientes:actualizar'),
  deleteCustomer: createIpcWrapper('clientes:eliminar'),
  
  // === VENTAS ===
  createSale: createIpcWrapper('ventas:insertar'),
  getSales: createIpcWrapper('ventas:obtener'),
  getSaleDetails: createIpcWrapper('ventas:obtenerPorId'),
  cancelSale: createIpcWrapper('cancelSale'),
  
  // === REPORTES ===
  getDailySalesReport: createIpcWrapper('reportes:ventasDiarias'),
  getMonthlyReport: createIpcWrapper('reportes:ventasMensuales'),
  getSalesReport: createIpcWrapper('reportes:ventas'),
  getTopProducts: createIpcWrapper('reportes:topProductos'),
  
  // === DESCUENTOS ===
  getDiscounts: createIpcWrapper('descuentos:obtener'),
  getDiscountById: createIpcWrapper('descuentos:obtenerPorId'),
  getActiveDiscounts: createIpcWrapper('descuentos:obtenerActivos'),
  createDiscount: createIpcWrapper('descuentos:insertar'),
  updateDiscount: createIpcWrapper('descuentos:actualizar'),
  deleteDiscount: createIpcWrapper('descuentos:eliminar'),
  toggleDiscountActive: createIpcWrapper('descuentos:toggleActivo'),
  getApplicableDiscounts: createIpcWrapper('descuentos:obtenerAplicables'),
  getDiscountByCoupon: createIpcWrapper('descuentos:obtenerPorCupon'),
  
  // === OFERTAS ===
  getOffers: createIpcWrapper('ofertas:obtener'),
  getOfferById: createIpcWrapper('ofertas:obtenerPorId'),
  getActiveOffers: createIpcWrapper('ofertas:obtenerActivas'),
  createOffer: createIpcWrapper('ofertas:insertar'),
  updateOffer: createIpcWrapper('ofertas:actualizar'),
  deleteOffer: createIpcWrapper('ofertas:eliminar'),
  toggleOfferActive: createIpcWrapper('ofertas:toggleActivo'),
  getApplicableOffers: createIpcWrapper('ofertas:obtenerAplicables'),
  calculateOfferDiscount: createIpcWrapper('ofertas:calcularDescuento'),
  
  // === DESCUENTOS APLICADOS ===
  getAppliedDiscounts: createIpcWrapper('descuentosAplicados:obtener'),
  getAppliedDiscountsByVenta: createIpcWrapper('descuentosAplicados:obtenerPorVenta'),
  createAppliedDiscount: createIpcWrapper('descuentosAplicados:insertar'),
  getDiscountTotalsByPeriod: createIpcWrapper('descuentosAplicados:obtenerTotalesPorPeriodo'),
  getMostUsedDiscounts: createIpcWrapper('descuentosAplicados:obtenerMasUsados'),
  getDiscountEffectiveness: createIpcWrapper('descuentosAplicados:obtenerEfectividad'),
  
  // === REPORTES FINANCIEROS ===
  getBalanceSheet: createIpcWrapper('reportesFinancieros:balanceGeneral'),
  getIncomeStatement: createIpcWrapper('reportesFinancieros:estadoResultados'),
  getCashFlowStatement: createIpcWrapper('reportesFinancieros:flujoEfectivo'),
  
  // === CONFIGURACIÓN ===
  getSettings: createIpcWrapper('configuracion:obtener'),
  saveSettings: createIpcWrapper('configuracion:actualizar'),
  
  // === EVENTOS DE SINCRONIZACIÓN ===
  registerSyncListener: () => {
    ipcRenderer.on('sync-event', (_, event) => {
      window.dispatchEvent(new CustomEvent('sync-event', { detail: event }));
    });
  },
  
  unregisterSyncListener: () => {
    ipcRenderer.removeAllListeners('sync-event');
  },
  
  broadcastSyncEvent: (event) => {
    ipcRenderer.send('broadcast-sync-event', event);
  }
});

/**
 * API de impresión UNIFICADA - reemplaza printApi y printerApi
 */
contextBridge.exposeInMainWorld('printerAPI', {
  // Obtener impresoras disponibles
  async getPrinters() {
    try {
      const result = await ipcRenderer.invoke('printer:get-printers');
      return {
        success: true,
        printers: Array.isArray(result) ? result : []
      };
    } catch (error) {
      console.error('Error obteniendo impresoras:', error);
      return {
        success: false,
        printers: [],
        error: error?.message || 'Error desconocido obteniendo impresoras'
      };
    }
  },

  // Imprimir factura (usando ESC/POS)
  async printInvoice(saleData, printerName) {
    try {
      const result = await ipcRenderer.invoke('printer:print-invoice', { 
        saleData, 
        printerName 
      });
      return result;
    } catch (error) {
      console.error('Error en printInvoice:', error);
      return {
        success: false,
        error: error?.message || 'Error desconocido en printInvoice'
      };
    }
  },

  // React Native Thermal Printer - EPToolkit
  async printInvoiceRN(saleData, printerName) {
    try {
      console.log('🖨️ Preload: Calling React Native thermal printer...');
      const result = await ipcRenderer.invoke('printer:print-invoice-rn', { 
        saleData, 
        printerName 
      });
      console.log('📋 Preload: React Native print result:', result);
      return result;
    } catch (error) {
      console.error('❌ Error en printInvoiceRN:', error);
      return {
        success: false,
        error: error?.message || 'Error desconocido en React Native printer'
      };
    }
  },

  // Test React Native thermal printer
  async testThermalPrinterRN() {
    try {
      console.log('🧪 Preload: Testing React Native thermal printer...');
      const result = await ipcRenderer.invoke('printer:test-rn');
      console.log('📋 Preload: Test result:', result);
      return result;
    } catch (error) {
      console.error('❌ Error en testThermalPrinterRN:', error);
      return {
        success: false,
        error: error?.message || 'Error desconocido en test RN printer'
      };
    }
  },

  // Test raw thermal printer communication
  async testRawPrinter() {
    try {
      console.log('🧪 Preload: Testing raw printer communication...');
      const result = await ipcRenderer.invoke('printer:test-raw');
      console.log('📋 Preload: Raw test result:', result);
      return result;
    } catch (error) {
      console.error('❌ Error en testRawPrinter:', error);
      return {
        success: false,
        error: error?.message || 'Error desconocido en test raw printer'
      };
    }
  },

  // Imprimir etiqueta
  async printLabel(labelData, printerName) {
    try {
      const result = await ipcRenderer.invoke('printer:print-label', { 
        labelData, 
        printerName 
      });
      return result;
    } catch (error) {
      console.error('Error en printLabel:', error);
      return {
        success: false,
        error: error?.message || 'Error desconocido en printLabel'
      };
    }
  },

  // Imprimir código de barras
  async printBarcode(barcodeData, printerName) {
    try {
      const result = await ipcRenderer.invoke('printer:print-barcode', { 
        barcodeData, 
        printerName 
      });
      return result;
    } catch (error) {
      console.error('Error en printBarcode:', error);
      return {
        success: false,
        error: error?.message || 'Error desconocido en printBarcode'
      };
    }
  },

  // Imprimir código QR
  async printQR(qrData, printerName) {
    try {
      const result = await ipcRenderer.invoke('printer:print-qr', { 
        qrData, 
        printerName 
      });
      return result;
    } catch (error) {
      console.error('Error en printQR:', error);
      return {
        success: false,
        error: error?.message || 'Error desconocido en printQR'
      };
    }
  },

  // Imprimir comandos ESC/POS raw
  async printRaw(data, printerName) {
    try {
      const result = await ipcRenderer.invoke('printer:print-raw', { 
        data, 
        printerName 
      });
      return result;
    } catch (error) {
      console.error('Error en printRaw:', error);
      return {
        success: false,
        error: error?.message || 'Error desconocido en printRaw'
      };
    }
  },

  // Probar impresora
  async testPrinter(printerName) {
    try {
      const result = await ipcRenderer.invoke('printer:test-printer', { 
        printerName 
      });
      return result;
    } catch (error) {
      console.error('Error probando impresora:', error);
      return {
        success: false,
        error: error?.message || 'Error desconocido probando impresora'
      };
    }
  },

  // Abrir cajón de dinero
  async openCashDrawer(printerName) {
    try {
      const result = await ipcRenderer.invoke('printer:open-cash-drawer', { 
        printerName 
      });
      return result;
    } catch (error) {
      console.error('Error abriendo cajón:', error);
      return {
        success: false,
        error: error?.message || 'Error desconocido abriendo cajón'
      };
    }
  },

  // Guardar como PDF
  async savePdf(options) {
    try {
      const result = await ipcRenderer.invoke('printer:save-pdf', options);
      return result;
    } catch (error) {
      console.error('Error guardando PDF:', error);
      return {
        success: false,
        error: error?.message || 'Error desconocido guardando PDF'
      };
    }
  }
});

// Mantener compatibilidad temporal con código existente
contextBridge.exposeInMainWorld('printApi', {
  getPrinters: () => window.printerAPI.getPrinters(),
  printFactura: (html, printerName) => window.printerAPI.printInvoice({ html }, printerName),
  printFacturaRN: (saleData, printerName) => window.printerAPI.printInvoiceRN(saleData, printerName),
  printEtiqueta: (html, printerName) => window.printerAPI.printLabel({ html }, printerName),
  printBarcode: (html, printerName) => window.printerAPI.printBarcode({ html }, printerName),
  printQR: (html, printerName) => window.printerAPI.printQR({ html }, printerName),
  printRaw: (data, printerName) => window.printerAPI.printRaw(data, printerName),
  testPrinter: (printerName) => window.printerAPI.testPrinter(printerName),
  testThermalRN: () => window.printerAPI.testThermalPrinterRN(),
  testRawPrinter: () => window.printerAPI.testRawPrinter(),
  savePdf: (options) => window.printerAPI.savePdf(options)
});

// También mantener printerApi para compatibilidad
contextBridge.exposeInMainWorld('printerApi', {
  getPrinters: () => window.printerAPI.getPrinters(),
  printRaw: (data, printerName) => window.printerAPI.printRaw(data, printerName),
  testPrinter: (printerName) => window.printerAPI.testPrinter(printerName),
  savePdf: (options) => window.printerAPI.savePdf(options),
  printFactura: (html, printerName) => window.printerAPI.printInvoice({ html }, printerName),
  printFacturaRN: (saleData, printerName) => window.printerAPI.printInvoiceRN(saleData, printerName),
  printEtiqueta: (html, printerName) => window.printerAPI.printLabel({ html }, printerName),
  printBarcode: (html, printerName) => window.printerAPI.printBarcode({ html }, printerName),
  printQR: (html, printerName) => window.printerAPI.printQR({ html }, printerName),
  testThermalRN: () => window.printerAPI.testThermalPrinterRN(),
  testRawPrinter: () => window.printerAPI.testRawPrinter(),
  openCashDrawer: (printerName) => window.printerAPI.openCashDrawer(printerName)
});