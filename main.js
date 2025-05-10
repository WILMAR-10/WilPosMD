// Enhanced main.js with printer support

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
  // Get all available printers
  safeHandle('get-printers', () => {
    console.log('get-printers called from renderer');
    
    try {
      // Try Electron's built-in printer detection first for testing
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        const electronPrinters = win.webContents.getPrinters();
        console.log('Electron printers found:', electronPrinters.length);
        return electronPrinters;
      }
    } catch (err) {
      console.error('Error in Electron printer detection:', err);
    }
    
    try {
      // Then try native module if available
      if (printer) {
        const printerList = printer.getPrinters();
        console.log('Native printer module found printers:', printerList.length);
        return printerList;
      }
    } catch (err) {
      console.error('Error in native printer module:', err);
    }
    
    console.log('No printers could be detected');
    return []; // Return empty list as last resort
  });
  
  // Print raw ESC/POS commands
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
  
  // Test printer with basic commands
  safeHandle('test-printer', async (event, { printerName }) => {
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
  
  // Open cash drawer
  safeHandle('open-cash-drawer', async (event, { printerName }) => {
    try {
      if (!printer) {
        return { success: false, error: 'Printer module not available' };
      }
      
      // Cash drawer opening sequence
      const drawerCmd = Buffer.from([
        0x1B, 0x70, 0x00, 0x32, 0x32  // ESC p 0 50 50
      ]);
      
      return new Promise(resolve => {
        printer.printDirect({
          data: drawerCmd,
          printer: printerName || printer.getDefaultPrinterName(),
          type: 'RAW',
          success: jobID => resolve({ success: true, jobID }),
          error: err => resolve({ success: false, error: err.message })
        });
      });
    } catch (err) {
      console.error('Open drawer error:', err);
      return { success: false, error: err.message || 'Unknown error' };
    }
  });
  
  // Print HTML content
  safeHandle('print', async (event, options) => {
    try {
      const win = event.sender.getOwnerBrowserWindow();
      if (!win) {
        return { success: false, error: 'No browser window found' };
      }
      
      // Create a temporary hidden window to print from
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });
      
      return new Promise((resolve) => {
        printWin.loadURL('data:text/html,' + encodeURIComponent(options.html));
        printWin.webContents.on('did-finish-load', () => {
          // Set up print options
          const printOptions = {
            silent: options.silent !== false,
            printBackground: true,
            copies: options.copies || 1,
            deviceName: options.printerName
          };
          
          printWin.webContents.print(printOptions, (success, errorType) => {
            // Close the temporary window
            printWin.destroy();
            
            if (success) {
              resolve({ success: true });
            } else {
              resolve({ 
                success: false, 
                error: `Printing failed: ${errorType || 'unknown error'}` 
              });
            }
          });
        });
      });
    } catch (err) {
      console.error('HTML print error:', err);
      return { success: false, error: err.message || 'Unknown printing error' };
    }
  });
  
  // Save as PDF
  safeHandle('save-pdf', async (event, options) => {
    try {
      const win = event.sender.getOwnerBrowserWindow();
      if (!win) {
        return { success: false, error: 'No browser window found' };
      }
      
      // Create a temporary hidden window to generate PDF from
      const pdfWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });
      
      return new Promise((resolve) => {
        pdfWin.loadURL('data:text/html,' + encodeURIComponent(options.html));
        pdfWin.webContents.on('did-finish-load', async () => {
          try {
            // Ensure directory exists
            const dir = path.dirname(options.path);
            await fs.ensureDir(dir);
            
            // Generate PDF
            const pdfData = await pdfWin.webContents.printToPDF({
              printBackground: options.options?.printBackground !== false,
              margins: options.options?.margins || { 
                top: 0, 
                bottom: 0,
                left: 0,
                right: 0
              },
              pageSize: options.options?.format || 'A4'
            });
            
            // Write PDF file
            await fs.writeFile(options.path, pdfData);
            
            // Close the temporary window
            pdfWin.destroy();
            
            resolve({ 
              success: true,
              path: options.path
            });
          } catch (error) {
            pdfWin.destroy();
            console.error('PDF creation error:', error);
            resolve({ 
              success: false, 
              error: error.message || 'Failed to create PDF' 
            });
          }
        });
      });
    } catch (err) {
      console.error('Save PDF error:', err);
      return { success: false, error: err.message || 'Unknown PDF error' };
    }
  });
  
  // Get default PDF path
  safeHandle('get-pdf-path', async () => {
    try {
      const documentsPath = app.getPath('documents');
      const pdfPath = join(documentsPath, 'WilPOS', 'Facturas');
      
      // Ensure the directory exists
      await fs.ensureDir(pdfPath);
      
      return pdfPath;
    } catch (err) {
      console.error('Error getting PDF path:', err);
      return null;
    }
  });
}

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