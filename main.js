// main.js - ES Module version
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
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
// Printing and PDF Handlers
// =====================================================

function setupPrintHandlers() {
  // Handler for printing invoices (siempre térmico)
  ipcMain.handle('printInvoice', async (event, options) => {
    try {
      console.log("Print request (siempre térmico):", options.printerName);
      if (!options?.html) throw new Error('Missing HTML');

      // crear HTML temporal
      const tempDir = join(app.getPath('temp'), 'wilpos-prints');
      await fs.ensureDir(tempDir);
      const tempHtmlPath = join(tempDir, `print-${Date.now()}.html`);
      await fs.writeFile(tempHtmlPath, options.html);

      // siempre usa impresión térmica
      return await printWithThermalPrinter(options, tempHtmlPath);

    } catch (error) {
      console.error('printInvoice error:', error);
      return { success: false, error: error.message };
    }
  });

  // thermal printer implementation
  async function printWithThermalPrinter(options, tempHtmlPath) {
    try {
      console.log("Using node-thermal-printer");
      // Leemos el HTML generado por el frontend
      const htmlContent = await fs.readFile(tempHtmlPath, 'utf8');
      const $ = load(htmlContent);

      // Configura la impresora con página de código CP437 (compatible con tu SP‑POS891)
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: options.printerName
          ? `printer:${options.printerName}`
          : 'printer:POS891US',
        characterSet: CharacterSet.PC437_USA,
        removeSpecialCharacters: false,
        lineCharacter: "-",
        breakLine: BreakLine.WORD,
        options: { timeout: 5000 }
      });

      // Selección de tamaño de fuente según ancho de papel
      const roll = options.options.width === '58mm' ? 48 : 72;
      printer.size(roll === 48 ? 0 : 1, roll === 48 ? 0 : 1);

      // Encabezado
      printer.alignCenter();
      printer.bold(true).println($('h1.header').text().trim());
      printer.bold(false).println($('h2.subheader').text().trim());
      printer.drawLine();

      // Datos de cliente/fecha
      printer.alignLeft();
      printer.println(`Fecha: ${new Date().toLocaleString()}`);
      printer.println(`Cliente: ${$('.cliente').text().trim() || 'Cliente General'}`);
      printer.drawLine();

      // Detalle de productos
      $('.item').each((_, el) => {
        const name  = $(el).find('.producto').text().trim();
        const qty   = $(el).find('.cantidad').text().trim();
        const price = $(el).find('.precio').text().trim();
        printer.tableCustom([
          { text: name,  align: "LEFT",   width: 0.5  },
          { text: qty,   align: "CENTER", width: 0.15 },
          { text: price, align: "RIGHT",  width: 0.35 }
        ]);
      });

      printer.drawLine();

      // Total
      printer.alignRight();
      printer.bold(true).println($('div.total').text().trim());
      printer.bold(false);

      // Pie de página
      printer.alignCenter();
      printer.drawLine();
      printer.println($('footer.footer').text().trim());

      // Corta y ejecuta
      printer.cut();
      await printer.execute();
      console.log("Thermal print success");

      // Limpia el HTML temporal
      await fs.unlink(tempHtmlPath).catch(() => {});
      return { success: true };

    } catch (error) {
      console.error("Thermal printer error:", error);
      return { success: false, error: error.message, needManualPrint: true };
    }
  }

  // getPrinters with thermal flag
  ipcMain.handle('getPrinters', async (event) => {
    const wc = event.sender;
    try {
      let list = [];
      if (wc.getPrintersAsync) {
        list = await wc.getPrintersAsync();
      } else if (wc.getPrinters) {
        list = wc.getPrinters();
      }
      return list.map(p => {
        const name = p.name.toLowerCase();
        return {
          ...p,
          isThermal: /thermal|receipt|pos|80mm|58mm/.test(name)
        };
      });
    } catch (err) {
      console.error('getPrinters error:', err);
      return [];
    }
  });
}

// =====================================================
// Application Lifecycle
// =====================================================

app.whenReady().then(async () => {
  try {
    // Initialize the database
    await initializeDatabase();

    // Set up window controls
    setupWindowControls();

    // Set up print handlers
    setupPrintHandlers();
    
    // Set up database IPC handlers
    setupIpcHandlers();

    // Create the main window
    createMainWindow();

    // Handle macOS activation
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  } catch (error) {
    console.error('Application startup error:', error);
    app.quit();
  }
}).catch(error => {
  console.error("Fatal error during application startup:", error);
  app.quit();
});

// Handle window closing
app.on('window-all-closed', () => {
  console.log('All windows closed, shutting down application');
  // Force app to quit even on macOS (standard behavior would keep it running)
  app.quit();
});

// Make sure the app actually quits and doesn't hang
app.on('quit', () => {
  // Forcibly exit the process if needed
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

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