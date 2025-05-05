// src/printing/thermal-printer.js
import { BrowserWindow } from 'electron';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import node-thermal-printer with error handling
let ThermalPrinter, PrinterTypes, CharacterSet;
try {
  const thermPrinter = require('node-thermal-printer');
  ThermalPrinter = thermPrinter.printer;
  PrinterTypes = thermPrinter.types;
  CharacterSet = thermPrinter.characterSets;
} catch (error) {
  console.error("Failed to import node-thermal-printer:", error);
  // Provide fallback implementations
  ThermalPrinter = class {
    constructor() {}
    isPrinterConnected() { return Promise.resolve(false); }
    write() {}
    execute() { return Promise.resolve(false); }
  };
  PrinterTypes = { EPSON: 'epson', STAR: 'star' };
  CharacterSet = { PC850_MULTILINGUAL: 'pc850_multilingual' };
}

/**
 * Gets a list of available printers
 * @returns {Promise<{success: boolean, printers: Array<{name: string, description?: string, isDefault?: boolean, isThermal?: boolean}>, error?: string}>}
 */
export async function getPrinters() {
  try {
    // Try to get printers using Electron's API
    const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
    if (win && typeof win.webContents.getPrinters === 'function') {
      const list = win.webContents.getPrinters();
      return {
        success: true,
        printers: list.map(p => ({
          name: p.name,
          description: p.description || '',
          isDefault: p.isDefault,
          isThermal: /thermal|receipt|80mm|58mm|epson|pos/i.test(p.name.toLowerCase())
        }))
      };
    }
    
    // Fallback if no printers found
    return {
      success: true,
      printers: [
        { name: 'Microsoft Print to PDF', isDefault: true, isThermal: false },
        { name: 'POS-80', isDefault: false, isThermal: true }
      ]
    };
  } catch (error) {
    console.error('Error getting printers:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
      printers: []
    };
  }
}

/**
 * Print content to a thermal printer
 * @param {Object} options - Print options
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function printWithThermalPrinter(options) {
  const { html, printerName, silent = true } = options;
  
  try {
    // Create a hidden browser window for printing
    const win = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true }
    });
    
    // Load the HTML content
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    
    // Print the content
    const printOptions = {
      silent: silent,
      printBackground: true,
      deviceName: printerName,
      margins: { marginType: 'none' },
      pageSize: options.options?.thermalPrinter ? 
        { width: 80000, height: 210000 } : undefined
    };
    
    const result = await win.webContents.print(printOptions);
    
    // Close the window
    win.close();
    
    return {
      success: result,
      message: result ? 'Print job sent successfully' : 'Failed to send print job'
    };
  } catch (error) {
    console.error('Error printing:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Save content as PDF
 * @param {Object} options - PDF options
 * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
 */
export async function savePdf(options) {
  const { directory, filename = 'document.pdf', html } = options;
  
  try {
    // Create a hidden browser window for PDF generation
    const win = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true }
    });
    
    // Load the HTML content
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    
    // Generate PDF path
    const pdfPath = `${directory}/${filename}`;
    
    // Generate the PDF
    await win.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'none' }
    }).then(data => {
      return require('fs').promises.writeFile(pdfPath, data);
    });
    
    // Close the window
    win.close();
    
    return {
      success: true,
      filePath: pdfPath
    };
  } catch (error) {
    console.error('Error saving PDF:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

export default {
  getPrinters,
  printWithThermalPrinter,
  savePdf
};