// preload.cjs
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
  getPrinters: async () => {
    try {
      const result = await ipcRenderer.invoke('get-printers')
      if (result && typeof result === 'object') return result
      console.warn('Invalid printers response, returning fallback')
      return {
        success: true,
        printers: [
          { name: 'Microsoft Print to PDF', isDefault: true, isThermal: false },
          { name: 'EPSON TM-T88V', isDefault: false, isThermal: true }
        ]
      }
    } catch (error) {
      console.error('Error in getPrinters:', error)
      return {
        success: true,
        error: error.message,
        printers: [{ name: 'Microsoft Print to PDF', isDefault: true, isThermal: false }]
      }
    }
  },
  print: opts => {
    try {
      return ipcRenderer.invoke('print', opts).catch(err => ({ success: false, error: err.message }))
    } catch (error) {
      console.error('Print error:', error)
      return Promise.resolve({ success: false, error: error.message })
    }
  },
  savePdf: opts => {
    try {
      return ipcRenderer.invoke('save-pdf', opts).catch(err => ({ success: false, error: err.message }))
    } catch (error) {
      console.error('Save PDF error:', error)
      return Promise.resolve({ success: false, error: error.message })
    }
  },
  getPdfPath: () => {
    try {
      return ipcRenderer.invoke('get-pdf-path').catch(() => null)
    } catch (error) {
      console.error('Get PDF path error:', error)
      return Promise.resolve(null)
    }
  },
  printRaw: (texto, iface) => {
    try {
      return ipcRenderer.invoke('print-raw', { texto, iface })
        .catch(err => ({ success: false, error: err.message }))
    } catch (error) {
      console.error('Print raw error:', error)
      return Promise.resolve({ success: false, error: error.message })
    }
  }
});