// preload.cjs - Updated with proper printer integration

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
  
  // Printer
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  testPrinter: (printerName) => ipcRenderer.invoke('test-printer', { printerName })
});

// Expose printer API with proper error handling
contextBridge.exposeInMainWorld('printerApi', {
  // Get all available printers
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
  
  // Print raw ESC/POS commands
  printRaw: async (data, printerName) => {
    try {
      // Handle both string and Uint8Array input
      const payload = { 
        data: data,
        printerName: printerName
      };
      
      return await ipcRenderer.invoke('print-raw', payload);
    } catch (error) {
      console.error('Error in printRaw:', error);
      return { 
        success: false,
        error: error?.message || 'Unknown error in printRaw'
      };
    }
  },
  
  // Test printer
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
  }
});