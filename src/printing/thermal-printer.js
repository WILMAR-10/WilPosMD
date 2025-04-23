import { app, BrowserWindow, shell, ipcMain } from 'electron';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

/**
 * Gets available printers for the system
 * @param {Electron.WebContents} webContents - The webContents to get printers from
 * @returns {Promise<Object>} List of available printers
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
 * @param {Electron.IpcMainInvokeEvent} event - IPC event 
 * @param {Object} options - Print options
 * @param {string} tempHtmlPath - Path to temporary HTML file
 * @returns {Promise<Object>} Result of print operation
 */
export async function printWithElectron(event, options, tempHtmlPath) {
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
 * Setup IPC handlers for thermal printing and PDF generation
 * This can be imported and called in main.js
 * @param {Object} ipcMain - Electron's ipcMain module
 * @param {Object} app - Electron's app module
 */
export function setupThermalPrintingHandlers(ipcMain, app) {
  console.log("🖨️ Setting up thermal printing handlers...");

  // Logging middleware for print requests
  const logPrintRequest = (options) => {
    console.log(`Print request for printer: ${options.printerName || 'default'}`);
    console.log(`Paper size: ${options.options?.width || 'standard'}`);
    console.log(`Silent mode: ${options.silent}`);
  };

  // Handler for print requests
  ipcMain.handle('printInvoice', async (event, options) => {
    try {
      logPrintRequest(options);
      
      // Create temp directory for print jobs
      const tempDir = path.join(app.getPath('temp'), 'wilpos-prints');
      await fs.ensureDir(tempDir);
      const tempHtmlPath = path.join(tempDir, `print-${Date.now()}.html`);
      
      // Write HTML to temp file
      await fs.writeFile(tempHtmlPath, options.html);
      
      let result;
      
      // Use appropriate print method based on options
      if (options.options?.thermalPrinter) {
        result = await printWithThermalPrinter(options, tempHtmlPath);
      } else {
        result = await printWithElectron(event, options, tempHtmlPath);
      }
      
      // Clean up temp file after printing
      fs.unlink(tempHtmlPath).catch(() => {});
      
      return result;
    } catch (error) {
      console.error('Print handler error:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  // Handler for getting printers
  ipcMain.handle('getPrinters', async (event) => {
    console.log("Getting printer list...");
    return getPrinters(event.sender);
  });

  // Handler for PDF generation
  ipcMain.handle('savePdf', async (event, options) => {
    try {
      if (!options.html || !options.path) {
        throw new Error('Missing required parameters: html and path');
      }
      
      console.log(`Generating PDF at: ${options.path}`);
      
      // Create directory if needed
      const pdfDir = path.dirname(options.path);
      await fs.ensureDir(pdfDir);
      
      // Create temp HTML file
      const tempDir = path.join(app.getPath('temp'), 'wilpos-pdf');
      await fs.ensureDir(tempDir);
      const tempHtmlPath = path.join(tempDir, `pdf-${Date.now()}.html`);
      await fs.writeFile(tempHtmlPath, options.html);
      
      // Configure PDF window
      const pdfWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false
        }
      });
      
      await pdfWindow.loadFile(tempHtmlPath);
      
      // PDF generation options
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
      
      // Generate and save PDF
      const pdfData = await pdfWindow.webContents.printToPDF(pdfOptions);
      await fs.writeFile(options.path, pdfData);
      
      // Clean up
      pdfWindow.close();
      await fs.unlink(tempHtmlPath).catch(() => {});
      
      return {
        success: true,
        path: options.path
      };
    } catch (error) {
      console.error('PDF generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}

export default {
  getPrinters,
  printWithElectron,
  printWithThermalPrinter,
  setupThermalPrintingHandlers
};