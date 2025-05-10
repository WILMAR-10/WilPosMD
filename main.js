//  main.js ESM module
import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import path, { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { createRequire } from 'module';

// Legacy require support for CommonJS modules
const requireModule = createRequire(import.meta.url);

// Import PosPrinter de electron-pos-printer
let PosPrinter = null;
try {
  ({ PosPrinter } = requireModule('electron-pos-printer'));
  console.log('✅ electron-pos-printer loaded');
} catch (err) {
  console.warn('⚠️ electron-pos-printer not found:', err);
}

// Try to load printer module dynamically
let printer = null;
try {
  printer = requireModule('printer');
  console.log('✅ printer module loaded:', !!printer);
} catch (err) {
  console.warn('⚠️ printer module not found:', err);
}

// DIRECT PRINTER TEST - logs all available printers via the native module
if (printer) {
  try {
    const printers = printer.getPrinters();
    console.log(
      'DIRECT PRINTER TEST - Available printers:',
      JSON.stringify(printers, null, 2)
    );
  } catch (err) {
    console.error('DIRECT PRINTER TEST - Failed:', err);
  }
} else {
  console.error('DIRECT PRINTER TEST - printer module not available');
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

// Set up printer-related IPC handlers
function setupPrinterHandlers() {
  // Listar impresoras
  safeHandle('get-printers', async () => {
    const win = BrowserWindow.getAllWindows()[0];
    let list = [];
    try { list = await win.webContents.getPrintersAsync(); } catch {};
    return list;
  });

  // Probar impresora
  safeHandle('test-printer', async (event, { printerName }) => {
    if (!printerName) {
      return { success: false, error: 'No se especificó el nombre de la impresora.' };
    }
    try {
      console.log(`Probando impresora: ${printerName}`);
      const testContent = [
        { type: 'text', value: `Prueba de impresora: ${printerName}\n`, style: 'text-align:center;' },
        { type: 'text', value: `Fecha: ${new Date().toLocaleString()}\n`, style: 'text-align:center;' },
      ];
      const options = { printerName, silent: true, preview: false };
      await PosPrinter.print(testContent, options);
      return { success: true };
    } catch (error) {
      console.error(`Error al probar la impresora "${printerName}":`, error);
      return { success: false, error: error.message };
    }
  });

  // Imprimir con electron-pos-printer
  safeHandle('print-content', async (event, { items, options }) => {
    try {
      await PosPrinter.print(items, { ...options, preview: false, silent: true });
      return { success: true };
    } catch (error) {
      console.error('print-content error', error);
      return { success: false, error: error.message };
    }
  });

  // Imprimir comandos ESC/POS (RAW)
  safeHandle('print-raw', async (event, { data, printerName }) => {
    try {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const jobId = await PosPrinter.print([{ type: 'raw', format: buffer }], { printerName, silent: true });
      return { success: true, jobId };
    } catch (error) {
      console.error('print-raw error', error);
      return { success: false, error: error.message };
    }
  });

  // Abrir cajón de dinero (pulse drawer)
  safeHandle('open-cash-drawer', (event, { printerName }) => {
    const drawerCmd = Buffer.from([0x1B, 0x70, 0x00, 0x32, 0x32]);
    return ipcMain.handle('print-raw', { data: drawerCmd, printerName });
  });

  // Generar PDF en carpeta de facturas
  safeHandle('save-pdf', async (event, { html, path: outPath, options }) => {
    const win = new BrowserWindow({ show: false });
    await win.loadURL(`data:text/html,${encodeURIComponent(html)}`);
    const pdf = await win.webContents.printToPDF({ printBackground: true, ...(options || {}) });
    await fs.ensureDir(dirname(outPath));
    await fs.writeFile(outPath, pdf);
    win.destroy();
    return { success: true, path: outPath };
  });
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

// IPC: Ensure directory exists
safeHandle('ensureDir', async (_, folderPath) => {
  try {
    await fs.ensureDir(folderPath);
    return { success: true };
  } catch (err) {
    console.error('ensureDir error:', err);
    return { success: false, error: err.message };
  }
});

// IPC: App paths
safeHandle('getAppPaths', () => ({
  userData: app.getPath('userData'),
  documents: app.getPath('documents'),
  downloads: app.getPath('downloads'),
  temp: app.getPath('temp'),
  exe: app.getPath('exe'),
  appData: app.getPath('appData'),
  appPath: app.getAppPath()
}));

// Lifecycle
app.whenReady().then(async () => {
  try {
    await session.defaultSession.clearCache();
    console.log('🧹 Session cache cleared');

    await initializeDatabase();
    setupIpcHandlers();
    setupWindowControls();
    setupPrinterHandlers();

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