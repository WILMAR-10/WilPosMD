// main.js - Versión simplificada aplicando principios SOLID y DRY
import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import path, { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { createRequire } from 'module';

// Database imports
import {
  initializeDatabase,
  setupIpcHandlers,
  closeDB
} from './src/database/index.js';

// ESC/POS printer support
const requireModule = createRequire(import.meta.url);
let escPrinter = null;

try {
  // Intentar cargar node-escpos-print
  escPrinter = requireModule('node-escpos-print');
  console.log('✅ node-escpos-print cargado correctamente');
} catch (err) {
  console.warn('⚠️ node-escpos-print no disponible:', err.message);
}

// Constantes
const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const windowCache = new Map();
let mainWindow = null;

console.log("🚀 Iniciando WilPOS");
console.log("📂 Ruta de la app:", __dirname);
console.log("🔧 Modo desarrollo:", isDev);

/**
 * Utilidad para registro seguro de handlers IPC - Principio DRY
 */
function safeHandle(channel, handler) {
  try { 
    ipcMain.removeHandler(channel); 
  } catch {} // Ignorar errores si no existe
  
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      console.error(`Error en handler ${channel}:`, error);
      return { success: false, error: error.message };
    }
  });
}

/**
 * Configuración de controles de ventana - Principio de Responsabilidad Única
 */
function setupWindowControls() {
  const createWindowHandler = (action) => (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) {
      throw new Error('Ventana no encontrada');
    }
    return action(win);
  };

  safeHandle('minimize', createWindowHandler(win => { win.minimize(); return true; }));
  safeHandle('maximize', createWindowHandler(win => {
    if (win.isMaximized()) {
      win.unmaximize();
      return false;
    }
    win.maximize();
    return true;
  }));
  safeHandle('close', createWindowHandler(win => { win.close(); return true; }));
}

/**
 * Servicio de impresión simplificado - Principio de Responsabilidad Única
 */
class PrinterService {
  constructor() {
    this.setupHandlers();
  }

  setupHandlers() {
    // Obtener lista de impresoras
    safeHandle('get-printers', async () => {
      if (!escPrinter) {
        return { success: false, error: 'Módulo de impresión no disponible' };
      }

      try {
        const printers = escPrinter.getPrinters();
        return printers.map(printer => ({
          name: printer.name,
          isDefault: printer.isDefault || false,
          status: printer.status || 'available'
        }));
      } catch (error) {
        console.error('Error obteniendo impresoras:', error);
        return [];
      }
    });

    // Imprimir texto raw (ESC/POS)
    safeHandle('print-raw', async (event, data, printerName) => {
      if (!escPrinter) {
        return { success: false, error: 'Módulo de impresión no disponible' };
      }

      try {
        const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
        
        await escPrinter.print({
          data: buffer,
          printer: printerName || undefined,
          type: 'RAW'
        });

        return { success: true };
      } catch (error) {
        console.error('Error imprimiendo:', error);
        return { success: false, error: error.message };
      }
    });

    // Prueba de impresión
    safeHandle('test-printer', async (event, { printerName }) => {
      if (!escPrinter) {
        return { success: false, error: 'Módulo de impresión no disponible' };
      }

      try {
        const testData = [
          '\x1B\x40',          // Inicializar
          '\x1B\x61\x01',     // Centrar
          '\x1B\x45\x01',     // Negrita
          'PRUEBA WilPOS\n',
          '\x1B\x45\x00',     // Normal
          `Fecha: ${new Date().toLocaleString()}\n`,
          '\n\nPrueba exitosa!\n\n',
          '\x1D\x56\x00'      // Cortar papel
        ].join('');

        await escPrinter.print({
          data: Buffer.from(testData, 'utf8'),
          printer: printerName || undefined,
          type: 'RAW'
        });

        return { success: true };
      } catch (error) {
        console.error('Error en prueba de impresión:', error);
        return { success: false, error: error.message };
      }
    });

    // Guardar PDF
    safeHandle('save-pdf', async (event, { html, path: outPath, options }) => {
      try {
        const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
        
        await win.loadURL(`data:text/html,${encodeURIComponent(html)}`);
        
        const pdfOptions = {
          printBackground: true,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          ...options
        };
        
        const pdf = await win.webContents.printToPDF(pdfOptions);
        await fs.ensureDir(dirname(outPath));
        await fs.writeFile(outPath, pdf);
        
        win.destroy();
        
        return { success: true, path: outPath };
      } catch (error) {
        console.error('Error guardando PDF:', error);
        return { success: false, error: error.message };
      }
    });
  }
}

/**
 * Servicio de gestión de ventanas - Principio de Responsabilidad Única
 */
class WindowService {
  constructor() {
    this.setupHandlers();
  }

  setupHandlers() {
    // Identificar ventana actual
    safeHandle('identifyWindow', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) {
        return { type: "unknown", error: "Ventana no encontrada" };
      }

      const url = event.sender.getURL();
      let component = null;

      try {
        const urlObj = new URL(url);
        component = urlObj.searchParams.get('component');
      } catch (e) {
        console.error("Error parseando URL:", e);
      }

      return {
        type: component ? 'component' : 'main',
        id: win.id,
        component
      };
    });

    // Abrir ventana de componente
    safeHandle('openComponentWindow', async (event, componentName) => {
      // Reutilizar ventana existente si está disponible
      if (windowCache.has(componentName)) {
        const cachedWin = windowCache.get(componentName);
        if (!cachedWin.isDestroyed()) {
          cachedWin.focus();
          return { windowId: cachedWin.id, cached: true, success: true };
        }
        windowCache.delete(componentName);
      }

      // Crear nueva ventana
      const newWin = new BrowserWindow({
        width: 1000,
        height: 700,
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

      // Limpiar cache cuando se cierre
      newWin.on('closed', () => {
        windowCache.delete(componentName);
      });

      return { windowId: newWin.id, cached: false, success: true };
    });
  }
}

/**
 * Servicio de sistema de archivos - Principio de Responsabilidad Única
 */
class FileService {
  constructor() {
    this.setupHandlers();
  }

  setupHandlers() {
    // Abrir carpeta
    safeHandle('openFolder', async (event, folderPath) => {
      await fs.ensureDir(folderPath);
      await shell.openPath(folderPath);
      return true;
    });

    // Asegurar que directorio existe
    safeHandle('ensureDir', async (event, folderPath) => {
      await fs.ensureDir(folderPath);
      return { success: true };
    });

    // Obtener rutas de la aplicación
    safeHandle('getAppPaths', () => ({
      userData: app.getPath('userData'),
      documents: app.getPath('documents'),
      downloads: app.getPath('downloads'),
      temp: app.getPath('temp'),
      exe: app.getPath('exe'),
      appData: app.getPath('appData'),
      appPath: app.getAppPath()
    }));
  }
}

/**
 * Crear ventana principal
 */
function createMainWindow() {
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

  const url = isDev
    ? 'http://localhost:3000'
    : `file://${join(__dirname, 'dist/index.html')}`;

  console.log('Cargando URL:', url);

  mainWindow.webContents.on('did-fail-load', () => {
    console.error('Error cargando URL:', url);
    mainWindow.loadURL('data:text/html,<h1>Error</h1><p>No se pudo cargar la aplicación.</p>');
  });

  mainWindow.loadURL(url);
  
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

/**
 * Inicialización de la aplicación
 */
app.whenReady().then(async () => {
  try {
    // Limpiar cache
    await session.defaultSession.clearCache();
    console.log('🧹 Cache de sesión limpiado');

    // Inicializar base de datos
    await initializeDatabase();
    console.log('✅ Base de datos inicializada');

    // Configurar servicios
    setupIpcHandlers(); // Handlers de base de datos
    setupWindowControls();
    new PrinterService();
    new WindowService();
    new FileService();
    console.log('✅ Servicios configurados');

    // Crear ventana principal
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  } catch (err) {
    console.error('❌ Error en inicialización:', err);
    app.quit();
  }
});

/**
 * Eventos del ciclo de vida de la aplicación
 */
app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  // Cerrar todas las ventanas en cache
  windowCache.forEach(win => {
    if (!win.isDestroyed()) {
      win.destroy();
    }
  });
  windowCache.clear();
  
  // Cerrar base de datos
  try {
    closeDB();
  } catch (error) {
    console.error('Error cerrando base de datos:', error);
  }
});

app.on('will-quit', () => {
  // Limpiar archivos temporales
  const tempDir = join(app.getPath('temp'), 'wilpos-prints');
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('Error limpiando archivos temporales:', error);
  }
});