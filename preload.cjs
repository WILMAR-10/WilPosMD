// Preload.cjs

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

  // Folder management
  openFolder: folderPath => ipcRenderer.invoke('openFolder', folderPath),

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
  broadcastSyncEvent: event => ipcRenderer.send('broadcast-sync-event', event)
});

// Expose printer API (native detection and raw ESC/POS printing)
contextBridge.exposeInMainWorld('printerApi', {
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printRaw: (data, printerName) => ipcRenderer.invoke('print-raw', { data, printerName })
});
