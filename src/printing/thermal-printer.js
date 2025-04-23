import { app, BrowserWindow, shell, ipcMain } from 'electron';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

/**
 * Gets available printers for the system
 * @param {Electron.WebContents} webContents - The webContents to get printers from
 * @returns {Promise<Array>} List of available printers
 */
export async function getPrinters(webContents) {
  try {
    // Get printers using Electron's API
    const printers = webContents.getPrinters();
    
    // Format printers list with additional info
    return printers.map(printer => ({
      name: printer.name,
      displayName: printer.displayName || printer.name,
      description: printer.description || '',
      status: printer.status,
      isDefault: printer.isDefault,
      isThermal: isThermalPrinter(printer.name),
      options: printer.options || {}
    }));
  } catch (error) {
    console.error('Error getting printers:', error);
    return [];
  }
}

/**
 * Determines if a printer is likely a thermal printer based on its name
 * @param {string} printerName - The name of the printer to check
 * @returns {boolean} Whether the printer is likely a thermal printer
 */
function isThermalPrinter(printerName) {
  if (!printerName) return false;
  
  const name = printerName.toLowerCase();
  return name.includes('thermal') || 
         name.includes('receipt') || 
         name.includes('pos') || 
         name.includes('80mm') || 
         name.includes('58mm');
}

/**
 * Print using a separate window for thermal printing
 * @param {Object} options - Print options
 * @param {string} tempHtmlPath - Path to temporary HTML file
 * @returns {Promise<Object>} Result of print operation
 */
export async function printWithThermalPrinter(options, tempHtmlPath) {
  try {
    // Create a window specifically for printing
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    
    // Load the HTML file
    await printWindow.loadFile(tempHtmlPath);
    
    // Wait for load to complete
    await new Promise(resolve => {
      printWindow.webContents.on('did-finish-load', resolve);
    });
    
    // Configure print options
    const printOptions = {
      silent: options.silent !== false,
      printBackground: true,
      deviceName: options.printerName || undefined,
      copies: options.copies || 1,
      margins: { marginType: 'none' }
    };
    
    // If thermal printer, set custom page size
    if (options.options?.thermalPrinter) {
      const width = options.options.width || '80mm';
      printOptions.pageSize = width === '58mm' 
        ? { width: 58000, height: 210000 } // 58mm printer (in microns)
        : { width: 80000, height: 210000 }; // 80mm printer (in microns)
    }
    
    // Print the content
    console.log('Printing with options:', printOptions);
    const success = await printWindow.webContents.print(printOptions);
    
    // Clean up
    printWindow.close();
    
    return { 
      success,
      message: success ? 'Print job sent successfully' : 'Failed to print'
    };
  } catch (error) {
    console.error('Error in printWithThermalPrinter:', error);
    return { success: false, error: error.message };
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
      silent: false, // Show print dialog
      printBackground: true,
      deviceName: options.printerName || undefined,
      copies: options.copies || 1
    };
    
    // Print the content
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
 * Generate PDF from HTML content
 * @param {Object} options - PDF generation options
 * @returns {Promise<Object>} Result of PDF generation
 */
export async function generatePDF(options) {
  try {
    if (!options?.html) {
      throw new Error('HTML content required for PDF generation');
    }
    
    if (!options.path) {
      throw new Error('Destination path required for PDF');
    }
    
    // Create directory if it doesn't exist
    const dir = path.dirname(options.path);
    await fs.ensureDir(dir);
    
    // Create temporary HTML file
    const tempDir = path.join(os.tmpdir(), 'wilpos-pdf');
    await fs.ensureDir(tempDir);
    const tempHtmlPath = path.join(tempDir, `pdf-${Date.now()}.html`);
    await fs.writeFile(tempHtmlPath, options.html);
    
    // Configure PDF options
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
    
    // Create hidden window for PDF generation
    const pdfWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    
    // Load HTML
    await pdfWindow.loadFile(tempHtmlPath);
    
    // Generate PDF
    console.log("Generating PDF...");
    const pdfData = await pdfWindow.webContents.printToPDF(pdfOptions);
    
    // Save PDF
    await fs.writeFile(options.path, pdfData);
    console.log(`PDF saved to ${options.path}`);
    
    // Clean up
    pdfWindow.close();
    await fs.unlink(tempHtmlPath).catch(() => {});
    
    return {
      success: true,
      path: options.path
    };
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    return {
      success: false,
      error: `Error generating PDF: ${error.message}`
    };
  }
}

/**
 * Prepares a temporary HTML file for printing
 * @param {string} html - HTML content
 * @returns {Promise<string>} Path to temporary HTML file
 */
export async function prepareHtmlFile(html) {
  // Create temporary directory
  const tempDir = path.join(os.tmpdir(), 'wilpos-printer');
  await fs.ensureDir(tempDir);
  
  // Create temporary HTML file
  const tempHtmlPath = path.join(tempDir, `print-${Date.now()}.html`);
  await fs.writeFile(tempHtmlPath, html);
  
  return tempHtmlPath;
}

/**
 * Sets up IPC handlers for thermal printing
 */
export function setupThermalPrinting() {
  console.log("🖨️ Setting up thermal printing support...");

  // Handler for getting printer list
  ipcMain.handle('getPrinters', async (event) => {
    try {
      console.log("Retrieving printer list...");
      return await getPrinters(event.sender);
    } catch (error) {
      console.error('Error getting printers:', error);
      return [];
    }
  });

  // Handler for printing invoices
  ipcMain.handle('printInvoice', async (event, options) => {
    try {
      console.log(`Print request received for printer: ${options.printerName || 'default'}`);
      
      if (!options?.html) {
        throw new Error('HTML content required for printing');
      }
      
      // Create temporary HTML file
      const tempHtmlPath = await prepareHtmlFile(options.html);
      
      // Print using thermal printer
      const result = await printWithThermalPrinter(options, tempHtmlPath);
      
      // Clean up
      await fs.unlink(tempHtmlPath).catch(() => {});
      
      return result;
    } catch (error) {
      console.error('Error during printing:', error);
      return { 
        success: false, 
        error: `Print error: ${error.message}`,
        needManualPrint: true
      };
    }
  });

  // Handler for saving as PDF
  ipcMain.handle('savePdf', async (event, options) => {
    return await generatePDF(options);
  });

  // Handler for opening folders
  ipcMain.handle('openFolder', async (event, folderPath) => {
    try {
      if (!folderPath) {
        throw new Error('Folder path required');
      }
      
      // Create folder if it doesn't exist
      await fs.ensureDir(folderPath);
      
      // Open folder with default application
      const opened = await shell.openPath(folderPath);
      
      if (opened !== '') {
        console.error(`Error opening folder: ${opened}`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error opening folder:', error);
      return false;
    }
  });
}