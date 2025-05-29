// preload.cjs - Versión simplificada aplicando principio DRY
const { contextBridge, ipcRenderer } = require('electron');

/**
 * Utility para crear wrappers de IPC con manejo de errores consistente
 * Principio DRY - No repetir código de manejo de errores
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
    // Convertir kebab-case a camelCase para nombres de método
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

// API principal unificada - Principio de Responsabilidad Única
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
  // Alias más amigables
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
  // Alias más amigables
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
  // Alias más amigables
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
  // Alias más amigables
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
  
  // === CONFIGURACIÓN ===
  getSettings: createIpcWrapper('configuracion:obtener'),
  saveSettings: createIpcWrapper('configuracion:actualizar'),
  
  // === IMPRESIÓN ===
  getPrinters: createIpcWrapper('get-printers'),
  printRaw: createIpcWrapper('print-raw'),
  testPrinter: createIpcWrapper('test-printer'),
  savePdf: createIpcWrapper('save-pdf'),
  
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
 * API de impresión dedicada con mejor manejo de errores
 * Principio de Interface Segregation - API específica para impresión
 */
contextBridge.exposeInMainWorld('printApi', {
  // Obtener impresoras disponibles
  async getPrinters() {
    try {
      const printers = await ipcRenderer.invoke('get-printers');
      return {
        success: true,
        printers: Array.isArray(printers) ? printers : []
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

  // Imprimir comandos ESC/POS raw
  async printRaw(data, printerName) {
    try {
      return await ipcRenderer.invoke('print-raw', data, printerName);
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
      return await ipcRenderer.invoke('test-printer', { printerName });
    } catch (error) {
      console.error('Error probando impresora:', error);
      return {
        success: false,
        error: error?.message || 'Error desconocido probando impresora'
      };
    }
  },

  // Guardar como PDF
  async savePdf(options) {
    try {
      return await ipcRenderer.invoke('save-pdf', options);
    } catch (error) {
      console.error('Error guardando PDF:', error);
      return {
        success: false,
        error: error?.message || 'Error desconocido guardando PDF'
      };
    }
  }
});

// Mantener compatibilidad con código existente
// Principio de Open/Closed - Extender sin modificar código existente
contextBridge.exposeInMainWorld('printerApi', {
  getPrinters: async () => {
    const result = await window.printApi.getPrinters();
    return result;
  },
  
  printRaw: async (data, printerName) => {
    return await window.printApi.printRaw(data, printerName);
  },
  
  testPrinter: async (printerName) => {
    return await window.printApi.testPrinter(printerName);
  },
  
  savePdf: async (options) => {
    return await window.printApi.savePdf(options);
  }
});