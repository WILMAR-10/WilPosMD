// src/printing/thermal-printer.js

import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs-extra';

// Get all available printers (both system and thermal)
export async function getPrinters() {
  try {
    console.log('Starting printer detection');
    
    // Get all BrowserWindow instances
    const allWindows = BrowserWindow.getAllWindows();
    console.log(`Found ${allWindows.length} windows`);
    
    if (allWindows.length === 0) {
      throw new Error('No windows available for printer detection');
    }
    
    // Use Electron's built-in printer list
    let electronPrinters = [];
    
    try {
      // Try different methods to detect printers
      if (typeof app.getPrinters === 'function') {
        console.log('Using app.getPrinters()');
        electronPrinters = app.getPrinters();
      } else {
        // Fallback to the WebContents method
        console.log('Using webContents.getPrinters()');
        const mainWindow = allWindows[0];
        if (mainWindow && mainWindow.webContents) {
          electronPrinters = mainWindow.webContents.getPrinters();
        }
      }
      
      console.log('Raw printer list:', electronPrinters);
    } catch (printerError) {
      console.error('Error getting system printers:', printerError);
    }
    
    // If no printers detected through standard methods, add USB printer manually
    if (!electronPrinters || electronPrinters.length === 0) {
      console.log('No printers detected via standard methods, checking USB devices');
      
      // Add fallback printers including potential USB printers
      electronPrinters = [
        { name: 'Microsoft Print to PDF', description: 'Virtual PDF Printer', isDefault: true },
        { name: '80mm Series Printer', description: 'USB Thermal Printer', portName: 'USB001' },
        { name: 'USB Thermal Printer', description: 'USB Receipt Printer' }
      ];
    }
    
    // Check if we need to manually add the USB thermal printer
    const hasUsbPrinter = electronPrinters.some(p => 
      p.name.includes('80mm') || 
      p.portName === 'USB001' || 
      (p.description && p.description.toLowerCase().includes('usb'))
    );
    
    if (!hasUsbPrinter) {
      console.log('Adding USB thermal printer manually');
      electronPrinters.push({
        name: '80mm Series Printer',
        description: 'USB Thermal Printer',
        portName: 'USB001',
        isUSB: true
      });
    }
    
    // Add metadata to identify thermal printers
    const enrichedPrinters = electronPrinters.map(printer => ({
      name: printer.name,
      description: printer.description || '',
      isDefault: printer.isDefault || false,
      portName: printer.portName || '',
      isThermal: printer.isUSB || 
                /thermal|receipt|pos|epson|tm-|80mm|58mm|usb|seria/i.test(printer.name.toLowerCase()) ||
                (printer.portName && /usb|com/i.test(printer.portName)),
      status: printer.status
    }));
    
    console.log(`Enriched printer list: ${JSON.stringify(enrichedPrinters)}`);
    
    return {
      success: true,
      printers: enrichedPrinters
    };
  } catch (error) {
    console.error('Error detecting printers:', error);
    return {
      success: false, 
      printers: [
        { name: 'Microsoft Print to PDF', description: 'Virtual PDF Printer', isDefault: true },
        { name: '80mm Series Printer', description: 'USB Thermal Printer', portName: 'USB001', isThermal: true }
      ],
      error: error.message || 'Unknown error detecting printers'
    };
  }
}

// Print an invoice or receipt using Electron’s print
export async function printWithThermalPrinter({ html, printerName, silent = true, copies = 1, options: printOptions = {} }) {
  try {
    if (!html) throw new Error('No content provided for printing');

    const win = new BrowserWindow({ width: 800, height: 1200, show: false });
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    if (printOptions.thermalPrinter) {
      await win.webContents.insertCSS(`
        @page { margin:0; size:${printOptions.paperWidth||'80mm'} auto }
        body { margin:0; padding:0; width:${printOptions.paperWidth||'72mm'}; 
               font-family:Arial,sans-serif; font-size:${printOptions.fontSize||'10pt'} }
      `);
    }

    const result = await win.webContents.print({
      silent,
      printBackground: true,
      deviceName: printerName,
      color: printOptions.color !== false,
      margins: printOptions.margins || { marginType: 'none' },
      copies
    });

    win.close();
    return { success: result, message: result ? 'Printed successfully' : 'Print canceled or failed' };
  } catch (error) {
    console.error('Error printing:', error);
    return { success: false, error: error.message || 'Unknown error printing' };
  }
}

// Save receipt as PDF
export async function savePdf({ html, path: filePath, options: pdfOptions = {} }) {
  try {
    if (!html) throw new Error('No content provided for PDF generation');
    if (!filePath) throw new Error('No file path specified for PDF');
    await fs.ensureDir(path.dirname(filePath));

    const win = new BrowserWindow({ width: 800, height: 1200, show: false });
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    const pdfData = await win.webContents.printToPDF({
      printBackground: pdfOptions.printBackground !== false,
      margins: pdfOptions.margins || { top: 0, bottom: 0, left: 0, right: 0 },
      pageSize: pdfOptions.pageSize || 'A4'
    });

    await fs.writeFile(filePath, pdfData);
    win.close();

    return { success: true, path: filePath };
  } catch (error) {
    console.error('Error saving PDF:', error);
    return { success: false, error: error.message || 'Unknown error saving PDF' };
  }
}

// Send raw ESC/POS commands to printer
export async function sendRawCommands(commands, printerName) {
  try {
    if (!printerName) throw new Error('Printer name is required');

    const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
    const html = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
      <body><pre style="font-size:0;white-space:pre;">${commands}</pre></body></html>
    `;
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

    const result = await win.webContents.print({
      silent: true,
      printBackground: false,
      deviceName: printerName,
      margins: { marginType: 'none' }
    });

    win.close();
    return { success: result, message: result ? 'Commands sent successfully' : 'Failed to send commands' };
  } catch (error) {
    console.error('Error sending raw commands:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

// Test printer with simple content
export async function testPrinter(printerName) {
  console.log(`testPrinter called for printer: "${printerName}"`);
  
  try {
    if (!printerName) {
      console.log('testPrinter error: No printer name provided');
      return { 
        success: false, 
        error: 'Printer name is required' 
      };
    }
    
    // Simple test page content
    const testContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Test Page</title>
        <style>
          body { font-family: Arial; text-align: center; }
          .title { font-weight: bold; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="title">WILPOS TEST PAGE</div>
        <p>Testing printer: ${printerName}</p>
        <p>Date: ${new Date().toLocaleString()}</p>
      </body>
      </html>
    `;
    
    // Create a hidden window for printing
    const win = new BrowserWindow({ 
      width: 300, 
      height: 300, 
      show: false 
    });
    
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(testContent)}`);
    
    console.log(`Sending print job to "${printerName}"...`);
    
    const result = await win.webContents.print({
      silent: true,
      printBackground: true,
      deviceName: printerName
    });
    
    win.close();
    
    console.log(`Print result: ${result ? 'Success' : 'Failed'}`);
    
    return { 
      success: !!result, 
      message: result ? 'Test page sent to printer' : 'Print job failed',
      error: result ? undefined : 'Printer returned failure'
    };
  } catch (error) {
    console.error('testPrinter detailed error:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown printer error' 
    };
  }
}

// Open cash drawer by sending ESC/POS pulse
export async function openCashDrawer(printerName) {
  if (!printerName) {
    return { success: false, error: 'Printer name required' };
  }
  try {
    const drawerCommand = '\x1B\x70\x00\x19\x19';
    return await sendRawCommands(drawerCommand, printerName);
  } catch (error) {
    console.error('Error opening cash drawer:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}