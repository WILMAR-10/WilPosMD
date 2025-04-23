// thermal-printer.js - Para incorporar en main.js
// Versión simplificada sin dependencias externas

const { app, ipcMain, BrowserWindow } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { load } = require('cheerio'); // Asegúrate de instalarlo con npm install cheerio

/**
 * Gets available printers for the system
 * @param {WebContents} webContents - The webContents to get printers from
 * @returns {Promise<Array>} List of available printers
 */
export async function getPrinters(webContents) {
  try {
    // Get printers using Electron's API
    const printers = webContents.getPrinters();
    
    // Format printers list with additional info
    return {
      success: true,
      printers: printers.map(printer => ({
        name: printer.name,
        displayName: printer.displayName || printer.name,
        description: printer.description || '',
        status: printer.status,
        isDefault: printer.isDefault,
        options: printer.options || {}
      }))
    };
  } catch (error) {
    console.error('Error getting printers:', error);
    return {
      success: false,
      error: error.message,
      printers: []
    };
  }
}

/**
 * Configura los manejadores IPC para impresoras térmicas sin usar node-thermal-printer
 */
function setupThermalPrinting() {
  console.log("🖨️ Configurando soporte de impresión térmica...");

  // Manejador para obtener lista de impresoras
  ipcMain.handle('getPrinters', async (event) => {
    try {
      console.log("Recuperando lista de impresoras...");
      const webContents = event.sender;
      let printers = [];
      
      // Intentar obtener impresoras a través de webContents
      if (webContents && webContents.getPrinters) {
        printers = webContents.getPrinters();
        console.log(`Se encontraron ${printers.length} impresoras`);
      } else if (webContents && webContents.getPrintersAsync) {
        // Soporte para versiones nuevas de Electron
        printers = await webContents.getPrintersAsync();
        console.log(`Se encontraron ${printers.length} impresoras (async)`);
      } else {
        console.warn("No se pudo acceder a la API de impresoras");
      }
      
      // Identificar impresoras térmicas por su nombre
      const processedPrinters = printers.map(printer => {
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
      
      return processedPrinters;
    } catch (error) {
      console.error('Error al obtener impresoras:', error);
      return [];
    }
  });

  // Mejorar el manejador de impresión
  ipcMain.handle('printInvoice', async (event, options) => {
    try {
      console.log(`Solicitud de impresión recibida para impresora: ${options.printerName || 'predeterminada'}`);
      
      if (!options?.html) {
        throw new Error('Contenido HTML requerido para impresión');
      }
      
      // Crear directorio temporal
      const tempDir = path.join(os.tmpdir(), 'wilpos-printer');
      await fs.ensureDir(tempDir);
      
      // Crear archivo HTML temporal
      const tempHtmlPath = path.join(tempDir, `print-${Date.now()}.html`);
      await fs.writeFile(tempHtmlPath, options.html);
      
      console.log(`Archivo de impresión creado en: ${tempHtmlPath}`);
      
      // Configurar opciones de impresión
      const printOptions = {
        silent: options.silent !== false,
        printBackground: true,
        deviceName: options.printerName || undefined,
        copies: options.copies || 1,
        margins: { 
          marginType: 'none' 
        },
        pageSize: options.options?.pageSize || 'A4'
      };
      
      // Configuraciones adicionales para impresora térmica
      if (options.options?.thermalPrinter) {
        // Establecer tamaño de papel según tipo de impresora térmica
        if (options.options.width === '58mm') {
          // Impresora térmica de 58mm
          printOptions.pageSize = { 
            width: 58000, // en microns
            height: 210000 // altura predeterminada, se ajusta según contenido
          };
        } else {
          // Impresora térmica de 80mm (caso predeterminado)
          printOptions.pageSize = { 
            width: 80000, // en microns
            height: 210000 // altura predeterminada, se ajusta según contenido
          };
        }
        
        // Sin márgenes para impresoras térmicas
        printOptions.margins = { marginType: 'none' };
      }
      
      console.log("Opciones de impresión:", printOptions);
      
      // Crear una ventana oculta para cargar y imprimir el HTML
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false
        }
      });
      
      // Cargar el archivo HTML
      await printWindow.loadFile(tempHtmlPath);
      
      // Esperar a que termine de cargar
      await new Promise(resolve => {
        printWindow.webContents.on('did-finish-load', resolve);
      });
      
      // Imprimir el contenido
      console.log("Enviando trabajo de impresión...");
      const success = await printWindow.webContents.print(printOptions);
      console.log(`Resultado de impresión: ${success ? "Éxito" : "Fallido"}`);
      
      // Limpiar
      printWindow.close();
      await fs.unlink(tempHtmlPath).catch(() => {});
      
      return { 
        success,
        message: success ? "Impresión enviada correctamente" : "Falló la impresión"
      };
      
    } catch (error) {
      console.error('Error durante la impresión:', error);
      
      // Intentar con método alternativo si falla
      try {
        console.log("Intentando método alternativo de impresión...");
        
        const simplifiedOptions = {
          silent: true,
          deviceName: options.printerName || undefined
        };
        
        const webContents = event.sender;
        const success = await webContents.print(simplifiedOptions);
        
        return { 
          success,
          message: success ? "Impresión (alternativa) enviada correctamente" : "Falló la impresión alternativa"
        };
      } catch (fallbackError) {
        console.error("Error en método alternativo:", fallbackError);
        
        return { 
          success: false, 
          error: `Error de impresión: ${error.message}`,
          fallbackError: fallbackError.message,
          needManualPrint: true
        };
      }
    }
  });

  // Manejador para guardar como PDF
  ipcMain.handle('savePdf', async (event, options) => {
    try {
      console.log(`Solicitud para guardar PDF en: ${options.path}`);
      
      if (!options?.html) {
        throw new Error('Contenido HTML requerido para PDF');
      }
      
      if (!options.path) {
        throw new Error('Ruta de destino requerida para PDF');
      }
      
      // Crear directorio si no existe
      const dir = path.dirname(options.path);
      await fs.ensureDir(dir);
      
      // Crear archivo HTML temporal
      const tempDir = path.join(os.tmpdir(), 'wilpos-pdf');
      await fs.ensureDir(tempDir);
      const tempHtmlPath = path.join(tempDir, `pdf-${Date.now()}.html`);
      await fs.writeFile(tempHtmlPath, options.html);
      
      // Configurar opciones PDF
      const pdfOptions = {
        printBackground: options.options?.printBackground !== false,
        margins: options.options?.margins || {
          top: 0.4,
          bottom: 0.4,
          left: 0.4,
          right: 0.4
        },
        pageSize: options.options?.pageSize || 'A4'
      };
      
      // Crear ventana oculta para generar PDF
      const pdfWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false
        }
      });
      
      // Cargar HTML
      await pdfWindow.loadFile(tempHtmlPath);
      
      // Generar PDF
      console.log("Generando PDF...");
      const pdfData = await pdfWindow.webContents.printToPDF(pdfOptions);
      
      // Guardar PDF
      await fs.writeFile(options.path, pdfData);
      console.log(`PDF guardado en ${options.path}`);
      
      // Limpiar
      pdfWindow.close();
      await fs.unlink(tempHtmlPath).catch(() => {});
      
      return {
        success: true,
        path: options.path
      };
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      return {
        success: false,
        error: `Error al generar PDF: ${error.message}`
      };
    }
  });

  // Manejador para abrir carpetas
  ipcMain.handle('openFolder', async (event, folderPath) => {
    try {
      if (!folderPath) {
        throw new Error('Ruta de carpeta requerida');
      }
      
      // Crear carpeta si no existe
      await fs.ensureDir(folderPath);
      
      // Abrir carpeta con la aplicación predeterminada
      const opened = await shell.openPath(folderPath);
      
      if (opened !== '') {
        console.error(`Error abriendo carpeta: ${opened}`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error abriendo carpeta:', error);
      return false;
    }
  });
}

// Exportar la función para usar en main.js
module.exports = {
  setupThermalPrinting
};