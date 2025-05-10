// preload.cjs 
const { contextBridge, ipcRenderer } = require('electron');

// Expose version info
contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
});

// Expose core app API
contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.invoke('minimize'),
  maximize: () => ipcRenderer.invoke('maximize'),
  close: () => ipcRenderer.invoke('close'),

  // Database
  initializeDatabase: () => ipcRenderer.invoke('initialize-database'),

  // CRUD: Products
  getProducts: () => ipcRenderer.invoke('productos:obtener'),
  addProduct: product => ipcRenderer.invoke('productos:insertar', product),
  updateProduct: (id, product) => ipcRenderer.invoke('productos:actualizar', id, product),
  deleteProduct: id => ipcRenderer.invoke('productos:eliminar', id),

  // CRUD: Users
  getUsers: () => ipcRenderer.invoke('usuarios:obtener'),
  addUser: user => ipcRenderer.invoke('usuarios:insertar', user),
  updateUser: (id, user) => ipcRenderer.invoke('usuarios:actualizar', id, user),
  deleteUser: id => ipcRenderer.invoke('usuarios:eliminar', id),

  // CRUD: Categories
  getCategories: () => ipcRenderer.invoke('categorias:obtener'),
  addCategory: category => ipcRenderer.invoke('categorias:insertar', category),
  updateCategory: (id, category) => ipcRenderer.invoke('categorias:actualizar', id, category),
  deleteCategory: id => ipcRenderer.invoke('categorias:eliminar', id),

  // CRUD: Customers
  getCustomers: () => ipcRenderer.invoke('clientes:obtener'),
  addCustomer: customer => ipcRenderer.invoke('clientes:insertar', customer),
  updateCustomer: (id, customer) => ipcRenderer.invoke('clientes:actualizar', id, customer),
  deleteCustomer: id => ipcRenderer.invoke('clientes:eliminar', id),

  // Sales
  createSale: (sale, details) => ipcRenderer.invoke('ventas:insertar', sale, details),
  getSales: filters => ipcRenderer.invoke('ventas:obtener', filters),
  getSaleDetails: id => ipcRenderer.invoke('ventas:obtenerPorId', id),
  cancelSale: id => ipcRenderer.invoke('cancelSale', id),

  // Reports
  getDailySalesReport: date => ipcRenderer.invoke('reportes:ventasDiarias', date),
  getMonthlyReport: (month, year) => ipcRenderer.invoke('reportes:ventasMensuales', month, year),
  getSalesReport: (startDate, endDate) => ipcRenderer.invoke('reportes:ventas', startDate, endDate),
  getTopProducts: (startDate, endDate, limit = 10) => ipcRenderer.invoke('reportes:topProductos', startDate, endDate, limit),

  // Settings
  getSettings: () => ipcRenderer.invoke('configuracion:obtener'),
  saveSettings: settings => ipcRenderer.invoke('configuracion:actualizar', settings),

  // Auth
  login: credentials => ipcRenderer.invoke('login', credentials),
  logout: () => ipcRenderer.invoke('logout'),

  // File/Folder management
  openFolder: folderPath => ipcRenderer.invoke('openFolder', folderPath),
  ensureDir: folderPath => ipcRenderer.invoke('ensureDir', folderPath),

  // Window management
  openComponentWindow: component => ipcRenderer.invoke('openComponentWindow', component),
  identifyWindow: () => ipcRenderer.invoke('identifyWindow'),

  // App paths
  getAppPaths: () => ipcRenderer.invoke('getAppPaths'),

  // Sync events
  registerSyncListener: () => {
    ipcRenderer.on('sync-event', (_, event) => {
      window.dispatchEvent(new CustomEvent('sync-event', { detail: event }));
    });
  },
  unregisterSyncListener: () => ipcRenderer.removeAllListeners('sync-event'),
  broadcastSyncEvent: event => ipcRenderer.send('broadcast-sync-event', event),
  
  // Printer related functions
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  testPrinter: (printerName) => ipcRenderer.invoke('test-printer', { printerName }),
  printRaw: (text, printerName) => ipcRenderer.invoke('print-raw', { data: text, printerName }),
  savePdf: (options) => ipcRenderer.invoke('save-pdf', options)
});

// Expose dedicated printer API with better error handling
contextBridge.exposeInMainWorld('printerApi', {
  // Obtener todas las impresoras
  getPrinters: async () => {
    try {
      const printers = await ipcRenderer.invoke('get-printers');
      return {
        success: true,
        printers: Array.isArray(printers) ? printers : []
      };
    } catch (error) {
      console.error('Error getting printers:', error);
      return {
        success: false,
        printers: [],
        error: error?.message || 'Unknown error getting printers'
      };
    }
  },

  // Imprimir contenido HTML
  print: async (items, options) => {
    try {
      return await ipcRenderer.invoke('print-content', { items, options });
    } catch (error) {
      console.error('Error printing content:', error);
      return {
        success: false,
        error: error?.message || 'Unknown error printing content'
      };
    }
  },

  // Guardar como PDF
  savePdf: async (html, path, options) => {
    try {
      return await ipcRenderer.invoke('save-pdf', { html, path, options });
    } catch (error) {
      console.error('Error saving PDF:', error);
      return {
        success: false,
        error: error?.message || 'Unknown error saving PDF'
      };
    }
  },

  // Imprimir comandos crudos ESC/POS
  printRaw: async (data, printerName) => {
    try {
      return await ipcRenderer.invoke('print-raw', { data, printerName });
    } catch (error) {
      console.error('Error in printRaw:', error);
      return {
        success: false,
        error: error?.message || 'Unknown error in printRaw'
      };
    }
  },

  // Probar impresora
  testPrinter: async (printerName) => {
    try {
      return await ipcRenderer.invoke('test-printer', { printerName });
    } catch (error) {
      console.error('Error testing printer:', error);
      return {
        success: false,
        error: error?.message || 'Unknown error testing printer'
      };
    }
  },

  // Abrir cajón de dinero
  openCashDrawer: async (printerName) => {
    try {
      return await ipcRenderer.invoke('open-cash-drawer', { printerName });
    } catch (error) {
      console.error('Error opening cash drawer:', error);
      return {
        success: false,
        error: error?.message || 'Unknown error opening cash drawer'
      };
    }
  },

  // Obtener ruta predeterminada para PDF
  getPdfPath: async () => {
    try {
      return await ipcRenderer.invoke('get-pdf-path');
    } catch (error) {
      console.error('Error getting PDF path:', error);
      return null;
    }
  }
});