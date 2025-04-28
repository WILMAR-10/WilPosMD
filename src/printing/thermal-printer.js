import { app, BrowserWindow, shell, ipcMain } from 'electron';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

/**
 * Gets available printers for the system
 * @returns {Promise<Object>} List of available printers
 */
export async function getPrinters() {
  try {
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length === 0) {
      throw new Error('No windows available to get printers');
    }
    
    const mainWindow = allWindows[0];
    const printers = mainWindow.webContents.getPrinters();
    
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
 * Print using thermal printer optimized settings
 * @param {Object} options - Print options with thermal printer settings
 * @param {string} tempHtmlPath - Path to temporary HTML file
 * @returns {Promise<Object>} Result of print operation
 */
export async function printWithThermalPrinter(options, tempHtmlPath) {
  try {
    console.log(`Printing with thermal printer: ${options.printerName || 'default'}`);
    
    // Create a hidden window to handle thermal printing
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    
    // Load the HTML file
    await printWindow.loadFile(tempHtmlPath);
    
    // Wait for content to load completely
    await new Promise(resolve => {
      printWindow.webContents.on('did-finish-load', resolve);
    });
    
    // Configure print options specifically for thermal printing
    const printOptions = {
      silent: options.silent !== false,
      printBackground: true,
      deviceName: options.printerName || undefined,
      copies: options.copies || 1,
      margins: { 
        marginType: 'none' 
      }
    };
    
    // Set page size based on the printer width
    if (options.options?.width === '58mm') {
      // For 58mm thermal printers
      printOptions.pageSize = { 
        width: 58000, // in microns
        height: 210000 // default height, will adjust based on content
      };
    } else {
      // For 80mm thermal printers (default)
      printOptions.pageSize = { 
        width: 80000, // in microns
        height: 210000 // default height, will adjust based on content
      };
    }
    
    console.log("Sending thermal print job with options:", printOptions);
    const success = await printWindow.webContents.print(printOptions);
    
    // Clean up
    printWindow.close();
    
    return { 
      success,
      message: success ? "Thermal print job sent successfully" : "Thermal print failed"
    };
  } catch (error) {
    console.error('Error in printWithThermalPrinter:', error);
    
    // Try alternative method if first attempt fails
    try {
      console.log("Attempting alternative thermal printing method...");
      
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false
        }
      });
      
      await printWindow.loadFile(tempHtmlPath);
      
      // Simplified options for fallback
      const simplifiedOptions = {
        silent: true,
        deviceName: options.printerName || undefined,
        printBackground: true
      };
      
      const success = await printWindow.webContents.print(simplifiedOptions);
      printWindow.close();
      
      return { 
        success, 
        message: success ? "Print job sent with fallback method" : "Fallback print failed" 
      };
    } catch (fallbackError) {
      console.error("Fallback printing also failed:", fallbackError);
      return { 
        success: false, 
        error: `Printing failed: ${error.message}. Fallback also failed: ${fallbackError.message}`
      };
    }
  }
}

/**
 * Print using Electron's standard print dialog
 * @param {Object} options - Print options
 * @param {string} tempHtmlPath - Path to temporary HTML file
 * @returns {Promise<Object>} Result of print operation
 */
export async function printWithElectron(options, tempHtmlPath) {
  // After: Simplified signature
  try {
    // Create a window for printing
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    
    // Load the HTML file
    await printWindow.loadFile(tempHtmlPath);
    
    // Wait for content to load
    await new Promise(resolve => {
      printWindow.webContents.on('did-finish-load', resolve);
    });
    
    // Configure print options
    const printOptions = {
      silent: options.silent !== false,
      printBackground: true,
      deviceName: options.printerName || undefined,
      copies: options.copies || 1,
      pageSize: options.options?.pageSize || 'A4'
    };
    
    console.log("Sending standard print job with options:", printOptions);
    const success = await printWindow.webContents.print(printOptions);
    
    // Clean up
    printWindow.close();
    
    return { 
      success,
      message: success ? 'Print job sent successfully' : 'Print canceled or failed'
    };
  } catch (error) {
    console.error('Error in printWithElectron:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save HTML as PDF
 * @param {Object} options – { html: string, path: string, options?: { printBackground, margins, pageSize } }
 * @returns {Promise<{success: boolean, path: string}>}
 */
export async function savePdf(options) {
  if (!options.html || !options.path) {
    throw new Error('Missing required parameters: html and path');
  }
  console.log(`Generating PDF at: ${options.path}`);
  const pdfDir = path.dirname(options.path);
  await fs.ensureDir(pdfDir);

  const tempDir = path.join(app.getPath('temp'), 'wilpos-pdf');
  await fs.ensureDir(tempDir);
  const tempHtmlPath = path.join(tempDir, `pdf-${Date.now()}.html`);
  await fs.writeFile(tempHtmlPath, options.html);

  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  await pdfWindow.loadFile(tempHtmlPath);

  const pdfOptions = {
    printBackground: options.options?.printBackground !== false,
    margins: options.options?.margins || { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    pageSize: options.options?.pageSize || 'A4'
  };
  const pdfData = await pdfWindow.webContents.printToPDF(pdfOptions);
  await fs.writeFile(options.path, pdfData);

  pdfWindow.close();
  await fs.unlink(tempHtmlPath).catch(() => {});

  return { success: true, path: options.path };
}

/**
 * Setup IPC handlers for thermal printing and PDF generation
 * This can be imported and called in main.js
 * @param {Object} ipcMain - Electron's ipcMain module
 * @param {Object} app - Electron's app module
 */
export function setupThermalPrintingHandlers(ipcMain, app) {
  console.log("🖨️ Setting up thermal printing handlers...");

  // Safe handler registration function
  const safeRegisterHandler = (channel, handler) => {
    try {
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, handler);
      console.log(`Registered handler for ${channel}`);
    } catch (error) {
      console.warn(`Error registering handler for ${channel}:`, error);
    }
  };

  // Register 'getPrinters'
  safeRegisterHandler('getPrinters', async () => {
    console.log("Getting printer list...");
    return getPrinters();
  });

  // Register 'printInvoice'
  safeRegisterHandler('printInvoice', async (event, options) => {
    console.log(`Print request for printer: ${options.printerName || 'default'}`);
    console.log(`Paper size: ${options.options?.width || 'standard'}`);
    console.log(`Silent mode: ${options.silent}`);

    const tempDir = path.join(app.getPath('temp'), 'wilpos-prints');
    await fs.ensureDir(tempDir);
    const tempHtmlPath = path.join(tempDir, `print-${Date.now()}.html`);
    await fs.writeFile(tempHtmlPath, options.html);

    let result;
    if (options.options?.thermalPrinter) {
      result = await printWithThermalPrinter(options, tempHtmlPath);
    } else {
      result = await printWithElectron(options, tempHtmlPath);
    }

    fs.unlink(tempHtmlPath).catch(() => {});
    return result;
  });

  // Register 'savePdf'
  safeRegisterHandler('savePdf', async (event, options) => {
    if (!options.html || !options.path) {
      throw new Error('Missing required parameters: html and path');
    }

    console.log(`Generating PDF at: ${options.path}`);
    const pdfDir = path.dirname(options.path);
    await fs.ensureDir(pdfDir);

    const tempDir = path.join(app.getPath('temp'), 'wilpos-pdf');
    await fs.ensureDir(tempDir);
    const tempHtmlPath = path.join(tempDir, `pdf-${Date.now()}.html`);
    await fs.writeFile(tempHtmlPath, options.html);

    const pdfWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    await pdfWindow.loadFile(tempHtmlPath);

    const pdfOptions = {
      printBackground: options.options?.printBackground !== false,
      margins: options.options?.margins || { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
      pageSize: options.options?.pageSize || 'A4'
    };
    const pdfData = await pdfWindow.webContents.printToPDF(pdfOptions);
    await fs.writeFile(options.path, pdfData);

    pdfWindow.close();
    await fs.unlink(tempHtmlPath).catch(() => {});
    return { success: true, path: options.path };
  });
}

export default {
  getPrinters,
  printWithElectron,
  printWithThermalPrinter,
  savePdf,
  setupThermalPrintingHandlers
};