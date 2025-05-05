// main.js - ES Module version
import { app, BrowserWindow, ipcMain, dialog, shell, session } from 'electron';
import path, { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { createRequire } from 'module';
import { load } from 'cheerio';

// Use createRequire for CommonJS modules
const require = createRequire(import.meta.url);

// Import node-thermal-printer with error handling
let ThermalPrinter, PrinterTypes, CharacterSet, BreakLine;
try {
  const thermPrinter = require('node-thermal-printer');
  ThermalPrinter = thermPrinter.printer;
  PrinterTypes = thermPrinter.types;
  CharacterSet = thermPrinter.characterSets;
  BreakLine = thermPrinter.BreakLine;
  console.log("Successfully imported node-thermal-printer");
} catch (error) {
  console.error("Failed to import node-thermal-printer:", error);
  // Fallback
  ThermalPrinter = class {
    constructor() {}
    async isPrinterConnected() { return false; }
    write() {}
    async execute() { return false; }
  };
  PrinterTypes = { EPSON: 'epson', STAR: 'star' };
  CharacterSet = { PC850_MULTILINGUAL: 'pc850_multilingual' };
  BreakLine = { WORD: 'word' };
}

// Import database functions from your module
import {
  initializeDatabase, 
  setupIpcHandlers, 
  closeDB 
} from './src/database/index.js';

// Import printing functions
import { 
  printWithThermalPrinter, 
  getPrinters, 
  savePdf      
} from './src/printing/thermal-printer.js';

// Set up directory paths
const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const windowCache = new Map();
let mainWindow = null;

// Log app startup info
console.log("🚀 Starting WilPOS app");
console.log("📂 App Path:", __dirname);
console.log("🔧 Dev Mode:", isDev);

// =====================================================
// Utility Functions
// =====================================================

function safeHandle(channel, handler) {
  try {
    // Always attempt to remove any existing handler
    ipcMain.removeHandler(channel);
  } catch (error) {
    // If no handler exists, that's fine - we'll register a new one
    console.log(`No existing handler found for ${channel}`);
  }
  // Register the new handler
  ipcMain.handle(channel, handler);
}

// =====================================================
// Window Management
// =====================================================

// Helper function for window controls
function registerWindowControl(eventName, actionFn) {
  ipcMain.handle(eventName, (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || win.isDestroyed()) {
        throw new Error(`Window not found for ${eventName}`);
      }
      return actionFn(win);
    } catch (error) {
      console.error(`Error in ${eventName} handler:`, error);
      return false;
    }
  });
}

// Setup window control handlers
function setupWindowControls() {
  console.log("🧱 Setting up window controls...");

  registerWindowControl('minimize', (win) => {
    win.minimize();
    return true;
  });

  registerWindowControl('maximize', (win) => {
    if (win.isMaximized()) {
      win.unmaximize();
      return false;
    } else {
      win.maximize();
      return true;
    }
  });

  registerWindowControl('close', (win) => {
    win.close();
    return true;
  });
}

// Component window handler
ipcMain.handle('openComponentWindow', async (event, componentName) => {
  console.log(`Request to open component in new window: ${componentName}`);

  // Check if we already have a window for this component
  if (windowCache.has(componentName)) {
    const existingWindow = windowCache.get(componentName);
    if (existingWindow && !existingWindow.isDestroyed()) {
      // Focus the existing window instead of creating a new one
      existingWindow.focus();
      return { success: true, windowId: existingWindow.id, cached: true };
    }
  }

  try {
    // Create a new window for the component
    const componentWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      minWidth: 800,
      minHeight: 600,
      frame: false,
      show: false,
      webPreferences: {       
        preload: join(__dirname, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false
      },
    icon: join(__dirname, 'assets', 'images', 'icons', 'logo.ico')
  });
    // Remove window from cache when closed
    componentWindow.on('closed', () => {
      windowCache.delete(componentName);
    });

    // Create the URL with the component parameter
    let url;
    if (isDev) {
      url = `http://localhost:3000/?component=${componentName}`;
    } else {
      url = `file://${join(__dirname, 'dist/index.html')}?component=${componentName}`;
    }

    // Show window when ready to avoid blank screen
    componentWindow.once('ready-to-show', () => {
      componentWindow.show();
    });

    // Load the URL
    await componentWindow.loadURL(url);

    windowCache.set(componentName, componentWindow);

    // Return window ID for reference
    return { success: true, windowId: componentWindow.id, cached: false };
  } catch (error) {
    console.error('Error opening component window:', error);
    return { success: false, error: error.message };
  }
});

// Window identification handler
ipcMain.handle('identifyWindow', (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      throw new Error("Window not found");
    }

    const url = event.sender.getURL();
    let component = null;

    try {
      const urlObj = new URL(url);
      component = urlObj.searchParams.get('component');
    } catch (e) {
      console.error("Error parsing URL:", e);
    }

    return {
      type: component ? 'component' : 'main',
      id: win.id,
      component
    };
  } catch (error) {
    console.error("Error identifying window:", error);
    return { type: "unknown", error: error.message };
  }
});

// Handle broadcasting events between windows
ipcMain.on('broadcast-sync-event', (event, syncEvent) => {
  // Get all windows except sender
  const allWindows = BrowserWindow.getAllWindows();
  const sender = BrowserWindow.fromWebContents(event.sender);
  
  // Send to all other windows
  allWindows.forEach(window => {
    if (window !== sender && !window.isDestroyed()) {
      window.webContents.send('sync-event', syncEvent);
    }
  });
});

// Create main window
function createMainWindow() {
  console.log("Creating main window");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    icon: join(__dirname, 'assets', 'images', 'icons', 'logo.ico')
  });

  // Build the URL
  let url;
  if (isDev) {
    url = 'http://localhost:3000';
    console.log('Loading from development server:', url);
  } else {
    url = `file://${join(__dirname, 'dist/index.html')}`;
    console.log('Loading from built files:', url);
  }

  // Setup error handling
  mainWindow.webContents.on('did-fail-load', () => {
    console.error('Failed to load URL:', url);
    mainWindow.loadURL(`data:text/html,<html><body><h1>Error</h1><p>Failed to load application. Please check your internet connection and restart the app.</p></body></html>`);
  });

  // Load the URL
  mainWindow.loadURL(url);

  // Open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// =====================================================
// Unified handler setup
// =====================================================
function setupAllHandlers(ipcMain, app) {
  const safeRegister = (channel, handler) => {
    try { ipcMain.removeHandler(channel) } catch {}
    ipcMain.handle(channel, handler);
    console.log(`Registrado manejador para ${channel}`);
  };

  // Obtener lista de impresoras (mejorado con USB/Serial)
  safeRegister('get-printers', async () => {
    return await getPrinters();
  });

  // Impresión (térmica o estándar según el destino)
  safeRegister('print', async (_, options) => {
    console.log(`Solicitud de impresión recibida para: ${options.printerName || 'Impresora predeterminada'}`);
    const isThermal = options.options?.thermalPrinter === true ||
      (options.printerName && /thermal|receipt|58mm|80mm|pos|epson|tm-/i.test(options.printerName));
    try {
      if (isThermal) {
        console.log('Utilizando método de impresión térmica');
        return await printWithThermalPrinter(options);
      } else {
        console.log('Utilizando método de impresión estándar');
        return await printWithElectron(options);
      }
    } catch (error) {
      console.error('Error de impresión:', error);
      return { success: false, error: error.message || 'Error desconocido de impresión' };
    }
  });

  // Guardar como PDF
  safeRegister('save-pdf', async (_, options) => {
    try {
      return await savePdf(options);
    } catch (error) {
      console.error('Error al guardar PDF:', error);
      return { success: false, error: error.message || 'Error desconocido al guardar PDF' };
    }
  });

  // Devolver ruta predeterminada para PDFs
  safeRegister('get-pdf-path', async () => {
    const dir = path.join(app.getPath('documents'), 'WilPOS', 'Facturas');
    await fs.ensureDir(dir);
    return dir;
  });

  // Impresión de texto RAW para impresoras ESC/POS
  safeRegister('print-raw', async (_, { texto, printerName }) => {
    console.log(`Impresión RAW solicitada para: ${printerName || 'Impresora predeterminada'}`);
    try {
      if (!printerName) {
        throw new Error('Se requiere un nombre de impresora');
      }
      // Crear ventana oculta para impresión
      const win = new BrowserWindow({
        show: false,
        webPreferences: { contextIsolation: true, sandbox: false }
      });

      // Construir HTML con texto plano
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Print Raw</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body {
              font-family: monospace;
              white-space: pre;
              font-size: 9pt;
              width: 72mm;
              margin: 0;
              padding: 0;
            }
          </style>
        </head>
        <body>${texto.replace(/[\x00-\x1F]/g, '')}</body>
        </html>
      `;
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

      // Enviar a impresora
      const result = await win.webContents.print({
        silent: true,
        printBackground: true,
        deviceName: printerName,
        margins: { marginType: 'none' },
        pageSize: { width: 80000, height: 210000 }
      });

      win.close();
      return {
        success: result,
        message: result ? 'Impresión enviada correctamente' : 'Error al enviar a impresora'
      };
    } catch (error) {
      console.error('Error en impresión RAW:', error);
      return {
        success: false,
        error: `Fallo de impresión: ${error.message || 'Error desconocido'}`
      };
    }
  });

  // Impresión directa de comandos RAW para impresoras térmicas ESC/POS
  safeRegister('printer:print-raw', async (_, commands, printerName) => {
    console.log(`Recibida petición de impresión RAW para ${printerName}`);
    console.log(`Tamaño comandos: ${commands.length} bytes`);
    
    try {
      // Crear instancia de impresora térmica
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: `printer:${printerName}`,
        driver: require('printer'),
        options: {
          timeout: 5000
        },
        characterSet: CharacterSet.PC850_MULTILINGUAL
      });
      
      // Verificar conectividad
      const isConnected = await printer.isPrinterConnected();
      if (!isConnected) {
        console.error(`La impresora ${printerName} no está conectada`);
        return { 
          success: false, 
          error: `La impresora ${printerName} no está conectada` 
        };
      }
      
      // Enviar datos RAW directamente a la impresora
      printer.write(Buffer.from(commands));
      
      // Ejecutar comando de impresión
      await printer.execute();
      
      console.log(`Comandos RAW enviados exitosamente a ${printerName}`);
      return { 
        success: true, 
        message: `Impresión enviada a ${printerName}` 
      };
    } catch (error) {
      console.error('Error al imprimir comandos RAW:', error);
      return { 
        success: false, 
        error: error.message || 'Error desconocido al imprimir'
      };
    }
  });
  
  // Alias para compatibilidad con versiones anteriores (sin prefijo 'printer:')
  safeRegister('print-raw', async (_, commands, printerName) => {
    return ipcMain.handle('printer:print-raw', commands, printerName);
  });

  // Prueba de conectividad de impresora
  safeRegister('test-printer', async (_, printerName) => {
    console.log(`Probando impresora: ${printerName || 'Predeterminada'}`);
    try {
      const testHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Prueba de Impresora</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 10mm;
              width: 72mm;
              margin: 0 auto;
            }
            .title {
              font-size: 14pt;
              font-weight: bold;
              margin-bottom: 5mm;
            }
            .content { font-size: 10pt; margin-bottom: 5mm; }
            .footer {
              margin-top: 10mm;
              font-size: 8pt;
              border-top: 1px dashed #000;
              padding-top: 2mm;
            }
          </style>
        </head>
        <body>
          <div class="title">PÁGINA DE PRUEBA</div>
          <div class="content">
            <p>Prueba de impresora: ${printerName || 'Predeterminada'}</p>
            <p>Fecha: ${new Date().toLocaleString()}</p>
          </div>
          <div class="footer">WilPOS - Sistema de Punto de Venta</div>
        </body>
        </html>
      `;
      return await printWithThermalPrinter({
        html: testHTML,
        printerName,
        silent: true,
        options: { thermalPrinter: true }
      });
    } catch (error) {
      console.error('Error probando impresora:', error);
      return { success: false, error: `Error probando impresora: ${error.message || 'Error desconocido'}` };
    }
  });

  // Abrir carpeta en el sistema
  safeRegister('openFolder', async (_, folderPath) => {
    try {
      await fs.ensureDir(folderPath);
      await shell.openPath(folderPath);
      return true;
    } catch (error) {
      console.error('Error abriendo carpeta:', error);
      return false;
    }
  });
}

// =====================================================
// Enhance Electron Print Handlers
// =====================================================
function enhanceElectronPrintHandlers() {
  // Prevent duplicate registration
  try { ipcMain.removeHandler('get-printers') } catch (e) {}

  ipcMain.handle('get-printers', async () => {
    try {
      // 1) try thermal-printer.js
      const fromModule = await getPrinters();
      if (fromModule?.printers) return fromModule;

      // 2) try webContents.getPrinters()
      const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
      if (win && typeof win.webContents.getPrinters === 'function') {
        const list = win.webContents.getPrinters();
        return {
          success: true,
          printers: list.map(p => ({
            name: p.name,
            description: p.description || '',
            status: p.status,
            isDefault: p.isDefault,
            isThermal: /thermal|receipt|80mm|58mm|epson|pos/i.test(p.name.toLowerCase())
          }))
        };
      }

      // 3) fallback
      return {
        success: true,
        printers: [
          { name: 'Microsoft Print to PDF', isDefault: true, isThermal: false },
          { name: 'POS-80', isDefault: false, isThermal: true }
        ]
      };
    } catch (error) {
      console.error('get-printers final error:', error);
      return {
        success: true,
        printers: [{ name: 'Microsoft Print to PDF', isDefault: true, isThermal: false }]
      };
    }
  });
}

// =====================================================
// Application Lifecycle
// =====================================================
app.whenReady().then(async () => {
  try {
    // Limpia el cache antes de crear la ventana
    await session.defaultSession.clearCache();
    console.log('🧹 Caché de sesión borrada');

    await initializeDatabase();
    setupIpcHandlers();
    setupWindowControls();

    // Use unified handler setup instead of setupThermalPrintingHandlers
    setupAllHandlers(ipcMain, app);

    // Enhance Electron print handlers
    enhanceElectronPrintHandlers();

    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  } catch (error) {
    console.error('Application startup error:', error);
    app.quit();
  }
});

// =====================================================
// Ensure full exit when last window closes
// =====================================================
app.on('window-all-closed', () => {
  console.log('All windows closed, shutting down application')
  app.quit()
  process.exit(0)
})

// Cleanup before quitting
app.on('before-quit', () => {
  // Clean up window cache
  windowCache.forEach((window) => {
    if (!window.isDestroyed()) {
      window.destroy();
    }
  });
  windowCache.clear();

  // Close database connections
  try {
    closeDB();
  } catch (error) {
    console.error("Error closing database connections:", error);
  }
});

// Cleanup temporary print files
app.on('will-quit', () => {
  const tempDir = join(app.getPath('temp'), 'wilpos-prints');
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('Error cleaning up temp print files:', error);
  }
});

// Handle app paths retrieval
ipcMain.handle('getAppPaths', () => ({
  userData: app.getPath('userData'),
  documents: app.getPath('documents'),
  downloads: app.getPath('downloads'),
  temp: app.getPath('temp'),
  exe: app.getPath('exe'),
  appData: app.getPath('appData'),
}));