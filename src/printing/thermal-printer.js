// src/printing/thermal-printer.js
import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Capacidad mejorada de detección de impresoras
export async function getPrinters() {
  try {
    console.log('🔍 Iniciando detección completa de impresoras...');
    
    // 1. Intentar detectar impresoras vía Electron webContents
    const electronPrinters = await getElectronPrinters();
    
    // 2. Detectar dispositivos USB que podrían ser impresoras
    const usbPrinters = await detectUSBPrinters();
    
    // 3. Detectar impresoras en puertos serie
    const serialPrinters = await detectSerialPrinters();
    
    // Combinar resultados eliminando duplicados
    const allPrinters = mergeAndDeduplicate([
      ...electronPrinters,
      ...usbPrinters,
      ...serialPrinters
    ]);
    
    console.log(`✅ Detección completada: ${allPrinters.length} impresoras encontradas`);
    
    return {
      success: true,
      printers: allPrinters
    };
  } catch (err) {
    console.error('❌ Error en detección de impresoras:', err);
    return { 
      success: true, 
      printers: await detectCommonPrinters(),
      error: err.message 
    };
  }
}

async function getElectronPrinters() {
  try {
    const wins = BrowserWindow.getAllWindows();
    if (!wins.length) {
      console.log('No hay ventanas disponibles para detectar impresoras');
      return [];
    }
    
    for (const win of wins) {
      if (win.isDestroyed() || typeof win.webContents?.getPrinters !== 'function') {
        continue;
      }
      
      const list = win.webContents.getPrinters();
      console.log(`Electron detectó ${list.length} impresoras`);
      
      return list.map(p => ({
        name: p.name,
        description: p.description || '',
        status: p.status,
        isDefault: p.isDefault,
        isThermal: isThermalPrinter(p.name),
        source: 'electron',
        options: p.options || {}
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error obteniendo impresoras de Electron:', error);
    return [];
  }
}

/**
 * Detecta dispositivos USB que podrían ser impresoras térmicas
 */
async function detectUSBPrinters() {
  const usbPrinters = [];
  
  try {
    const platform = process.platform;
    
    if (platform === 'win32') {
      // Windows: usar PowerShell para listar dispositivos USB
      try {
        const { stdout } = await execAsync('powershell -command "Get-PnpDevice -PresentOnly | Where-Object { $_.Class -eq \'Printer\' -or $_.Class -eq \'USB\' -and $_.FriendlyName -match \'print|pos|epson|thermal|receipt|80mm|58mm|ticket\' } | Select-Object FriendlyName, Status | ConvertTo-Json"', {timeout: 5000});
        
        let devices;
        try {
          devices = JSON.parse(stdout);
          // Asegurar que tenemos un array incluso si solo hay un dispositivo
          const deviceList = Array.isArray(devices) ? devices : [devices];
          
          deviceList.forEach(device => {
            if (device && device.FriendlyName) {
              usbPrinters.push({
                name: device.FriendlyName,
                description: `USB Printer (${device.Status || 'Unknown'})`,
                isDefault: false,
                isThermal: isThermalPrinter(device.FriendlyName),
                source: 'usb-windows'
              });
            }
          });
        } catch (parseError) {
          console.warn('Error parsing PowerShell output:', parseError);
          // Intentar procesar línea por línea si falla el JSON
          const lines = stdout.split('\n');
          for (const line of lines) {
            if (line.includes('FriendlyName') && (
                line.toLowerCase().includes('print') || 
                line.toLowerCase().includes('pos') || 
                line.toLowerCase().includes('thermal'))) {
              
              const nameMatch = line.match(/"FriendlyName"\s*:\s*"([^"]+)"/);
              if (nameMatch && nameMatch[1]) {
                usbPrinters.push({
                  name: nameMatch[1],
                  description: 'USB Printer',
                  isDefault: false,
                  isThermal: isThermalPrinter(nameMatch[1]),
                  source: 'usb-windows-fallback'
                });
              }
            }
          }
        }
      } catch (psError) {
        console.warn('Error executing PowerShell:', psError);
        
        // Fallback: buscar en los dispositivos USB con Windows Management Instrumentation
        try {
          const { stdout: wmiStdout } = await execAsync('wmic printer get name', {timeout: 3000});
          const lines = wmiStdout.split('\n').filter(line => line.trim() && line.trim() !== 'Name');
          
          for (const line of lines) {
            const printerName = line.trim();
            if (printerName && isThermalPrinter(printerName)) {
              usbPrinters.push({
                name: printerName,
                description: 'Printer (WMI)',
                isDefault: false,
                isThermal: true,
                source: 'wmi-windows'
              });
            }
          }
        } catch (wmiError) {
          console.warn('Error con WMI:', wmiError);
        }
      }
      
    } else if (platform === 'linux') {
      // Linux: buscar en /dev/usb/ o usar lsusb
      try {
        const { stdout: lsusb } = await execAsync('lsusb', {timeout: 3000});
        const lines = lsusb.split('\n').filter(Boolean);
        
        for (const line of lines) {
          if (line.toLowerCase().includes('print') || 
              line.toLowerCase().includes('epson') || 
              line.toLowerCase().includes('pos') || 
              line.toLowerCase().includes('receipt')) {
                
            const name = line.split(' ').slice(6).join(' ').trim();
            if (name) {
              usbPrinters.push({
                name,
                description: `USB Printer (${line})`,
                isDefault: false,
                isThermal: true,
                source: 'usb-linux'
              });
            }
          }
        }
        
        // También verificar lpstat en Linux
        try {
          const { stdout: lpstatStdout } = await execAsync('lpstat -p', {timeout: 3000});
          const lpLines = lpstatStdout.split('\n').filter(Boolean);
          
          for (const line of lpLines) {
            if (line.startsWith('printer')) {
              const match = line.match(/printer\s+(\S+)/);
              if (match && match[1]) {
                const printerName = match[1];
                // Evitar duplicados
                if (!usbPrinters.some(p => p.name === printerName)) {
                  usbPrinters.push({
                    name: printerName,
                    description: 'CUPS Printer',
                    isDefault: line.includes('is idle'),
                    isThermal: isThermalPrinter(printerName),
                    source: 'cups-linux'
                  });
                }
              }
            }
          }
        } catch (lpstatError) {
          console.warn('Error executing lpstat:', lpstatError);
        }
        
      } catch (lsusbError) {
        console.warn('Error executing lsusb:', lsusbError);
      }
      
    } else if (platform === 'darwin') {
      // macOS: usar system_profiler o lpstat
      try {
        // Intentar con lpstat primero (más confiable para nombres de impresoras)
        const { stdout: lpstatStdout } = await execAsync('lpstat -p', {timeout: 3000});
        const lpLines = lpstatStdout.split('\n').filter(Boolean);
        
        for (const line of lpLines) {
          if (line.startsWith('printer')) {
            const match = line.match(/printer\s+(\S+)/);
            if (match && match[1]) {
              const printerName = match[1];
              usbPrinters.push({
                name: printerName,
                description: 'CUPS Printer',
                isDefault: line.includes('is idle'),
                isThermal: isThermalPrinter(printerName),
                source: 'cups-macos'
              });
            }
          }
        }
        
        // También intentar system_profiler para USB específicamente
        try {
          const { stdout } = await execAsync('system_profiler SPUSBDataType | grep -A 10 -i "printer"', {timeout: 3000});
          const lines = stdout.split('\n').filter(Boolean);
          
          let currentPrinter = null;
          
          for (const line of lines) {
            if (line.includes(':') && !line.includes('Printer')) {
              const trimmedLine = line.trim();
              const parts = trimmedLine.split(':');
              
              if (parts[0] === 'Product ID' && currentPrinter) {
                // Evitar duplicados
                if (!usbPrinters.some(p => p.name === currentPrinter)) {
                  usbPrinters.push({
                    name: currentPrinter,
                    description: 'USB Printer (macOS)',
                    isDefault: false,
                    isThermal: isThermalPrinter(currentPrinter),
                    source: 'usb-macos'
                  });
                }
                currentPrinter = null;
              } else if (parts[0] === 'Product') {
                currentPrinter = parts[1].trim();
              }
            }
          }
        } catch (sysProfilerError) {
          console.warn('Error with system_profiler:', sysProfilerError);
        }
        
      } catch (lpstatError) {
        console.warn('Error executing lpstat on macOS:', lpstatError);
      }
    }
    
    console.log(`🔌 Detectadas ${usbPrinters.length} impresoras USB`);
    return usbPrinters;
    
  } catch (error) {
    console.error('Error detectando impresoras USB:', error);
    return [];
  }
}

/**
 * Detecta impresoras en puertos serie
 */
async function detectSerialPrinters() {
  const serialPrinters = [];
  
  try {
    // Intentar cargar SerialPort dinámicamente
    let SerialPort;
    
    try {
      const serialPortModule = await import('serialport').catch(() => null);
      SerialPort = serialPortModule?.SerialPort || serialPortModule?.default;
      
      if (!SerialPort) {
        // Intentar con require como fallback
        const require = (await import('module')).createRequire(import.meta.url);
        SerialPort = require('serialport').SerialPort || require('serialport');
      }
      
      if (!SerialPort || !SerialPort.list) {
        console.warn('SerialPort no disponible o no tiene método list()');
        return [];
      }
      
      // Listar puertos
      const ports = await SerialPort.list();
      console.log(`🔌 Detectados ${ports.length} puertos serie`);
      
      // Filtrar posibles impresoras
      for (const port of ports) {
        // Los puertos de impresoras térmicas suelen tener estos identificadores
        const isPossiblePrinter = 
          (port.manufacturer && /epson|bixolon|citizen|star|escpos|thermal|usb|printer/i.test(port.manufacturer)) ||
          (port.vendorId && /04b8|0519|067b|154f|04a7|04a9|0dd4/i.test(port.vendorId)) || // IDs comunes
          (port.pnpId && /usb/i.test(port.pnpId));
        
        if (isPossiblePrinter) {
          const printerName = port.manufacturer 
            ? `${port.manufacturer} (${port.path})` 
            : `Serial Printer (${port.path})`;
          
          serialPrinters.push({
            name: printerName,
            description: `Serial Port: ${port.path}`,
            path: port.path,
            isDefault: false,
            isThermal: true,
            source: 'serial',
            // Guardar detalles para la conexión
            serialInfo: {
              path: port.path,
              vendorId: port.vendorId,
              productId: port.productId,
              serialNumber: port.serialNumber
            }
          });
        }
      }
    } catch (serialPortError) {
      console.warn('Error al cargar SerialPort:', serialPortError);
    }
    
    return serialPrinters;
  } catch (error) {
    console.warn('Error detectando impresoras serie:', error);
    return [];
  }
}

/**
 * Determina si una impresora es térmica basándose en su nombre
 */
function isThermalPrinter(name) {
  if (!name) return false;
  
  const lowerName = name.toLowerCase();
  
  // Lista ampliada de patrones para detectar impresoras térmicas
  const thermalPatterns = [
    'thermal', 'receipt', 'pos', '58mm', '80mm', 'tm-', 'tmt', 'epson',
    'bixolon', 'citizen', 'star', 'rongta', 'xprinter', 'zjiang',
    'gprinter', 'xp-', 'tsp', 'cbt', 'ticket', 'escpos'
  ];
  
  return thermalPatterns.some(pattern => lowerName.includes(pattern));
}

/**
 * Combina y elimina duplicados de impresoras
 */
function mergeAndDeduplicate(printersList) {
  const uniquePrinters = [];
  const seenNames = new Set();
  
  for (const printer of printersList) {
    if (!printer.name) continue;
    
    // Normalizar nombre para comparación
    const normalizedName = printer.name.trim().toLowerCase();
    
    // Evitar duplicados exactos
    if (seenNames.has(normalizedName)) continue;
    
    seenNames.add(normalizedName);
    uniquePrinters.push(printer);
  }
  
  return uniquePrinters;
}

/**
 * Devuelve impresoras comunes como último recurso
 */
async function detectCommonPrinters() {
  console.log('🔍 Usando detección manual de impresoras comunes');
  
  const common = [
    { name: 'EPSON TM-T88V', isDefault: false, isThermal: true, source: 'fallback' },
    { name: 'EPSON TM-T20', isDefault: false, isThermal: true, source: 'fallback' },
    { name: 'Star TSP100', isDefault: false, isThermal: true, source: 'fallback' },
    { name: 'POS-58', isDefault: false, isThermal: true, source: 'fallback' },
    { name: 'POS-80', isDefault: false, isThermal: true, source: 'fallback' },
    { name: 'XP-58', isDefault: false, isThermal: true, source: 'fallback' },
    { name: 'XP-80', isDefault: false, isThermal: true, source: 'fallback' },
    { name: 'Generic / Text Only', isDefault: false, isThermal: false, source: 'fallback' },
    { name: 'Microsoft Print to PDF', isDefault: true, isThermal: false, source: 'fallback' }
  ];
  
  return common;
}

/** 
 * Crea archivo HTML temporal para impresión 
 */
async function createTempHtmlFile(html, dir) {
  await fs.ensureDir(dir);
  const file = path.join(dir, `print-${Date.now()}.html`);
  await fs.writeFile(file, html, 'utf8');
  return file;
}

/**
 * Impresión térmica mejorada con soporte para impresoras USB/Serial
 */
export async function printWithThermalPrinter(options) {
  if (!options?.html) return { success: false, error: 'No HTML provided' };
  
  const tempDir = path.join(os.tmpdir(), 'wilpos-prints');
  let tmp, win;
  
  try {
    // Primero intentar impresión directa si es impresora térmica USB o serie
    if ((options.printerName && isThermalPrinter(options.printerName)) || options.serialInfo) {
      console.log(`Intentando imprimir directamente a impresora térmica: ${options.printerName || options.serialInfo.path}`);
      
      // Intentar importar node-thermal-printer para impresión directa
      let ThermalPrinter, PrinterTypes;
      try {
        const thermPrinter = await import('node-thermal-printer').catch(async () => {
          const require = (await import('module')).createRequire(import.meta.url);
          return require('node-thermal-printer');
        });
        
        ThermalPrinter = thermPrinter.printer || thermPrinter.default?.printer;
        PrinterTypes  = thermPrinter.types   || thermPrinter.default?.types;
        
        if (ThermalPrinter && PrinterTypes) {
          // Detectar tipo de impresora (EPSON o STAR)
          let printerType = PrinterTypes.EPSON;
          if ((options.printerName || '').toLowerCase().includes('star')) {
            printerType = PrinterTypes.STAR;
          }
          
          // Interfaz: puerto serie si existe, sino nombre USB
          const iface = options.serialInfo?.path
            ? options.serialInfo.path
            : `printer:${options.printerName}`;
          
          // Siempre proveer un driver: serialport para serie, printer para USB
          const driverConfig = options.serialInfo
            ? {
                module: 'serialport',
                options: {
                  path: options.serialInfo.path,
                  baudRate: options.serialInfo.baudRate || 9600
                }
              }
            : {
                module: 'printer',
                options: {
                  // nombre de la impresora y formato RAW para printDirect()
                  printer: options.printerName,
                  type: 'RAW'
                }
              };
          
          const printer = new ThermalPrinter({
            type: printerType,
            interface: iface,
            options: { timeout: 5000, width: options.options?.width === '58mm' ? 32 : 48 },
            driver: driverConfig
          });
          
          // Convertir HTML a texto plano y enviar
          const plainText = simplifyHtmlToText(options.html);

          if (typeof printer.raw === 'function') {
            // send raw ESC/POS data
            printer.raw(plainText);
          }
          else if (typeof printer.println === 'function') {
            // fallback: print line by line
            plainText.split('\n').forEach(line => printer.println(line));
          }
          else {
            console.warn('⚠️ ThermalPrinter instance has no raw() or println(), skipping direct send');
          }

          const success = await printer.execute();
          
          if (success) {
            console.log('✅ Impresión directa ESC/POS exitosa');
            return { success:true, message:'Printed directly via ESC/POS' };
          }
          
          console.log('⚠️ Impresión directa falló, intentando estándar');
        }
      } catch (directPrintError) {
        console.warn('Error en impresión directa, fallback a estándar:', directPrintError);
      }
    }
    
    // Fallback: impresión estándar con BrowserWindow
    tmp = await createTempHtmlFile(options.html, tempDir);
    win = new BrowserWindow({ show:false, webPreferences:{ contextIsolation:true, sandbox:false } });
    await win.loadFile(tmp);
    await new Promise(r=>win.webContents.on('did-finish-load',r));
    
    const opts = {
      silent: options.silent!==false,
      printBackground:true,
      deviceName:options.printerName,
      copies:options.copies||1,
      margins:{ marginType:'none' },
      pageSize: options.options?.width==='58mm'
        ? { width:58000, height:210000 }
        : { width:80000, height:210000 }
    };
    
    const ok = await win.webContents.print(opts);
    return { success:ok, message: ok ? 'Thermal print sent' : 'Print failed or canceled' };
    
  } catch(e) {
    console.error('Error en impresión térmica:', e);
    return { success:false, error:e.message };
  } finally {
    if (win && !win.isDestroyed()) win.close();
    if (tmp) await fs.unlink(tmp).catch(()=>{});
  }
}

/**
 * Simplifica HTML a texto plano para impresión ESC/POS
 */
function simplifyHtmlToText(html) {
  // Extraer solo el contenido del body y eliminar tags HTML
  const bodyContent = html.match(/<body.*?>([\s\S]*)<\/body>/i);
  let text = bodyContent ? bodyContent[1] : html;
  
  // Reemplazar tags comunes con saltos de línea
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<p.*?>/gi, '').replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<div.*?>/gi, '').replace(/<\/div>/gi, '\n');
  text = text.replace(/<h\d.*?>/gi, '').replace(/<\/h\d>/gi, '\n\n');
  text = text.replace(/<li.*?>/gi, '- ').replace(/<\/li>/gi, '\n');
  text = text.replace(/<tr.*?>/gi, '').replace(/<\/tr>/gi, '\n');
  text = text.replace(/<td.*?>/gi, '  ').replace(/<\/td>/gi, ' ');
  
  // Eliminar todos los demás tags HTML
  text = text.replace(/<[^>]*>/g, '');
  
  // Decodificar entidades HTML
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Normalizar espacios y saltos de línea
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');
  
  // Añadir comandos ESC/POS para centrar texto
  const escposCentered = '\x1Ba\x01'; // ESC a 1 - center align
  const escposLeft = '\x1Ba\x00';     // ESC a 0 - left align
  const escposInit = '\x1B@';         // ESC @ - initialize printer
  const escposEmphasizedOn = '\x1BE\x01'; // ESC E 1 - bold on
  const escposEmphasizedOff = '\x1BE\x00'; // ESC E 0 - bold off
  const escposFeedCut = '\x1Bd\x01';  // ESC d 1 - feed and cut
  
  // Añadir comandos ESC/POS
  let escposText = escposInit;
  
  // Detectar las líneas del encabezado y centrarlas
  const lines = text.split('\n');
  let inHeader = true;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Si estamos en el encabezado y encontramos una línea vacía, termina el encabezado
    if (inHeader && line === '') {
      inHeader = false;
      escposText += escposLeft;
    }
    
    // Si es título o valor, destacarlo
    if (line.includes('TOTAL:') || line.includes('FACTURA') || line.includes('DETALLES')) {
      escposText += escposEmphasizedOn + line + escposEmphasizedOff + '\n';
    } else {
      escposText += line + '\n';
    }
    
    // Centrar el encabezado
    if (inHeader && i === 0) {
      escposText = escposInit + escposCentered + escposText;
    }
  }
  
  // Añadir corte al final
  escposText += '\n' + escposFeedCut;
  
  return escposText;
}

/**
 * Impresión estándar con Electron
 */
export async function printWithElectron(options) {
  if (!options?.html) return { success: false, error: 'No HTML provided' };
  
  const tempDir = path.join(os.tmpdir(), 'wilpos-prints');
  let tmp, win;
  
  try {
    tmp = await createTempHtmlFile(options.html, tempDir);
    win = new BrowserWindow({ 
      show: false, 
      webPreferences: { 
        contextIsolation: true,
        sandbox: false
      } 
    });
    
    await win.loadFile(tmp);
    await new Promise(r => win.webContents.on('did-finish-load', r));
    
    const opts = {
      silent: options.silent !== false,
      printBackground: true,
      deviceName: options.printerName,
      copies: options.copies || 1,
      pageSize: options.options?.pageSize || 'A4'
    };
    
    const ok = await win.webContents.print(opts);
    return { success: ok, message: ok ? 'Printed' : 'Print failed or canceled' };
  } catch (e) {
    console.error('Error en impresión Electron:', e);
    return { success: false, error: e.message };
  } finally {
    if (win && !win.isDestroyed()) win.close();
    if (tmp) await fs.unlink(tmp).catch(() => { });
  }
}

/**
 * Guardar como PDF
 */
export async function savePdf(options) {
  if (!options?.html || !options?.path) throw new Error('HTML and path required');
  
  const pdfDir = path.dirname(options.path);
  await fs.ensureDir(pdfDir);
  
  const tempDir = path.join(os.tmpdir(), 'wilpos-pdf');
  const tmp = await createTempHtmlFile(options.html, tempDir);
  
  let win;
  try {
    win = new BrowserWindow({ 
      show: false, 
      webPreferences: { 
        contextIsolation: true,
        sandbox: false
      } 
    });
    
    await win.loadFile(tmp);
    
    const pdfData = await win.webContents.printToPDF({
      printBackground: options.options?.printBackground !== false,
      margins: options.options?.margins || { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
      pageSize: options.options?.pageSize || 'A4'
    });
    
    await fs.writeFile(options.path, pdfData);
    return { success: true, path: options.path };
  } finally {
    if (win && !win.isDestroyed()) win.close();
    await fs.unlink(tmp).catch(() => { });
  }
}

export default {
  getPrinters,
  printWithThermalPrinter,
  printWithElectron,
  savePdf
};