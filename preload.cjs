// preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
});

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
  
  // PDF and printer methods
  printInvoice: async (options) => {
    try {
      // Validate required parameters
      if (!options || typeof options !== 'object') {
        return { success: false, error: 'Invalid options parameter' };
      }
      
      if (!options.html || typeof options.html !== 'string') {
        return { success: false, error: 'HTML content is required' };
      }
      
      // Send the print request to main process
      const result = await ipcRenderer.invoke('printInvoice', {
        html: options.html,
        printerName: options.printerName,
        silent: options.silent !== undefined ? options.silent : true,
        copies: options.copies || 1,
        options: {
          // Pass thermal printer specific options
          thermalPrinter: options.thermalPrinter || false,
          pageSize: options.pageSize || 'A4',
          width: options.width || '80mm'
        }
      });
      
      return result;
    } catch (error) {
      console.error('Error in printInvoice bridge:', error);
      return { success: false, error: error.message || 'Unknown error in print handler' };
    }
  },
  savePdf: ({ html, path, options }) => ipcRenderer.invoke('savePdf', { html, path, options }),
  
  // File/folder management
  openFolder: (folderPath) => ipcRenderer.invoke('openFolder', folderPath),
  
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
  }
});

contextBridge.exposeInMainWorld('electron', {
  app: {
    getState: () => ipcRenderer.invoke('app:getState'),
    setState: (state) => ipcRenderer.invoke('app:setState', state)
  }
});

// Expose print functionality
contextBridge.exposeInMainWorld('electronPrinting', {
  getPrinters: () => ipcRenderer.invoke('getPrinters'),
  printInvoice: (options) => ipcRenderer.invoke('printInvoice', options)
});