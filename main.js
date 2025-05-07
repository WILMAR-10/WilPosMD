import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import path, { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { createRequire } from 'module';

// Legacy require support for CommonJS modules
const requireModule = createRequire(import.meta.url);
// Try to load printer module dynamically
let printer = null;
try {
  printer = requireModule('printer');
  console.log('✅ printer module loaded:', !!printer);
} catch (err) {
  console.warn('⚠️ printer module not found:', err);
}

// Import database functions
import {
  initializeDatabase,
  setupIpcHandlers,
  closeDB
} from './src/database/index.js';

// Determine environment and paths
const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const windowCache = new Map();
let mainWindow = null;

console.log("🚀 Starting WilPOS app");
console.log("📂 App Path:", __dirname);
console.log("🔧 Dev Mode:", isDev);

// Utility: Safe IPC registration
function safeHandle(channel, handler) {
  try { ipcMain.removeHandler(channel); } catch {}
  ipcMain.handle(channel, handler);
}

// Register window control
function registerWindowControl(eventName, actionFn) {
  safeHandle(eventName, (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || win.isDestroyed()) throw new Error(`Window not found for ${eventName}`);
      return actionFn(win);
    } catch (err) {
      console.error(`Error in ${eventName}:`, err);
      return false;
    }
  });
}

function setupWindowControls() {
  registerWindowControl('minimize', win => { win.minimize(); return true; });
  registerWindowControl('maximize', win => {
    if (win.isMaximized()) { win.unmaximize(); return false; }
    win.maximize(); return true;
  });
  registerWindowControl('close', win => { win.close(); return true; });
}

// Create main window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 800, minHeight: 600,
    frame: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    icon: join(__dirname, 'assets', 'images', 'icons', 'logo.ico')
  });

  const url = isDev
    ? 'http://localhost:3000'
    : `file://${join(__dirname, 'dist/index.html')}`;
  console.log('Loading URL:', url);

  mainWindow.webContents.on('did-fail-load', () => {
    console.error('Failed to load URL:', url);
    mainWindow.loadURL('data:text/html,<h1>Error</h1><p>Failed to load application.</p>');
  });

  mainWindow.loadURL(url);
  if (isDev) mainWindow.webContents.openDevTools();
}

// IPC: Identificar ventana desde el renderer
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

// Abre o reutiliza una ventana para un componente dado
safeHandle('openComponentWindow', async (event, componentName) => {
  try {
    // Si ya hay una ventana para ese componente y no está destruida, la reusamos
    if (windowCache.has(componentName)) {
      const cachedWin = windowCache.get(componentName);
      if (!cachedWin.isDestroyed()) {
        cachedWin.focus();
        return { windowId: cachedWin.id, cached: true, success: true };
      }
    }

    // Si no, creamos una nueva
    const newWin = new BrowserWindow({
      width: 800, 
      height: 600, 
      show: true,
      frame: false,
      webPreferences: {
        preload: join(__dirname, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false
      }
    });

    const loadUrl = isDev
      ? `http://localhost:3000/?component=${encodeURIComponent(componentName)}`
      : `file://${join(__dirname, 'dist/index.html')}?component=${encodeURIComponent(componentName)}`;

    await newWin.loadURL(loadUrl);
    windowCache.set(componentName, newWin);

    // Cuando se cierre, lo quitamos del cache
    newWin.on('closed', () => {
      windowCache.delete(componentName);
    });

    return { windowId: newWin.id, cached: false, success: true };
  } catch (err) {
    console.error('openComponentWindow error:', err);
    return { success: false, error: err.message };
  }
});


// IPC: Get printers
safeHandle('get-printers', () => {
  try {
    // Try the native printer module first for better device information
    if (printer) {
      const printerList = printer.getPrinters().map(p => ({
        ...p,
        isThermal: p.name.toLowerCase().includes('thermal') || 
                  p.name.toLowerCase().includes('pos') || 
                  p.name.toLowerCase().includes('receipt')
      }));
      console.log('Available printers:', printerList.map(p => p.name));
      return printerList;
    }
    
    // Fall back to Electron's built-in printer detection
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      const electronPrinters = win.webContents.getPrinters().map(p => ({
        ...p,
        isThermal: p.name.toLowerCase().includes('thermal') || 
                  p.name.toLowerCase().includes('pos') || 
                  p.name.toLowerCase().includes('receipt')
      }));
      console.log('Available printers (Electron):', electronPrinters.map(p => p.name));
      return electronPrinters;
    }
  } catch (err) {
    console.error('Error detecting printers:', err);
  }
  
  // Return empty list if nothing else works
  return [];
});

// IPC: Print raw ESC/POS
safeHandle('print-raw', async (event, { data, printerName }) => {
  if (!printer) {
    return { success: false, error: 'Printer module not available' };
  }
  
  try {
    // Ensure data is properly converted to Buffer if it's not already
    const bufferData = Buffer.isBuffer(data) ? data : 
                      (typeof data === 'string' ? Buffer.from(data) : 
                      Buffer.from(data));
    
    return new Promise(resolve => {
      printer.printDirect({
        data: bufferData,
        printer: printerName || printer.getDefaultPrinterName(),
        type: 'RAW',
        success: jobID => {
          console.log(`Print job sent successfully, ID: ${jobID}`);
          resolve({ success: true, jobID });
        },
        error: err => {
          console.error('Print error:', err);
          resolve({ success: false, error: err.message || 'Unknown printing error' });
        }
      });
    });
  } catch (err) {
    console.error('Print-raw error:', err);
    return { success: false, error: err.message || 'Unknown printing error' };
  }
});

safeHandle('test-printer', async (event, printerName) => {
  try {
    if (!printer) {
      return { success: false, error: 'Printer module not available' };
    }
    
    // Basic ESC/POS test sequence: Initialize + center align + text + cut
    const testData = Buffer.from([
      0x1B, 0x40,             // ESC @ - Initialize printer
      0x1B, 0x61, 0x01,       // ESC a 1 - Center alignment
      ...Buffer.from('WilPOS Test Page\n\n'),
      ...Buffer.from(`Date: ${new Date().toLocaleString()}\n\n\n`),
      0x1D, 0x56, 0x00        // GS V 0 - Cut paper
    ]);
    
    return new Promise(resolve => {
      printer.printDirect({
        data: testData,
        printer: printerName || printer.getDefaultPrinterName(),
        type: 'RAW',
        success: jobID => resolve({ success: true, jobID }),
        error: err => resolve({ success: false, error: err.message })
      });
    });
  } catch (err) {
    console.error('Test printer error:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
});

// IPC: Open folder
safeHandle('openFolder', async (_, folderPath) => {
  try {
    await fs.ensureDir(folderPath);
    await shell.openPath(folderPath);
    return true;
  } catch (err) {
    console.error('openFolder error:', err);
    return false;
  }
});

// IPC: App paths
safeHandle('getAppPaths', () => ({
  userData: app.getPath('userData'),
  documents: app.getPath('documents'),
  downloads: app.getPath('downloads'),
  temp: app.getPath('temp'),
  exe: app.getPath('exe'),
  appData: app.getPath('appData')
}));

// …en tu safeHandle('print-raw', …):
safeHandle('print-raw', async (event, { data, printerName }) => {
  if (!printer) {
    return { success: false, error: 'Printer module not available' }
  }
  // data viene como ArrayBuffer / Buffer-like
  const buf = Buffer.from(data)
  return new Promise(resolve => {
    printer.printDirect({
      data: buf,
      printer: printerName || printer.getDefaultPrinterName(),
      type: 'RAW',
      success: jobID => resolve({ success: true, jobID }),
      error: err => resolve({ success: false, error: err.message })
    })
  })
})

// Lifecycle
app.whenReady().then(async () => {
  try {
    await session.defaultSession.clearCache();
    console.log('🧹 Session cache cleared');

    await initializeDatabase();
    setupIpcHandlers();
    setupWindowControls();

    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  } catch (err) {
    console.error('Startup error:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  windowCache.forEach(win => { if (!win.isDestroyed()) win.destroy(); });
  windowCache.clear();
  try { closeDB(); } catch {}
});

app.on('will-quit', () => {
  const tempDir = join(app.getPath('temp'), 'wilpos-prints');
  try {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
});
