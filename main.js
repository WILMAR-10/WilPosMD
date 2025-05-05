// main.js - ES Module version
import { app, BrowserWindow, ipcMain, dialog, shell, session } from 'electron';
import path, { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { createRequire } from 'module';
import { load } from 'cheerio';

// Use createRequire for CommonJS modules
const require = createRequire(import.meta.url);

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
  savePdf,
  testPrinter
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

/**
 * Obtiene impresoras disponibles y filtra las desconectadas.
 */
async function getSystemPrinters() {
  try {
    const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
    if (win && typeof win.webContents.getPrinters === 'function') {
      const printers = win.webContents.getPrinters();
      const available = printers.filter(p => p.status === 0 || p.status === 3);
      return {
        success: true,
        printers: available.map(p => ({
          name: p.name,
          description: p.description || '',
          status: p.status,
          isDefault: p.isDefault,
          isThermal: /thermal|receipt|80mm|58mm|epson|pos/i.test(p.name.toLowerCase())
        }))
      };
    }
    return { success: false, printers: [], error: 'No printers found' };
  } catch (error) {
    console.error('Error getting printers:', error);
    return { success: false, printers: [], error: error.message || 'Unknown error' };
  }
}

// Ensure a reliable test-printer handler
function setupTestPrinterHandler() {
  const channel = 'test-printer';
  console.log(`Setting up handler for ${channel}`);
  try {
    // Remove any existing handler
    try {
      ipcMain.removeHandler(channel);
      console.log(`Removed existing ${channel} handler`);
    } catch {
      console.log(`No existing ${channel} handler to remove`);
    }

    // Register new handler
    ipcMain.handle(channel, async (event, printerName) => {
      console.log(`Received ${channel} request for printer: "${printerName}"`);
      if (!printerName) {
        console.log(`${channel}: No printer name provided`);
        return { success: false, error: 'No printer name provided' };
      }
      try {
        const { testPrinter } = await import('./src/printing/thermal-printer.js');
        console.log(`${channel}: Calling testPrinter for "${printerName}"`);
        const result = await testPrinter(printerName);
        console.log(`${channel} result:`, result);
        return result;
      } catch (error) {
        console.error(`${channel} error:`, error);
        return {
          success: false,
          error: `Error testing printer: ${error.message || 'Unknown error'}`
        };
      }
    });

    console.log(`Successfully registered ${channel} handler`);
  } catch (error) {
    console.error(`Failed to set up ${channel} handler:`, error);
  }
}

// =====================================================
// Unified handler setup
// =====================================================
function setupAllHandlers(ipcMain, app) {
  const safeRegister = (channel, handler) => {
    try { ipcMain.removeHandler(channel); } catch {}
    ipcMain.handle(channel, handler);
    console.log(`Registered handler for ${channel}`);
  };

  // Get list of printers
  safeRegister('get-printers', async () => {
    console.log('Handling get-printers request');
    try {
      const res = await getPrinters();
      return res;
    } catch (error) {
      console.error('Error getting printers:', error);
      return { success: false, printers: [], error: error.message || 'Unknown error' };
    }
  });

  // Print handler
  safeRegister('print', async (_, options) => {
    console.log(`Print request received for: ${options.printerName || 'Default printer'}`);
    try {
      return await printWithThermalPrinter(options);
    } catch (error) {
      console.error('Print error:', error);
      return { success: false, error: error.message || 'Unknown printing error' };
    }
  });

  // Save as PDF handler
  safeRegister('save-pdf', async (_, options) => {
    try {
      return await savePdf(options);
    } catch (error) {
      console.error('Save PDF error:', error);
      return { success: false, error: error.message || 'Unknown PDF error' };
    }
  });

  // Get default PDF path handler
  safeRegister('get-pdf-path', async () => {
    const dir = path.join(app.getPath('documents'), 'WilPOS', 'Facturas');
    await fs.ensureDir(dir);
    return dir;
  });

  // Test printer handler
  safeRegister('test-printer', async (_, printerName) => {
    console.log(`Testing printer: ${printerName}`);
    try {
      if (!printerName) throw new Error('Printer name is required');
      const list = await getPrinters();
      if (!list.success) throw new Error('Failed to get printer list');
      if (!list.printers.some(p => p.name === printerName)) {
        console.warn(`Printer "${printerName}" not found; attempting test anyway`);
      }
      return await testPrinter(printerName);  // calls imported function
    } catch (error) {
      console.error('Test printer error:', error);
      return { success: false, error: error.message };
    }
  });

  // Open folder handler
  safeRegister('openFolder', async (_, folderPath) => {
    try {
      await fs.ensureDir(folderPath);
      await shell.openPath(folderPath);
      return true;
    } catch (error) {
      console.error('Error opening folder:', error);
      return false;
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

    // Explicit test-printer handler
    setupTestPrinterHandler();

    // Use unified handler setup en lugar de setupThermalPrintingHandlers
    setupAllHandlers(ipcMain, app);

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