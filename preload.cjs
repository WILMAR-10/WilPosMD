// preload.cjs - Modificado para mejorar soporte de impresión
const { contextBridge, ipcRenderer } = require('electron');

// Función para envolver métodos de API con manejo de errores
const wrapApiMethod = (method, methodName) => {
  return async (...args) => {
    try {
      return await method(...args);
    } catch (error) {
      console.error(`Error en ${methodName}:`, error);
      return { 
        success: false, 
        error: error.message || `Error desconocido en ${methodName}`
      };
    }
  };
};

// Base context API
contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
});

// API Principal
contextBridge.exposeInMainWorld('api', {
  // Window control handlers
  minimize: () => ipcRenderer.invoke('minimize'),
  maximize: () => ipcRenderer.invoke('maximize'),
  close: () => ipcRenderer.invoke('close'),
  
  // Database initialization
  initializeDatabase: () => ipcRenderer.invoke('initialize-database'),
  
  // Products handlers
  getProducts: () => ipcRenderer.invoke('productos:obtener'),
  addProduct: (product) => ipcRenderer.invoke('productos:insertar', product),
  updateProduct: (id, product) => ipcRenderer.invoke('productos:actualizar', id, product),
  deleteProduct: (id) => ipcRenderer.invoke('productos:eliminar', id),
  
  // Users handlers
  getUsers: () => ipcRenderer.invoke('usuarios:obtener'),
  addUser: (user) => ipcRenderer.invoke('usuarios:insertar', user),
  updateUser: (id, user) => ipcRenderer.invoke('usuarios:actualizar', id, user),
  deleteUser: (id) => ipcRenderer.invoke('usuarios:eliminar', id),

  // Categories handlers
  getCategories: () => ipcRenderer.invoke('categorias:obtener'),
  addCategory: (category) => ipcRenderer.invoke('categorias:insertar', category),
  updateCategory: (id, category) => ipcRenderer.invoke('categorias:actualizar', id, category),
  deleteCategory: (id) => ipcRenderer.invoke('categorias:eliminar', id),
  
  // Customers handlers
  getCustomers: () => ipcRenderer.invoke('clientes:obtener'),
  addCustomer: (customer) => ipcRenderer.invoke('clientes:insertar', customer),
  updateCustomer: (id, customer) => ipcRenderer.invoke('clientes:actualizar', id, customer),
  deleteCustomer: (id) => ipcRenderer.invoke('clientes:eliminar', id),
  
  // Sales handlers
  createSale: (sale, details) => ipcRenderer.invoke('ventas:insertar', sale, details),
  getSales: (filters) => ipcRenderer.invoke('ventas:obtener', filters),
  getSaleDetails: (id) => ipcRenderer.invoke('ventas:obtenerPorId', id),
  cancelSale: (id) => ipcRenderer.invoke('cancelSale', id),
  
  // Invoice handlers
  generateInvoice: (saleId) => ipcRenderer.invoke('facturas:generar', saleId),
  getInvoice: (saleId) => ipcRenderer.invoke('facturas:obtener', saleId),
  
  // Report handlers
  getDailySalesReport: (date) => ipcRenderer.invoke('reportes:ventasDiarias', date),
  getMonthlyReport: (month, year) => ipcRenderer.invoke('reportes:ventasMensuales', month, year),
  getSalesReport: (startDate, endDate) => ipcRenderer.invoke('reportes:ventas', startDate, endDate),
  getTopProducts: (startDate, endDate, limit = 10) => ipcRenderer.invoke('reportes:topProductos', startDate, endDate, limit),
  getDailyReports: (params) => ipcRenderer.invoke('resumen:obtenerPorFechas', params.startDate, params.endDate),
  
  // Settings handlers
  getSettings: () => ipcRenderer.invoke('configuracion:obtener'),
  saveSettings: (settings) => ipcRenderer.invoke('configuracion:actualizar', settings),
  
  // Authentication handlers
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  logout: () => ipcRenderer.invoke('logout'),
  
  // File/folder management
  openFolder: wrapApiMethod(async (folderPath) => {
    return await ipcRenderer.invoke('openFolder', folderPath);
  }, 'openFolder'),
  
  // Window management
  openComponentWindow: (component) => ipcRenderer.invoke('openComponentWindow', component),
  identifyWindow: () => ipcRenderer.invoke('identifyWindow'),

  // App paths
  getAppPaths: () => ipcRenderer.invoke('getAppPaths'),
  
  // Sync events between windows
  registerSyncListener: () => {
    ipcRenderer.on('sync-event', (_, event) => {
      const syncEvent = new CustomEvent('sync-event', { detail: event });
      window.dispatchEvent(syncEvent);
    });
  },
  
  unregisterSyncListener: () => {
    ipcRenderer.removeAllListeners('sync-event');
  },
  
  broadcastSyncEvent: (event) => {
    ipcRenderer.send('broadcast-sync-event', event);
  },

  // New PDF helper
  getPDFPath: () => ipcRenderer.invoke('get-pdf-path')
});

// Expose app state management
contextBridge.exposeInMainWorld('electron', {
  app: {
    getState: () => ipcRenderer.invoke('app:getState'),
    setState: (state) => ipcRenderer.invoke('app:setState', state)
  }
});

// Expose unified printer API
contextBridge.exposeInMainWorld('printerApi', {
  // Get list of available printers
  getPrinters: async () => {
    try {
      return await ipcRenderer.invoke('get-printers');
    } catch (error) {
      console.error('Failed to get printers:', error);
      return { success: false, error: error.message || 'Unknown error', printers: [] };
    }
  },

  // Send print job
  print: async (options) => {
    if (!options?.html) {
      return { success: false, error: 'Invalid print options: html content is required' };
    }
    console.log('Sending print request:', {
      printer: options.printerName || 'default',
      silent: options.silent,
      thermal: options.options?.thermalPrinter
    });
    try {
      return await ipcRenderer.invoke('print', options);
    } catch (error) {
      console.error('Error during print operation:', error);
      return { success: false, error: error.message || 'Unknown error during printing' };
    }
  },

  // Save HTML as PDF
  savePdf: async (options) => {
    if (!options?.html || !options?.path) {
      return { success: false, error: 'Invalid PDF options: html and path are required' };
    }
    console.log('Saving PDF to:', options.path);
    try {
      return await ipcRenderer.invoke('savePdf', options);
    } catch (error) {
      console.error('Error saving PDF:', error);
      return { success: false, error: error.message || 'Unknown error saving PDF' };
    }
  }
});