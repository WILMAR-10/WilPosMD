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
  
  // PDF and printer methods (Improved error handling)
  printInvoice: wrapApiMethod(async (options) => {
    // Validación básica de parámetros
    if (!options || typeof options !== 'object') {
      return { success: false, error: 'Parámetros de impresión inválidos' };
    }
    
    if (!options.html || typeof options.html !== 'string') {
      return { success: false, error: 'Contenido HTML requerido' };
    }
    
    // Sanear las opciones antes de enviarlas
    const printOptions = {
      html: options.html,
      printerName: options.printerName || undefined,
      silent: options.silent !== undefined ? options.silent : true,
      copies: options.copies || 1,
      options: {
        // Opciones para impresora térmica
        thermalPrinter: options.options?.thermalPrinter || false,
        pageSize: options.options?.pageSize || 'A4',
        width: options.options?.width || '80mm',
        ...options.options
      }
    };
    
    console.log('Enviando solicitud de impresión con:', {
      printerName: printOptions.printerName, 
      silent: printOptions.silent,
      thermalPrinter: printOptions.options.thermalPrinter
    });
    
    // Enviar petición al proceso principal
    const result = await ipcRenderer.invoke('printInvoice', printOptions);
    console.log('Resultado de impresión:', result);
    
    return result;
  }, 'printInvoice'),
  
  savePdf: wrapApiMethod(async ({ html, path, options }) => {
    return await ipcRenderer.invoke('savePdf', { html, path, options });
  }, 'savePdf'),
  
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
  
  // === NUEVA API: getPrinters ===
  getPrinters: wrapApiMethod(async () => {
    try {
      console.log('Solicitando impresoras al proceso principal');
      const printers = await ipcRenderer.invoke('getPrinters');
      return printers;
    } catch (error) {
      console.error('Error obteniendo impresoras:', error);
      // Si falla, intentar obtener impresoras desde webContents directamente
      const wc = require('electron').webContents.getFocusedWebContents();
      if (wc && wc.getPrinters) {
        const printers = wc.getPrinters();
        console.log('Impresoras obtenidas directamente:', printers);
        return printers.map(p => ({
          ...p,
          isThermal: p.name.toLowerCase().includes('thermal') || 
                    p.name.toLowerCase().includes('receipt') || 
                    p.name.toLowerCase().includes('pos') || 
                    p.name.toLowerCase().includes('80mm') || 
                    p.name.toLowerCase().includes('58mm')
        }));
      }
      throw error;
    }
  }, 'getPrinters')
});

// Expose app state management
contextBridge.exposeInMainWorld('electron', {
  app: {
    getState: () => ipcRenderer.invoke('app:getState'),
    setState: (state) => ipcRenderer.invoke('app:setState', state)
  }
});

// Expose print functionality with improved error handling
contextBridge.exposeInMainWorld('electronPrinting', {
  getPrinters: wrapApiMethod(async () => {
    // Intentar primero a través de ipcRenderer
    try {
      const printers = await ipcRenderer.invoke('getPrinters');
      
      // Detectar impresoras térmicas
      return printers.map(printer => {
        const name = printer.name.toLowerCase();
        const isThermal = name.includes('thermal') || 
                          name.includes('receipt') || 
                          name.includes('pos') || 
                          name.includes('80mm') || 
                          name.includes('58mm');
        
        return {
          ...printer,
          isThermal
        };
      });
    } catch (error) {
      console.error('Error al obtener impresoras mediante IPC:', error);
      
      // Plan B: Usar webContents directamente
      try {
        const printers = [];
        const webContents = require('electron').webContents.getFocusedWebContents();
        
        if (webContents) {
          if (webContents.getPrinters) {
            // Electron ≥ 12
            const systemPrinters = webContents.getPrinters();
            printers.push(...systemPrinters);
          }
        }
        
        // Identificar impresoras térmicas
        return printers.map(printer => {
          const name = printer.name.toLowerCase();
          const isThermal = name.includes('thermal') || 
                            name.includes('receipt') || 
                            name.includes('pos') || 
                            name.includes('80mm') || 
                            name.includes('58mm');
          
          return {
            ...printer,
            isThermal
          };
        });
      } catch (directError) {
        console.error('Error al obtener impresoras directamente:', directError);
        
        // Plan C: Retornar un array vacío para no romper nada
        return [];
      }
    }
  }, 'electronPrinting.getPrinters'),
  
  printInvoice: wrapApiMethod(async (options) => {
    return await ipcRenderer.invoke('printInvoice', options);
  }, 'electronPrinting.printInvoice')
});