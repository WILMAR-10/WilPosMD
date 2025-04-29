// src/printing/usb-printer-detector.js
import { app, BrowserWindow } from 'electron';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Detecta impresoras utilizando múltiples métodos
 * 1. Electron webContents.getPrinters()
 * 2. Detección de dispositivos USB
 * 3. Puertos serie virtuales
 * 4. Impresoras comunes como fallback
 */
export async function getAllPrinters() {
  console.log('🔍 Iniciando detección de impresoras mejorada...');
  
  try {
    // 1. Intentar obtener impresoras a través de Electron
    const electronPrinters = await getElectronPrinters();
    
    // 2. Detectar dispositivos USB que podrían ser impresoras
    const usbPrinters = await detectUSBPrinters();
    
    // 3. Detectar puertos serie que podrían ser impresoras
    const serialPrinters = await detectSerialPrinters();
    
    // Combinar todos los resultados, eliminando duplicados
    const allPrinters = mergeAndDeduplicate([
      ...electronPrinters,
      ...usbPrinters,
      ...serialPrinters
    ]);
    
    console.log(`✅ Detección completada, encontradas ${allPrinters.length} impresoras`);
    
    return {
      success: true,
      printers: allPrinters
    };
  } catch (error) {
    console.error('❌ Error en detección de impresoras:', error);
    
    // Fallback a lista estándar de impresoras
    return {
      success: true,
      printers: detectCommonPrinters(),
      error: error.message
    };
  }
}

/**
 * Obtiene impresoras usando Electron webContents
 */
async function getElectronPrinters() {
  try {
    const wins = BrowserWindow.getAllWindows();
    if (!wins.length) {
      console.log('⚠️ No hay ventanas abiertas para usar webContents.getPrinters()');
      return [];
    }
    
    for (const win of wins) {
      if (win.isDestroyed() || typeof win.webContents?.getPrinters !== 'function') {
        continue;
      }
      
      const printers = win.webContents.getPrinters();
      console.log(`📋 Electron detectó ${printers.length} impresoras`);
      
      return printers.map(p => ({
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
    console.error('❌ Error obteniendo impresoras de Electron:', error);
    return [];
  }
}

/**
 * Detecta dispositivos USB que podrían ser impresoras térmicas
 */
async function detectUSBPrinters() {
  // Lista para almacenar impresoras detectadas
  const usbPrinters = [];
  
  try {
    // Detectar impresoras USB según el sistema operativo
    const platform = process.platform;
    
    if (platform === 'win32') {
      // Windows: usar PowerShell para listar dispositivos USB
      const { stdout } = await execAsync('powershell -command "Get-PnpDevice -PresentOnly | Where-Object { $_.Class -eq \'Printer\' -or $_.Class -eq \'USB\' -and $_.FriendlyName -match \'print|pos|epson|thermal|receipt|80mm|58mm|ticket\' } | Select-Object FriendlyName, Status | ConvertTo-Json"');
      
      try {
        const devices = JSON.parse(stdout);
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
        console.error('Error parsing PowerShell output:', parseError);
      }
      
    } else if (platform === 'linux') {
      // Linux: buscar en /dev/usb/
      try {
        const { stdout: lsusb } = await execAsync('lsusb');
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
      } catch (lsusbError) {
        console.error('Error executing lsusb:', lsusbError);
      }
      
    } else if (platform === 'darwin') {
      // macOS: usar system_profiler
      try {
        const { stdout } = await execAsync('system_profiler SPUSBDataType | grep -A 10 -i "printer"');
        const lines = stdout.split('\n').filter(Boolean);
        
        let currentPrinter = null;
        
        for (const line of lines) {
          if (line.includes(':') && !line.includes('Printer')) {
            const trimmedLine = line.trim();
            const parts = trimmedLine.split(':');
            
            if (parts[0] === 'Product ID' && currentPrinter) {
              usbPrinters.push({
                name: currentPrinter,
                description: 'USB Printer (macOS)',
                isDefault: false,
                isThermal: isThermalPrinter(currentPrinter),
                source: 'usb-macos'
              });
              currentPrinter = null;
            } else if (parts[0] === 'Product') {
              currentPrinter = parts[1].trim();
            }
          }
        }
      } catch (macError) {
        console.error('Error detecting macOS USB printers:', macError);
      }
    }
    
    console.log(`🔌 Detectadas ${usbPrinters.length} impresoras USB`);
    return usbPrinters;
    
  } catch (error) {
    console.error('❌ Error detectando impresoras USB:', error);
    return [];
  }
}

/**
 * Detecta puertos serie que podrían ser impresoras térmicas
 */
async function detectSerialPrinters() {
  const serialPrinters = [];
  
  try {
    // Intentar importar SerialPort de manera dinámica
    const { SerialPort } = await import('serialport');
    
    // Listar puertos serie disponibles
    const ports = await SerialPort.list();
    console.log(`🔌 Detectados ${ports.length} puertos serie`);
    
    // Filtrar los puertos que podrían ser impresoras
    for (const port of ports) {
      // Los puertos serie de impresoras térmicas suelen tener estos identificadores
      const isPossiblePrinter = 
        (port.manufacturer && /epson|bixolon|citizen|star|escpos|thermal|usb|printer/i.test(port.manufacturer)) ||
        (port.vendorId && /04b8|0519|067b|154f|04a7|04a9|0dd4/i.test(port.vendorId)) || // IDs comunes de impresoras térmicas
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
          serialInfo: {
            vendorId: port.vendorId,
            productId: port.productId,
            serialNumber: port.serialNumber
          }
        });
      }
    }
    
    console.log(`🖨️ Detectadas ${serialPrinters.length} posibles impresoras en puertos serie`);
    return serialPrinters;
  } catch (error) {
    console.error('❌ Error detectando impresoras en puertos serie:', error);
    // Error al cargar SerialPort o listar puertos
    return [];
  }
}

/**
 * Devuelve una lista de impresoras comunes como último recurso
 */
function detectCommonPrinters() {
  console.log('🔄 Usando detección manual de impresoras comunes');
  
  const common = [
    { name: 'EPSON TM-T88V', isDefault: false, isThermal: true, source: 'fallback' },
    { name: 'EPSON TM-T20', isDefault: false, isThermal: true, source: 'fallback' },
    { name: 'Star TSP100', isDefault: false, isThermal: true, source: 'fallback' },
    { name: 'Star TSP654', isDefault: false, isThermal: true, source: 'fallback' },
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
 * Determina si una impresora es térmica basándose en su nombre
 */
function isThermalPrinter(name) {
  if (!name) return false;
  
  const lowerName = name.toLowerCase();
  
  // Lista ampliada de patrones para detectar impresoras térmicas
  const thermalPatterns = [
    'thermal',
    'receipt',
    'pos',
    '58mm',
    '80mm',
    'tm-',
    'tmt',
    'epson',
    'bixolon',
    'citizen',
    'star',
    'rongta',
    'xprinter',
    'zjiang',
    'gprinter',
    'xp-',
    'tsp',
    'cbt',
    'ticket',
    'escpos'
  ];
  
  return thermalPatterns.some(pattern => lowerName.includes(pattern));
}

/**
 * Combina y elimina duplicados de la lista de impresoras
 */
function mergeAndDeduplicate(printersList) {
  const uniquePrinters = [];
  const seenNames = new Set();
  
  for (const printer of printersList) {
    if (!printer.name) continue;
    
    // Normalizar el nombre para comparación
    const normalizedName = printer.name.trim().toLowerCase();
    
    // Evitar duplicados exactos
    if (seenNames.has(normalizedName)) continue;
    
    seenNames.add(normalizedName);
    uniquePrinters.push(printer);
  }
  
  return uniquePrinters;
}

// Función auxiliar para escribir HTML en un archivo temporal
export async function createTempHtmlFile(html) {
  const tempDir = path.join(os.tmpdir(), 'wilpos-prints');
  await fs.ensureDir(tempDir);
  const file = path.join(tempDir, `print-${Date.now()}.html`);
  await fs.writeFile(file, html, 'utf8');
  return file;
}

// Función auxiliar para obtener la lista de puertos USB
export async function listUSBDevices() {
  try {
    // Intentar cargar la biblioteca 'usb'
    const usb = await import('usb');
    
    // Obtener todos los dispositivos USB
    const devices = usb.default.getDeviceList();
    
    return devices.map(device => {
      try {
        return {
          vendorId: device.deviceDescriptor.idVendor.toString(16),
          productId: device.deviceDescriptor.idProduct.toString(16),
          manufacturer: device.deviceDescriptor.iManufacturer,
          product: device.deviceDescriptor.iProduct,
          serialNumber: device.deviceDescriptor.iSerialNumber
        };
      } catch (err) {
        return {
          vendorId: device.deviceDescriptor.idVendor.toString(16),
          productId: device.deviceDescriptor.idProduct.toString(16),
          error: err.message
        };
      }
    });
  } catch (error) {
    console.error('❌ Error cargando biblioteca USB:', error);
    return [];
  }
}

export default {
  getAllPrinters,
  createTempHtmlFile,
  listUSBDevices
};