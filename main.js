// main.js - Sistema de impresión unificado y optimizado
import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import path, { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { createRequire } from 'module';

// Import logging and error handling services
import logger from './src/services/LoggingService.js';
import errorHandler from './src/services/ErrorHandler.js';

// Database imports
import {
  initializeDatabase,
  setupIpcHandlers,
  closeDB
} from './src/database/index.js';

// ESC/POS printer support
const requireModule = createRequire(import.meta.url);
let escPrinter = null;
let EscPOS = null;
let ModernThermalPrinter = null;

try {
  EscPOS = requireModule('escpos');
  escPrinter = EscPOS;
  console.log('✅ ESC/POS printer support loaded successfully');
} catch (err) {
  console.warn('⚠️ ESC/POS printer support not available:', err.message);
}

// React Native Thermal Printer Service - Adaptado de EPToolkit
// BufferHelper class - Adapted from React Native project
class BufferHelper {
  constructor() {
    this.buffers = [];
    this.size = 0;
  }

  get length() {
    return this.size;
  }

  concat(buffer) {
    this.buffers.push(buffer);
    this.size += buffer.length;
    return this;
  }

  empty() {
    this.buffers = [];
    this.size = 0;
    return this;
  }

  toBuffer() {
    return Buffer.concat(this.buffers, this.size);
  }

  toString(encoding) {
    return this.toBuffer().toString(encoding);
  }
}

// ESC/POS Command Definitions - Adapted from EPToolkit.ts
const ESC_POS_COMMANDS = {
  init_printer: Buffer.from([27, 64]), // Initialize printer
  left_align: Buffer.from([27, 97, 0]), // Left align
  center_align: Buffer.from([27, 97, 1]), // Center align
  right_align: Buffer.from([27, 97, 2]), // Right align
  default_space: Buffer.from([27, 50]), // Default line spacing
  reset: Buffer.from([27, 97, 0, 29, 33, 0, 27, 50]), // Reset formatting
  
  // Text formatting
  bold_start: Buffer.from([27, 33, 48, 28, 33, 12]), // Bold on
  bold_end: Buffer.from([27, 33, 0, 28, 33, 0]), // Bold off
  medium_start: Buffer.from([27, 33, 16, 28, 33, 8]), // Medium size on
  medium_end: Buffer.from([27, 33, 0, 28, 33, 0]), // Medium size off
  double_start: Buffer.from([27, 33, 32, 28, 33, 4]), // Double size on
  double_end: Buffer.from([27, 33, 0, 28, 33, 0]), // Double size off
  
  // Center + formatting combinations
  center_bold_start: Buffer.from([27, 97, 1, 27, 33, 48, 28, 33, 12]),
  center_bold_end: Buffer.from([27, 33, 0, 28, 33, 0]),
  center_medium_start: Buffer.from([27, 97, 1, 27, 33, 16, 28, 33, 8]),
  center_medium_end: Buffer.from([27, 33, 0, 28, 33, 0]),
  center_double_start: Buffer.from([27, 97, 1, 27, 33, 32, 28, 33, 4]),
  center_double_end: Buffer.from([27, 33, 0, 28, 33, 0]),
  
  // Control commands
  cut: Buffer.from([27, 105]), // Paper cut
  beep: Buffer.from([27, 66, 3, 2]), // Beep sound
  trailing_lines: Buffer.from([10, 10, 10, 10, 10]), // Trailing blank lines
  
  // Advanced barcode commands for 64K/256K memory printer
  barcode_height: Buffer.from([29, 104, 80]), // GS h 80 (height 80 dots)
  barcode_width: Buffer.from([29, 119, 2]), // GS w 2 (width module 2)
  barcode_position: Buffer.from([29, 72, 2]), // GS H 2 (print below barcode)
  barcode_font: Buffer.from([29, 102, 0]), // GS f 0 (font A)
  
  // 1D Barcode types supported by your printer
  barcode_upca: Buffer.from([29, 107, 65]), // GS k 65 - UPC-A
  barcode_upce: Buffer.from([29, 107, 66]), // GS k 66 - UPC-E  
  barcode_ean13: Buffer.from([29, 107, 67]), // GS k 67 - EAN13/JAN13
  barcode_ean8: Buffer.from([29, 107, 68]), // GS k 68 - EAN8/JAN8
  barcode_code39: Buffer.from([29, 107, 69]), // GS k 69 - CODE39
  barcode_itf: Buffer.from([29, 107, 70]), // GS k 70 - ITF
  barcode_codabar: Buffer.from([29, 107, 71]), // GS k 71 - CODABAR
  barcode_code93: Buffer.from([29, 107, 72]), // GS k 72 - CODE93
  barcode_code128: Buffer.from([29, 107, 73]), // GS k 73 - CODE128
  
  // QR Code commands (256K flash memory supports this)
  qr_init: Buffer.from([29, 40, 107, 4, 0, 49, 65, 50, 0]), // GS ( k - QR Model 2
  qr_size: Buffer.from([29, 40, 107, 3, 0, 49, 67, 6]), // GS ( k - QR Size 6
  qr_error_l: Buffer.from([29, 40, 107, 3, 0, 49, 69, 48]), // GS ( k - Error correction L
  qr_store_begin: Buffer.from([29, 40, 107, 3, 0, 49, 80, 48]), // GS ( k - Store QR data
  qr_print: Buffer.from([29, 40, 107, 3, 0, 49, 81, 48]), // GS ( k - Print QR
  
  // PDF417 commands supported by your printer
  pdf417_init: Buffer.from([29, 40, 107, 4, 0, 48, 65, 1, 0]), // GS ( k - PDF417 type
  pdf417_columns: Buffer.from([29, 40, 107, 3, 0, 48, 65, 5]), // GS ( k - 5 columns
  pdf417_width: Buffer.from([29, 40, 107, 3, 0, 48, 67, 3]), // GS ( k - Width 3
  pdf417_height: Buffer.from([29, 40, 107, 3, 0, 48, 68, 3]), // GS ( k - Height 3
  pdf417_store: Buffer.from([29, 40, 107, 3, 0, 48, 80, 48]), // GS ( k - Store PDF417
  pdf417_print: Buffer.from([29, 40, 107, 3, 0, 48, 81, 48]), // GS ( k - Print PDF417
  
  // Data Matrix commands supported by your printer
  datamatrix_init: Buffer.from([29, 40, 107, 4, 0, 50, 65, 1, 0]), // GS ( k - DataMatrix
  datamatrix_size: Buffer.from([29, 40, 107, 3, 0, 50, 67, 6]), // GS ( k - Size 6
  datamatrix_store: Buffer.from([29, 40, 107, 3, 0, 50, 80, 48]), // GS ( k - Store data
  datamatrix_print: Buffer.from([29, 40, 107, 3, 0, 50, 81, 48]), // GS ( k - Print DataMatrix
  
  // Memory optimization for 64K buffer
  clear_buffer: Buffer.from([12]), // FF - Form feed (clear print buffer)
  status_request: Buffer.from([16, 4, 1]), // DLE EOT 1 (printer status)
  memory_clear: Buffer.from([27, 64, 12]), // Initialize + clear buffer
};

// Command controller mapping - Adapted from EPToolkit
const COMMAND_CONTROLLER = {
  '<M>': ESC_POS_COMMANDS.medium_start,
  '</M>': ESC_POS_COMMANDS.medium_end,
  '<B>': ESC_POS_COMMANDS.bold_start,
  '</B>': ESC_POS_COMMANDS.bold_end,
  '<D>': ESC_POS_COMMANDS.double_start,
  '</D>': ESC_POS_COMMANDS.double_end,
  '<C>': ESC_POS_COMMANDS.center_align,
  '</C>': ESC_POS_COMMANDS.left_align,
  '<CM>': ESC_POS_COMMANDS.center_medium_start,
  '</CM>': ESC_POS_COMMANDS.center_medium_end,
  '<CD>': ESC_POS_COMMANDS.center_double_start,
  '</CD>': ESC_POS_COMMANDS.center_double_end,
  '<CB>': ESC_POS_COMMANDS.center_bold_start,
  '</CB>': ESC_POS_COMMANDS.center_bold_end,
  '<L>': ESC_POS_COMMANDS.left_align,
  '</L>': Buffer.from([]),
  '<R>': ESC_POS_COMMANDS.right_align,
  '</R>': Buffer.from([]),
};

// Column alignment enum
const ColumnAlignment = {
  LEFT: 0,
  CENTER: 1,
  RIGHT: 2
};

// React Native Thermal Printer Service
class ReactNativeThermalPrinterService {
  constructor() {
    this.isReady = false;
  }

  async initialize(printerName = '80mm Series Printer') {
    try {
      console.log('🔧 Inicializando servicio de impresora térmica React Native...');
      this.printerName = printerName;
      this.isReady = true;
      console.log('✅ Servicio de impresora térmica React Native inicializado correctamente');
      return { success: true, message: 'Servicio React Native inicializado' };
    } catch (error) {
      console.error('❌ Error inicializando servicio React Native:', error);
      this.isReady = false;
      return { success: false, error: error.message };
    }
  }

  // Exchange text function - Enhanced with barcode and QR support
  exchangeText(text, options = {}) {
    const defaultOptions = {
      beep: false,
      cut: true,
      tailingLine: true,
      encoding: 'utf8'
    };

    const finalOptions = { ...defaultOptions, ...options };
    let bytes = new BufferHelper();
    
    // Initialize printer and clear buffer for 64K memory optimization
    bytes.concat(ESC_POS_COMMANDS.memory_clear);
    bytes.concat(ESC_POS_COMMANDS.init_printer);
    bytes.concat(ESC_POS_COMMANDS.default_space);
    
    // Pre-process text to handle barcode and QR markers
    let processedText = this.processBarcodeMarkers(text);
    
    let temp = '';
    
    for (let i = 0; i < processedText.length; i++) {
      let ch = processedText[i];
      
      switch (ch) {
        case '<':
          // Process accumulated text
          if (temp) {
            bytes.concat(Buffer.from(temp, finalOptions.encoding));
            temp = '';
          }
          
          // Look for command tags
          for (const tag in COMMAND_CONTROLLER) {
            if (processedText.substring(i, i + tag.length) === tag) {
              bytes.concat(COMMAND_CONTROLLER[tag]);
              i += tag.length - 1;
              break;
            }
          }
          break;
          
        case '[':
          // Process special barcode/QR markers
          if (temp) {
            bytes.concat(Buffer.from(temp, finalOptions.encoding));
            temp = '';
          }
          
          const markerEnd = processedText.indexOf(']', i);
          if (markerEnd !== -1) {
            const marker = processedText.substring(i + 1, markerEnd);
            const binaryData = this.processSpecialMarker(marker);
            if (binaryData) {
              bytes.concat(binaryData);
            }
            i = markerEnd;
          } else {
            temp += ch;
          }
          break;
          
        case '\n':
          temp = `${temp}${ch}`;
          bytes.concat(Buffer.from(temp, finalOptions.encoding));
          bytes.concat(ESC_POS_COMMANDS.reset);
          temp = '';
          break;
          
        default:
          temp = `${temp}${ch}`;
          break;
      }
    }
    
    // Process remaining text
    if (temp.length > 0) {
      bytes.concat(Buffer.from(temp, finalOptions.encoding));
    }

    // Add trailing lines
    if (finalOptions.tailingLine) {
      bytes.concat(ESC_POS_COMMANDS.trailing_lines);
    }

    // Cut paper
    if (finalOptions.cut) {
      bytes.concat(ESC_POS_COMMANDS.cut);
    }

    // Beep
    if (finalOptions.beep) {
      bytes.concat(ESC_POS_COMMANDS.beep);
    }

    // Clear buffer after printing (memory optimization)
    bytes.concat(ESC_POS_COMMANDS.clear_buffer);

    return bytes.toBuffer();
  }

  // Process barcode and QR markers in text
  processBarcodeMarkers(text) {
    // Store barcode and QR data for later processing
    this.pendingBarcodes = [];
    this.pendingQRCodes = [];
    
    return text; // Text remains unchanged, markers are processed during rendering
  }

  // Process special markers for barcodes and QR codes
  processSpecialMarker(marker) {
    try {
      if (marker.startsWith('BARCODE:')) {
        const parts = marker.split(':');
        if (parts.length >= 3) {
          const data = parts[1];
          const type = parts[2];
          console.log(`🔧 Procesando marcador de código de barras: ${type} - ${data}`);
          return this.generateBarcode(data, type);
        }
      } else if (marker.startsWith('QRCODE:')) {
        const qrData = marker.substring(7); // Remove 'QRCODE:'
        console.log(`🔧 Procesando marcador QR Code: ${qrData.length} caracteres`);
        return this.generateQRCode(qrData, 'M'); // Error correction M for fiscal data
      } else if (marker.startsWith('PDF417:')) {
        const pdfData = marker.substring(7); // Remove 'PDF417:'
        console.log(`🔧 Procesando marcador PDF417: ${pdfData.length} caracteres`);
        return this.generatePDF417(pdfData);
      } else if (marker.startsWith('DATAMATRIX:')) {
        const dmData = marker.substring(11); // Remove 'DATAMATRIX:'
        console.log(`🔧 Procesando marcador Data Matrix: ${dmData.length} caracteres`);
        return this.generateDataMatrix(dmData);
      }
    } catch (error) {
      console.error(`❌ Error procesando marcador especial: ${marker}`, error);
    }
    
    return null;
  }

  // Process column text - From print-column.ts
  processAlignText(text, restLength, align) {
    if (align === ColumnAlignment.LEFT) {
      return text + ' '.repeat(restLength);
    } else if (align === ColumnAlignment.CENTER) {
      return ' '.repeat(Math.floor(restLength / 2)) + text + ' '.repeat(Math.ceil(restLength / 2));
    } else if (align === ColumnAlignment.RIGHT) {
      return ' '.repeat(restLength) + text;
    }
    return '';
  }

  processNewLine(text, maxLength) {
    let newText;
    let newTextTail;
    const nextChar = text.slice(maxLength, maxLength + 1);

    if (nextChar === ' ') {
      newText = text.slice(0, maxLength);
      newTextTail = text.slice(maxLength, text.length);
    } else {
      const newMaxLength = text
        .slice(0, maxLength)
        .split('')
        .lastIndexOf(' ');
      
      if (newMaxLength === -1) {
        newText = text.slice(0, maxLength);
        newTextTail = text.slice(maxLength, text.length);
      } else {
        newText = text.slice(0, newMaxLength);
        newTextTail = text.slice(newMaxLength, text.length);
      }
    }

    return {
      text: newText || '',
      textTail: (newTextTail || '').trim()
    };
  }

  processColumnText(texts, columnWidth, columnAlignment, columnStyle = []) {
    let restTexts = ['', '', ''];
    let result = '';
    
    texts.forEach((text, idx) => {
      const columnWidthAtRow = Math.round(columnWidth[idx]);
      
      if (text.length >= columnWidth[idx]) {
        const processedText = this.processNewLine(text, columnWidthAtRow);
        result += 
          (columnStyle[idx] || '') +
          this.processAlignText(
            processedText.text,
            columnWidthAtRow - processedText.text.length,
            columnAlignment[idx]
          ) +
          (idx !== 2 ? ' ' : '');
        restTexts[idx] = processedText.textTail;
      } else {
        result +=
          (columnStyle[idx] || '') +
          this.processAlignText(
            text.trim(),
            columnWidthAtRow - text.length,
            columnAlignment[idx]
          ) +
          (idx !== 2 ? ' ' : '');
      }
    });

    const indexNonEmpty = restTexts.findIndex((restText) => restText !== '');
    if (indexNonEmpty !== -1) {
      result += '\n' + this.processColumnText(restTexts, columnWidth, columnAlignment, columnStyle);
    }

    return result;
  }

  // Generar código de barras nativo
  generateBarcode(data, type = 'CODE128') {
    let bytes = new BufferHelper();
    
    console.log(`📊 Generando código de barras ${type}: ${data}`);
    
    // Configurar parámetros del código de barras
    bytes.concat(ESC_POS_COMMANDS.barcode_height); // Altura 80 dots
    bytes.concat(ESC_POS_COMMANDS.barcode_width);  // Ancho módulo 2
    bytes.concat(ESC_POS_COMMANDS.barcode_position); // Texto debajo
    bytes.concat(ESC_POS_COMMANDS.barcode_font);   // Fuente A
    
    // Seleccionar tipo de código de barras
    let barcodeCommand;
    switch (type.toUpperCase()) {
      case 'UPC-A':
        barcodeCommand = ESC_POS_COMMANDS.barcode_upca;
        break;
      case 'UPC-E':
        barcodeCommand = ESC_POS_COMMANDS.barcode_upce;
        break;
      case 'EAN13':
      case 'JAN13':
        barcodeCommand = ESC_POS_COMMANDS.barcode_ean13;
        break;
      case 'EAN8':
      case 'JAN8':
        barcodeCommand = ESC_POS_COMMANDS.barcode_ean8;
        break;
      case 'CODE39':
        barcodeCommand = ESC_POS_COMMANDS.barcode_code39;
        break;
      case 'ITF':
        barcodeCommand = ESC_POS_COMMANDS.barcode_itf;
        break;
      case 'CODABAR':
        barcodeCommand = ESC_POS_COMMANDS.barcode_codabar;
        break;
      case 'CODE93':
        barcodeCommand = ESC_POS_COMMANDS.barcode_code93;
        break;
      case 'CODE128':
      default:
        barcodeCommand = ESC_POS_COMMANDS.barcode_code128;
        break;
    }
    
    // Generar código de barras
    bytes.concat(barcodeCommand);
    bytes.concat(Buffer.from([data.length])); // Longitud de datos
    bytes.concat(Buffer.from(data, 'ascii')); // Datos del código
    bytes.concat(Buffer.from([10])); // Nueva línea después del código
    
    console.log(`✅ Código de barras ${type} generado: ${bytes.toBuffer().length} bytes`);
    return bytes.toBuffer();
  }

  // Generar QR Code nativo (usando memoria de 256K)
  generateQRCode(data, errorLevel = 'L') {
    let bytes = new BufferHelper();
    
    console.log(`🔲 Generando QR Code: ${data.substring(0, 50)}${data.length > 50 ? '...' : ''}`);
    
    // Inicializar QR Code
    bytes.concat(ESC_POS_COMMANDS.qr_init);     // Modelo 2
    bytes.concat(ESC_POS_COMMANDS.qr_size);     // Tamaño 6
    
    // Nivel de corrección de errores
    if (errorLevel === 'M') {
      bytes.concat(Buffer.from([29, 40, 107, 3, 0, 49, 69, 49])); // Error M
    } else if (errorLevel === 'Q') {
      bytes.concat(Buffer.from([29, 40, 107, 3, 0, 49, 69, 50])); // Error Q
    } else if (errorLevel === 'H') {
      bytes.concat(Buffer.from([29, 40, 107, 3, 0, 49, 69, 51])); // Error H
    } else {
      bytes.concat(ESC_POS_COMMANDS.qr_error_l); // Error L (default)
    }
    
    // Almacenar datos del QR
    const dataBytes = Buffer.from(data, 'utf8');
    const lengthBytes = Buffer.from([
      (dataBytes.length + 3) & 0xFF,
      ((dataBytes.length + 3) >> 8) & 0xFF
    ]);
    
    bytes.concat(Buffer.from([29, 40, 107])); // GS ( k
    bytes.concat(lengthBytes); // Longitud
    bytes.concat(Buffer.from([49, 80, 48])); // Función almacenar
    bytes.concat(dataBytes); // Datos QR
    
    // Imprimir QR Code
    bytes.concat(ESC_POS_COMMANDS.qr_print);
    bytes.concat(Buffer.from([10])); // Nueva línea
    
    console.log(`✅ QR Code generado: ${bytes.toBuffer().length} bytes`);
    return bytes.toBuffer();
  }

  // Generar PDF417 nativo
  generatePDF417(data, columns = 5) {
    let bytes = new BufferHelper();
    
    console.log(`📄 Generando PDF417: ${data.substring(0, 30)}${data.length > 30 ? '...' : ''}`);
    
    // Inicializar PDF417
    bytes.concat(ESC_POS_COMMANDS.pdf417_init);
    
    // Configurar columnas (3-30)
    const columnCommand = Buffer.from([29, 40, 107, 3, 0, 48, 65, Math.max(3, Math.min(30, columns))]);
    bytes.concat(columnCommand);
    
    // Configurar dimensiones
    bytes.concat(ESC_POS_COMMANDS.pdf417_width);
    bytes.concat(ESC_POS_COMMANDS.pdf417_height);
    
    // Almacenar datos
    const dataBytes = Buffer.from(data, 'utf8');
    const lengthBytes = Buffer.from([
      (dataBytes.length + 3) & 0xFF,
      ((dataBytes.length + 3) >> 8) & 0xFF
    ]);
    
    bytes.concat(Buffer.from([29, 40, 107])); // GS ( k
    bytes.concat(lengthBytes); // Longitud
    bytes.concat(Buffer.from([48, 80, 48])); // Función almacenar
    bytes.concat(dataBytes); // Datos PDF417
    
    // Imprimir PDF417
    bytes.concat(ESC_POS_COMMANDS.pdf417_print);
    bytes.concat(Buffer.from([10])); // Nueva línea
    
    console.log(`✅ PDF417 generado: ${bytes.toBuffer().length} bytes`);
    return bytes.toBuffer();
  }

  // Generar Data Matrix nativo
  generateDataMatrix(data) {
    let bytes = new BufferHelper();
    
    console.log(`⬛ Generando Data Matrix: ${data.substring(0, 30)}${data.length > 30 ? '...' : ''}`);
    
    // Inicializar Data Matrix
    bytes.concat(ESC_POS_COMMANDS.datamatrix_init);
    bytes.concat(ESC_POS_COMMANDS.datamatrix_size);
    
    // Almacenar datos
    const dataBytes = Buffer.from(data, 'utf8');
    const lengthBytes = Buffer.from([
      (dataBytes.length + 3) & 0xFF,
      ((dataBytes.length + 3) >> 8) & 0xFF
    ]);
    
    bytes.concat(Buffer.from([29, 40, 107])); // GS ( k
    bytes.concat(lengthBytes); // Longitud
    bytes.concat(Buffer.from([50, 80, 48])); // Función almacenar
    bytes.concat(dataBytes); // Datos Data Matrix
    
    // Imprimir Data Matrix
    bytes.concat(ESC_POS_COMMANDS.datamatrix_print);
    bytes.concat(Buffer.from([10])); // Nueva línea
    
    console.log(`✅ Data Matrix generado: ${bytes.toBuffer().length} bytes`);
    return bytes.toBuffer();
  }

  async printInvoice(saleData) {
    if (!this.isReady) {
      return { success: false, error: 'Servicio no inicializado' };
    }

    try {
      console.log('🖨️ Generando factura optimizada para papel térmico 80mm...');

      // FACTURA OPTIMIZADA PARA 100% USO DEL PAPEL TÉRMICO (48 caracteres ancho)
      let invoiceText = '';

      // === HEADER OPTIMIZADO ===
      const businessName = (saleData.businessName || 'WILPOS').toUpperCase();
      invoiceText += '<C><CB>' + businessName + '</CB></C>\n';
      
      if (saleData.businessInfo) {
        const info = saleData.businessInfo.substring(0, 46);
        invoiceText += '<C>' + info + '</C>\n';
      }
      
      const rncText = 'RNC: ' + (saleData.businessRNC || '123-45678-9');
      invoiceText += '<C>' + rncText + '</C>\n';
      
      // Línea separadora completa
      invoiceText += '================================================\n';

      // === INFO DE VENTA COMPACTA ===
      const facturaNum = 'FACTURA #' + (saleData.id || 'N/A');
      invoiceText += '<B>' + facturaNum + '</B>\n';
      
      const fecha = new Date(saleData.fecha_venta || Date.now());
      const fechaStr = fecha.toLocaleDateString('es-DO') + ' ' + fecha.toLocaleTimeString('es-DO', {hour: '2-digit', minute:'2-digit'});
      invoiceText += 'Fecha: ' + fechaStr + '\n';
      
      const cliente = (saleData.cliente || 'Cliente General').substring(0, 40);
      invoiceText += 'Cliente: ' + cliente + '\n';
      
      if (saleData.usuario) {
        const cajero = saleData.usuario.substring(0, 38);
        invoiceText += 'Cajero: ' + cajero + '\n';
      }
      
      invoiceText += '================================================\n';

      // === PRODUCTOS CON MÁXIMO APROVECHAMIENTO ===
      if (saleData.detalles && Array.isArray(saleData.detalles)) {
        // Agrupar por categorías pero más compacto
        const categoriesMap = {};
        saleData.detalles.forEach(item => {
          const category = (item.categoria || 'GENERAL').substring(0, 15);
          if (!categoriesMap[category]) {
            categoriesMap[category] = [];
          }
          categoriesMap[category].push(item);
        });

        Object.keys(categoriesMap).forEach((category, catIndex) => {
          // Solo mostrar categoría si hay más de una
          if (Object.keys(categoriesMap).length > 1) {
            invoiceText += '<B>>>> ' + category.toUpperCase() + ' <<<<</B>\n';
          }
          
          categoriesMap[category].forEach((item, itemIndex) => {
            const nombre = (item.producto_nombre || item.nombre || 'Producto');
            const cantidad = item.cantidad || 1;
            const precioUnitario = parseFloat(item.precio_unitario || 0);
            const subtotal = cantidad * precioUnitario;
            
            // LÍNEA DE PRODUCTO OPTIMIZADA (48 chars max)
            // Nombre del producto (máximo 46 chars para dejar espacio)
            const nombreCorto = nombre.length > 46 ? nombre.substring(0, 43) + '...' : nombre;
            invoiceText += nombreCorto + '\n';
            
            // Línea de cantidad, precio unitario y total - FORMATO COMPACTO
            const qtyText = cantidad + 'x';
            const priceText = 'RD$' + precioUnitario.toFixed(2);
            const subtotalText = 'RD$' + subtotal.toFixed(2);
            
            // Usar todo el ancho (48 chars) con espaciado inteligente
            const line2 = this.processColumnText(
              [qtyText, priceText, subtotalText],
              [6, 18, 18], // Total: 42 chars + 2 espacios = 44 chars
              [ColumnAlignment.LEFT, ColumnAlignment.CENTER, ColumnAlignment.RIGHT]
            );
            invoiceText += line2 + '\n';
            
            // Código de barras nativo si existe
            if (item.codigo_barra && item.codigo_barra.length > 0) {
              console.log(`📊 Agregando código de barras para: ${item.producto_nombre || item.nombre}`);
              
              // Determinar tipo de código automáticamente
              let barcodeType = 'CODE128'; // Default
              const code = item.codigo_barra.trim();
              
              if (code.length === 12 && /^\d+$/.test(code)) {
                barcodeType = 'UPC-A';
              } else if (code.length === 13 && /^\d+$/.test(code)) {
                barcodeType = 'EAN13';
              } else if (code.length === 8 && /^\d+$/.test(code)) {
                barcodeType = 'EAN8';
              }
              
              // Generar código de barras nativo y agregarlo al buffer principal
              const barcodeBuffer = this.generateBarcode(code, barcodeType);
              
              // Marcador especial para insertar código de barras binario
              invoiceText += `[BARCODE:${code}:${barcodeType}]\n`;
            }
            
            // Descuento si aplica
            if (item.descuento && parseFloat(item.descuento) > 0) {
              const descText = '  DESC: -RD$' + parseFloat(item.descuento).toFixed(2);
              invoiceText += descText + '\n';
            }
            
            // Separador sutil entre productos
            if (itemIndex < categoriesMap[category].length - 1) {
              invoiceText += '- - - - - - - - - - - - - - - - - - - - - - - -\n';
            }
          });
          
          // Separador entre categorías
          if (catIndex < Object.keys(categoriesMap).length - 1) {
            invoiceText += '\n';
          }
        });
      }

      invoiceText += '================================================\n';

      // === TOTALES OPTIMIZADOS ===
      const subtotalVenta = parseFloat(saleData.subtotal || 0);
      const impuestos = parseFloat(saleData.impuestos || 0);
      const descuentos = parseFloat(saleData.descuentos || 0);
      const totalVenta = parseFloat(saleData.total || subtotalVenta + impuestos - descuentos);

      // Mostrar solo totales relevantes (no ceros)
      if (subtotalVenta > 0 && (impuestos > 0 || descuentos > 0)) {
        const subtotalLine = this.processColumnText(
          ['SUBTOTAL:', 'RD$' + subtotalVenta.toFixed(2)],
          [25, 18],
          [ColumnAlignment.LEFT, ColumnAlignment.RIGHT]
        );
        invoiceText += subtotalLine + '\n';
      }

      if (descuentos > 0) {
        const descuentoLine = this.processColumnText(
          ['DESCUENTOS:', '-RD$' + descuentos.toFixed(2)],
          [25, 18],
          [ColumnAlignment.LEFT, ColumnAlignment.RIGHT]
        );
        invoiceText += descuentoLine + '\n';
      }

      if (impuestos > 0) {
        const impuestoLine = this.processColumnText(
          ['ITBIS (18%):', 'RD$' + impuestos.toFixed(2)],
          [25, 18],
          [ColumnAlignment.LEFT, ColumnAlignment.RIGHT]
        );
        invoiceText += impuestoLine + '\n';
        invoiceText += '- - - - - - - - - - - - - - - - - - - - - - - -\n';
      }

      // TOTAL DESTACADO CON MÁXIMO IMPACTO VISUAL
      const totalLine = this.processColumnText(
        ['<CB>TOTAL A PAGAR:</CB>', '<CB>RD$' + totalVenta.toFixed(2) + '</CB>'],
        [23, 20],
        [ColumnAlignment.LEFT, ColumnAlignment.RIGHT]
      );
      invoiceText += totalLine + '\n';

      // === INFORMACIÓN DE PAGO COMPACTA ===
      if (saleData.metodoPago) {
        invoiceText += '================================================\n';
        const metodoPago = 'Pago: ' + saleData.metodoPago;
        invoiceText += metodoPago + '\n';
        
        if (saleData.montoPagado) {
          const pagado = parseFloat(saleData.montoPagado);
          const cambio = pagado - totalVenta;
          
          const pagadoLine = this.processColumnText(
            ['Recibido:', 'RD$' + pagado.toFixed(2)],
            [23, 20],
            [ColumnAlignment.LEFT, ColumnAlignment.RIGHT]
          );
          invoiceText += pagadoLine + '\n';
          
          if (cambio > 0) {
            const cambioLine = this.processColumnText(
              ['<B>Su cambio:</B>', '<B>RD$' + cambio.toFixed(2) + '</B>'],
              [23, 20],
              [ColumnAlignment.LEFT, ColumnAlignment.RIGHT]
            );
            invoiceText += cambioLine + '\n';
          }
        }
      }

      // === FOOTER CON MÁXIMO IMPACTO ===
      invoiceText += '================================================\n';
      invoiceText += '<C><B>¡GRACIAS POR SU COMPRA!</B></C>\n';
      invoiceText += '<C>Visite: www.wilpos.com</C>\n';
      invoiceText += '<C>Tel: (809) 555-0123</C>\n';
      invoiceText += '<C><B>Su factura es válida como comprobante fiscal</B></C>\n';
      invoiceText += '<C>*** CONSERVE ESTE COMPROBANTE ***</C>\n';

      // Información adicional si hay espacio
      if (saleData.numeroFactura) {
        invoiceText += '<C>NCF: ' + saleData.numeroFactura + '</C>\n';
      }

      // Timestamp para referencia
      const timestamp = new Date().toISOString().replace(/[:.]/g, '');
      invoiceText += '<C>REF: WP-' + timestamp.substring(2, 14) + '</C>\n';
      
      // === QR CODE CON INFORMACIÓN FISCAL ===
      invoiceText += '\n<C>QR Code - Información Fiscal:</C>\n';
      
      // Crear datos del QR con información completa de la factura
      const qrData = JSON.stringify({
        factura: saleData.id || 'N/A',
        fecha: new Date(saleData.fecha_venta || Date.now()).toISOString().split('T')[0],
        rncEmisor: saleData.businessRNC || '123-45678-9',
        cliente: saleData.cliente || 'Cliente General',
        total: parseFloat(saleData.total || 0).toFixed(2),
        impuestos: parseFloat(saleData.impuestos || 0).toFixed(2),
        ref: 'WP-' + timestamp.substring(2, 14),
        validacion: 'WilPOS-' + Math.random().toString(36).substring(2, 8).toUpperCase()
      });
      
      console.log(`🔲 Generando QR con datos fiscales: ${qrData.length} caracteres`);
      
      // Marcador para QR Code fiscal
      invoiceText += `[QRCODE:${qrData}]\n`;
      
      // Información adicional del QR
      invoiceText += '<C>Escanee para verificar autenticidad</C>\n';

      console.log('📏 Factura generada con formato optimizado para 80mm (48 caracteres)');

      // Convert text to ESC/POS buffer with enhanced settings
      const buffer = this.exchangeText(invoiceText, {
        beep: true,
        cut: true,
        tailingLine: true,
        encoding: 'utf8'
      });

      console.log(`📦 Buffer ESC/POS generado: ${buffer.length} bytes`);

      // Send to printer using enhanced communication
      const result = await this.sendDirectToPrinter(buffer);
      
      if (result.success) {
        console.log('✅ Factura optimizada impresa exitosamente');
        return { success: true, message: 'Factura optimizada para papel térmico enviada correctamente' };
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('❌ Error imprimiendo factura optimizada:', error);
      return { success: false, error: error.message };
    }
  }

  // Métodos auxiliares para detección de puertos
  async detectCOMPort() {
    try {
      const { execSync } = requireModule('child_process');
      
      // Detectar puertos COM disponibles que podrían ser impresoras
      const wmicCommand = 'wmic path Win32_SerialPort get DeviceID,Description,Name /format:csv';
      const output = execSync(wmicCommand, { encoding: 'utf8', timeout: 10000 });
      
      const lines = output.split('\n').filter(line => line.trim() && !line.startsWith('Node'));
      
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 3) {
          const deviceId = parts[1]?.trim();
          const description = parts[2]?.trim();
          const name = parts[3]?.trim();
          
          // Buscar patrones de impresoras térmicas
          const thermalPatterns = ['USB', 'POS', 'RECEIPT', 'THERMAL', 'EPSON', 'STAR', 'CITIZEN'];
          const isThermalPort = thermalPatterns.some(pattern => 
            (description + ' ' + name).toUpperCase().includes(pattern)
          );
          
          if (isThermalPort && deviceId?.startsWith('COM')) {
            console.log(`🔌 Puerto COM térmico encontrado: ${deviceId} - ${description}`);
            return deviceId;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.log('⚠️ Error detectando puerto COM:', error.message);
      return null;
    }
  }

  async getAllUSBPorts() {
    try {
      const { execSync } = requireModule('child_process');
      
      // Obtener todos los puertos USB disponibles
      const wmicCommand = 'wmic printer get Name,PortName /format:csv';
      const output = execSync(wmicCommand, { encoding: 'utf8', timeout: 10000 });
      
      const usbPorts = [];
      const lines = output.split('\n').filter(line => line.trim() && !line.startsWith('Node'));
      
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 3) {
          const portName = parts[2]?.trim();
          
          if (portName?.startsWith('USB') || portName?.startsWith('DOT')) {
            usbPorts.push(portName);
          }
        }
      }
      
      return [...new Set(usbPorts)]; // Eliminar duplicados
    } catch (error) {
      console.log('⚠️ Error obteniendo puertos USB:', error.message);
      return ['USB001', 'USB002', 'USB003']; // Fallback
    }
  }

  async getActualPrinterName() {
    try {
      const { execSync } = requireModule('child_process');
      
      // Buscar impresoras térmicas instaladas
      const wmicCommand = 'wmic printer get Name,PortName,Status /format:csv';
      const output = execSync(wmicCommand, { encoding: 'utf8', timeout: 10000 });
      
      const lines = output.split('\n').filter(line => line.trim() && !line.startsWith('Node'));
      
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 4) {
          const name = parts[1]?.trim();
          const portName = parts[2]?.trim();
          const status = parts[3]?.trim();
          
          console.log(`🔍 Evaluando impresora: "${name}" puerto: "${portName}" status: "${status}"`);
          
          // Buscar impresoras térmicas activas
          const thermalPatterns = ['80mm', '58mm', 'thermal', 'receipt', 'pos', 'series', 'printer'];
          const isThermal = thermalPatterns.some(pattern => 
            name?.toLowerCase().includes(pattern.toLowerCase())
          );
          
          // También buscar por patrones de puerto USB (comunes en impresoras térmicas)
          const hasUSBPort = portName?.toLowerCase().includes('usb');
          
          if ((isThermal || hasUSBPort) && name && name !== 'Microsoft Print to PDF' && name !== 'OneNote') {
            console.log(`🖨️ Impresora térmica detectada: ${name} (${portName}) - Status: ${status}`);
            return name;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.log('⚠️ Error obteniendo nombre de impresora:', error.message);
      return null;
    }
  }

  // Comunicación ESC/POS directa con soporte nativo de Windows
  async sendDirectToPrinter(buffer) {
    console.log('🔧 Iniciando comunicación ESC/POS nativa de Windows...');
    
    // Validar que el buffer comience con ESC (ASCII 27) o GS (ASCII 29)
    if (buffer[0] !== 27 && buffer[0] !== 29) {
      console.log('⚠️ Agregando comando ESC de inicialización al buffer');
      const initBuffer = Buffer.from([27, 64]); // ESC @ - Inicializar impresora
      buffer = Buffer.concat([initBuffer, buffer]);
    }

    // Method 1: Windows Raw Printer API - PRIORITARIO para impresoras térmicas
    try {
      console.log('📡 Método 1: Windows Raw Printer API (PRIORITARIO)...');
      
      const printerName = await this.getActualPrinterName();
      if (printerName) {
        console.log(`🖨️ Impresora térmica detectada: "${printerName}"`);
        
        const { execSync } = requireModule('child_process');
        const hexData = buffer.toString('hex');
        
        // Usar .NET para acceso raw a impresora térmica con ESC/POS
        const netCommand = `powershell -Command "
          Add-Type -TypeDefinition '
          using System;
          using System.IO;
          using System.Runtime.InteropServices;
          
          public class RawPrinter {
            [StructLayout(LayoutKind.Sequential)]
            public struct DOCINFO {
              public string pDocName;
              public string pOutputFile;
              public string pDataType;
            }
            
            [DllImport(\\\"winspool.drv\\\", SetLastError=true)]
            public static extern bool OpenPrinter(string printerName, out IntPtr hPrinter, IntPtr pd);
            
            [DllImport(\\\"winspool.drv\\\", SetLastError=true)]
            public static extern bool ClosePrinter(IntPtr hPrinter);
            
            [DllImport(\\\"winspool.drv\\\", SetLastError=true)]
            public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFO docInfo);
            
            [DllImport(\\\"winspool.drv\\\", SetLastError=true)]
            public static extern bool EndDocPrinter(IntPtr hPrinter);
            
            [DllImport(\\\"winspool.drv\\\", SetLastError=true)]
            public static extern bool StartPagePrinter(IntPtr hPrinter);
            
            [DllImport(\\\"winspool.drv\\\", SetLastError=true)]
            public static extern bool EndPagePrinter(IntPtr hPrinter);
            
            [DllImport(\\\"winspool.drv\\\", SetLastError=true)]
            public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
            
            public static bool SendBytesToPrinter(string printerName, byte[] pBytes) {
              IntPtr hPrinter = IntPtr.Zero;
              DOCINFO di = new DOCINFO();
              bool success = false;
              
              di.pDocName = \\\"WilPOS ESC/POS Invoice\\\";
              di.pDataType = \\\"RAW\\\";
              
              if (OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
                if (StartDocPrinter(hPrinter, 1, ref di)) {
                  if (StartPagePrinter(hPrinter)) {
                    int dwWritten;
                    success = WritePrinter(hPrinter, pBytes, pBytes.Length, out dwWritten);
                    EndPagePrinter(hPrinter);
                  }
                  EndDocPrinter(hPrinter);
                }
                ClosePrinter(hPrinter);
              }
              return success;
            }
          }'
          
          try {
            $$printerName = '${printerName}'
            $$hexString = '${hexData}'
            $$bytes = [System.Convert]::FromHexString($$hexString)
            
            $$result = [RawPrinter]::SendBytesToPrinter($$printerName, $$bytes)
            
            if ($$result) {
              Write-Host 'SUCCESS: Raw ESC/POS data sent to thermal printer'
            } else {
              throw 'Failed to send raw data to printer'
            }
          } catch {
            Write-Error $$_.Exception.Message
            exit 1
          }
        "`;
        
        execSync(netCommand, { timeout: 30000 });
        
        console.log('✅ Método 1 exitoso: ESC/POS via Windows Raw Printer API');
        return { success: true, message: `ESC/POS enviado via Raw API a "${printerName}"` };
      } else {
        console.log('⚠️ No se encontró impresora térmica específica');
      }
    } catch (rawError) {
      console.log(`⚠️ Método 1 falló: ${rawError.message}`);
    }

    // Method 2: Comunicación directa via puerto COM (fallback)
    try {
      console.log('📡 Método 2: Comunicación ESC/POS via COM...');
      
      const comPort = await this.detectCOMPort();
      if (comPort) {
        const tempFile = path.join(process.cwd(), 'escpos_data.bin');
        await fs.writeFile(tempFile, buffer);
        
        const { execSync } = requireModule('child_process');
        
        // Configurar puerto COM para impresora térmica
        const modeCommand = `mode ${comPort} baud=9600 parity=N data=8 stop=1 xon=off odsr=off octs=off dtr=off rts=off idsr=off`;
        const copyCommand = `copy /B "${tempFile}" ${comPort}`;
        
        execSync(modeCommand, { timeout: 5000 });
        execSync(copyCommand, { timeout: 15000 });
        
        await fs.unlink(tempFile).catch(() => {});
        
        console.log(`✅ Método 2 exitoso: ESC/POS via ${comPort}`);
        return { success: true, message: `Impresión ESC/POS enviada via ${comPort}` };
      }
    } catch (comError) {
      console.log(`⚠️ Método 2 falló: ${comError.message}`);
    }

    // Method 3: Windows Print Job con ESC/POS (UWP compatible)
    try {
      console.log('📡 Método 3: Windows Print Job ESC/POS...');
      
      const printerName = await this.getActualPrinterName();
      if (printerName) {
        const tempFile = path.join(process.cwd(), 'escpos_print.prn');
        await fs.writeFile(tempFile, buffer);
        
        const { execSync } = requireModule('child_process');
        
        // Usar PowerShell con Out-Printer para envío directo
        const psCommand = `powershell -Command "
          try {
            $printerName = '${printerName}'
            $bytes = Get-Content '${tempFile}' -Raw -Encoding Byte
            $printer = Get-Printer -Name $printerName -ErrorAction Stop
            
            # Crear trabajo de impresión con datos ESC/POS
            $bytes | Out-Printer -Name $printerName
            Write-Host 'SUCCESS: ESC/POS enviado a $printerName'
          } catch {
            Write-Error $_.Exception.Message
            exit 1
          }
        "`;
        
        execSync(psCommand, { timeout: 20000, stdio: 'pipe' });
        
        await fs.unlink(tempFile).catch(() => {});
        
        console.log(`✅ Método 3 exitoso: Print Job a ${printerName}`);
        return { success: true, message: `ESC/POS enviado via Print Job a ${printerName}` };
      }
    } catch (printError) {
      console.log(`⚠️ Método 3 falló: ${printError.message}`);
    }

    // Method 4: Acceso directo a puerto USB con ESC/POS - ÚLTIMO RECURSO
    try {
      console.log('📡 Método 4: ESC/POS directo a USB (ÚLTIMO RECURSO)...');
      
      const usbPorts = await this.getAllUSBPorts();
      
      for (const usbPort of usbPorts) {
        try {
          const tempFile = path.join(process.cwd(), 'escpos_usb.bin');
          await fs.writeFile(tempFile, buffer);
          
          const { execSync } = requireModule('child_process');
          const copyCommand = `copy /B "${tempFile}" "${usbPort}"`;
          
          console.log(`🔄 Intentando escribir a ${usbPort}...`);
          const output = execSync(copyCommand, { encoding: 'utf8', timeout: 10000 });
          
          // Verificar que el comando copy realmente copió datos
          if (output.includes('1 file(s) copied') || output.trim() === '') {
            console.log(`⚠️ WARNING: ${usbPort} reporta éxito pero puede ser puerto virtual`);
            console.log(`📄 Output del comando: "${output.trim()}"`);
            
            // NO retornar éxito inmediatamente para puertos virtuales, continuar
            console.log(`🔄 Continuando con siguiente método - ${usbPort} puede ser virtual`);
            await fs.unlink(tempFile).catch(() => {});
            continue;
          }
          
          await fs.unlink(tempFile).catch(() => {});
          
          console.log(`✅ Método 4 exitoso: ESC/POS a ${usbPort}`);
          return { success: true, message: `ESC/POS enviado a puerto ${usbPort}` };
          
        } catch (usbError) {
          console.log(`⚠️ Puerto ${usbPort} falló: ${usbError.message}`);
          continue;
        }
      }
    } catch (usbError) {
      console.log(`⚠️ Método 3 falló: ${usbError.message}`);
    }

    // Method 4: Windows Raw Printer API
    try {
      console.log('📡 Método 4: Windows Raw Printer API...');
      
      const printerName = await this.getActualPrinterName();
      if (printerName) {
        const { execSync } = requireModule('child_process');
        const hexData = buffer.toString('hex');
        
        // Usar .NET para acceso raw a impresora
        const netCommand = `powershell -Command "
          Add-Type -AssemblyName System.Drawing
          Add-Type -AssemblyName System.Windows.Forms
          
          try {
            $printerName = '${printerName}'
            $hexString = '${hexData}'
            $bytes = [System.Convert]::FromHexString($hexString)
            
            # Crear documento de impresión raw
            $doc = New-Object System.Drawing.Printing.PrintDocument
            $doc.PrinterSettings.PrinterName = $printerName
            
            $doc.add_PrintPage({
              param($sender, $e)
              $stream = New-Object System.IO.MemoryStream($bytes)
              $e.Graphics.DrawString([System.Text.Encoding]::Default.GetString($bytes), 
                (New-Object System.Drawing.Font('Courier New', 8)), 
                [System.Drawing.Brushes]::Black, 0, 0)
            })
            
            $doc.Print()
            Write-Host 'SUCCESS: Raw print enviado'
          } catch {
            Write-Error $_.Exception.Message
            exit 1
          }
        "`;
        
        execSync(netCommand, { timeout: 25000 });
        
        console.log('✅ Método 4 exitoso: Windows Raw API');
        return { success: true, message: 'ESC/POS enviado via Raw Printer API' };
      }
    } catch (rawError) {
      console.log(`⚠️ Método 4 falló: ${rawError.message}`);
    }

    // Method 5: Puerto paralelo LPT (legacy pero efectivo)
    try {
      console.log('📡 Método 5: Puerto paralelo LPT...');
      
      const tempFile = path.join(process.cwd(), 'escpos_lpt.bin');
      await fs.writeFile(tempFile, buffer);
      
      const { execSync } = requireModule('child_process');
      
      for (const lptPort of ['LPT1:', 'LPT2:', 'LPT3:']) {
        try {
          const lptCommand = `copy /B "${tempFile}" ${lptPort}`;
          execSync(lptCommand, { timeout: 15000 });
          
          await fs.unlink(tempFile).catch(() => {});
          
          console.log(`✅ Método 5 exitoso: ESC/POS a ${lptPort}`);
          return { success: true, message: `ESC/POS enviado a ${lptPort}` };
        } catch (lptError) {
          console.log(`⚠️ ${lptPort} falló: ${lptError.message}`);
          continue;
        }
      }
      
      await fs.unlink(tempFile).catch(() => {});
      
    } catch (lptError) {
      console.log(`⚠️ Método 5 falló: ${lptError.message}`);
    }

    console.error('❌ CRÍTICO: No se pudo establecer comunicación ESC/POS');
    console.log('💡 DIAGNÓSTICO REQUERIDO:');
    console.log('   1. ¿Está la impresora encendida y con papel?');
    console.log('   2. ¿Está en modo "Line Mode" o "ESC/POS Mode"?');
    console.log('   3. ¿Tiene los drivers correctos instalados?');
    console.log('   4. ¿Es compatible con comandos ESC/POS (Epson, Star, etc.)?');
    console.log('   5. ¿Está configurada como impresora predeterminada?');
    
    return { 
      success: false, 
      error: 'ERROR CRÍTICO: Comunicación ESC/POS falló. Verificar configuración de impresora térmica.' 
    };
  }

  // Detect printer port method
  async detectPrinterPort() {
    try {
      const { execSync } = requireModule('child_process');
      
      // Method 1: WMIC query for thermal printers
      console.log('🔍 Detectando puerto de impresora térmica...');
      
      const wmicCommand = 'wmic printer where "PortName like \'USB%\'" get Name,PortName /format:csv';
      const wmicOutput = execSync(wmicCommand, { encoding: 'utf8', timeout: 10000 });
      
      const lines = wmicOutput.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 3) {
          const printerName = parts[1]?.trim();
          const portName = parts[2]?.trim();
          
          // Check for thermal printer patterns
          const thermalPatterns = [
            '80mm', '58mm', 'thermal', 'receipt', 'pos', 'series',
            'xprinter', 'gprinter', 'epson', 'star', 'bixolon'
          ];
          
          const isThermal = thermalPatterns.some(pattern => 
            printerName?.toLowerCase().includes(pattern.toLowerCase())
          );
          
          if (isThermal && portName?.startsWith('USB')) {
            console.log(`✅ Impresora térmica detectada: ${printerName} en puerto ${portName}`);
            return portName;
          }
        }
      }
      
      // Method 2: Return USB001 as default thermal port
      console.log('⚠️ No se detectó impresora térmica específica, usando puerto USB001');
      return 'USB001';
      
    } catch (error) {
      console.error('❌ Error detectando puerto de impresora:', error);
      return 'USB001'; // Default fallback
    }
  }
}

// Global printer service instance
let thermalPrinterService = null;

// React Native Thermal Printer IPC Handlers
function setupReactNativeThermalPrinterHandlers() {
  // Handler for getting available printers
  ipcMain.handle('printer:get-printers', async () => {
    try {
      console.log('📨 Getting available printers...');
      const { execSync } = requireModule('child_process');
      
      // Get printers using WMIC
      const wmicCommand = 'wmic printer get Name,PortName,Status /format:csv';
      const wmicOutput = execSync(wmicCommand, { encoding: 'utf8', timeout: 10000 });
      
      const printers = [];
      const lines = wmicOutput.split('\n').filter(line => line.trim() && !line.startsWith('Node'));
      
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 3) {
          const name = parts[1]?.trim();
          const portName = parts[2]?.trim();
          const status = parts[3]?.trim();
          
          if (name && name !== 'Name') {
            printers.push({
              name,
              port: portName || 'Unknown',
              status: status || 'Unknown',
              isThermal: /80mm|58mm|thermal|receipt|pos|series|xprinter|gprinter|epson|star|bixolon/i.test(name)
            });
          }
        }
      }
      
      console.log(`✅ Found ${printers.length} printers`);
      return printers;
      
    } catch (error) {
      console.error('❌ Error getting printers:', error);
      return [];
    }
  });

  // Handler for printing invoices with React Native EPToolkit
  ipcMain.handle('printer:print-invoice-rn', async (event, { saleData, printerName }) => {
    try {
      console.log('📨 IPC Handler: printer:print-invoice-rn called');
      
      if (!thermalPrinterService) {
        console.error('❌ React Native thermal printer service not initialized');
        return { success: false, error: 'Servicio de impresión térmica no inicializado' };
      }

      const result = await thermalPrinterService.printInvoice(saleData);
      console.log('📋 React Native print result:', result);
      
      return result;

    } catch (error) {
      console.error('❌ Error in printer:print-invoice-rn handler:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler for testing React Native thermal printer
  ipcMain.handle('printer:test-rn', async () => {
    try {
      console.log('🧪 Testing React Native thermal printer...');
      
      if (!thermalPrinterService) {
        return { success: false, error: 'Servicio no inicializado' };
      }

      const testData = {
        id: 'TEST001',
        businessName: 'WILPOS',
        businessInfo: 'Sistema de Facturacion Electronica',
        businessRNC: '123-45678-9',
        fecha_venta: new Date(),
        cliente: 'Cliente de Prueba',
        usuario: 'Test User',
        detalles: [
          {
            nombre: 'Producto de Prueba',
            cantidad: 2,
            precio_unitario: 150.00,
            categoria: 'PRUEBAS'
          },
          {
            nombre: 'Otro Producto',
            cantidad: 1,
            precio_unitario: 200.00,
            categoria: 'PRUEBAS'
          }
        ],
        subtotal: 500.00,
        impuestos: 90.00,
        descuentos: 0,
        total: 590.00,
        metodoPago: 'Efectivo',
        montoPagado: 600.00
      };

      const result = await thermalPrinterService.printInvoice(testData);
      return result;

    } catch (error) {
      console.error('❌ Error testing React Native printer:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler for regular invoice printing (compatibility)
  ipcMain.handle('printer:print-invoice', async (event, { saleData, printerName }) => {
    try {
      console.log('📨 IPC Handler: printer:print-invoice (fallback to RN) called');
      
      // Try React Native printer first
      if (thermalPrinterService) {
        const result = await thermalPrinterService.printInvoice(saleData);
        if (result.success) {
          return result;
        }
      }
      
      // If RN printer fails, return error
      return { 
        success: false, 
        error: 'No hay servicio de impresión disponible' 
      };

    } catch (error) {
      console.error('❌ Error in printer:print-invoice handler:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler for test printing (compatibility)
  ipcMain.handle('printer:test', async (event, printerName) => {
    try {
      console.log('🧪 Testing printer (compatibility)...');
      
      if (!thermalPrinterService) {
        return { success: false, error: 'Servicio no inicializado' };
      }

      const testData = {
        id: 'TEST001',
        businessName: 'WILPOS',
        businessInfo: 'Prueba de Impresora',
        fecha_venta: new Date(),
        cliente: 'Cliente de Prueba',
        detalles: [
          {
            nombre: 'Producto de Prueba',
            cantidad: 1,
            precio_unitario: 100.00,
            categoria: 'PRUEBA'
          }
        ],
        subtotal: 100.00,
        impuestos: 18.00,
        total: 118.00
      };

      const result = await thermalPrinterService.printInvoice(testData);
      return result;

    } catch (error) {
      console.error('❌ Error testing printer:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler for raw printer test - sends simple test directly
  ipcMain.handle('printer:test-raw', async () => {
    try {
      console.log('🧪 Testing raw printer communication...');
      
      if (!thermalPrinterService) {
        return { success: false, error: 'Servicio no inicializado' };
      }

      // Simple test text with ESC/POS commands
      const testText = '<C><B>PRUEBA DIRECTA WILPOS</B></C>\n' +
                      'Impresión Térmica Funcionando\n' +
                      'Fecha: ' + new Date().toLocaleDateString() + '\n' +
                      '--------------------------------\n' +
                      'Si ve este texto, la impresora\n' +
                      'está comunicándose correctamente.\n\n';

      const buffer = thermalPrinterService.exchangeText(testText, {
        beep: true,
        cut: true,
        tailingLine: true
      });

      const result = await thermalPrinterService.sendDirectToPrinter(buffer);
      return result;

    } catch (error) {
      console.error('❌ Error in raw printer test:', error);
      return { success: false, error: error.message };
    }
  });
}

// Constantes
const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const windowCache = new Map();
let mainWindow = null;

// Initialize logging service early
logger.initialize().then(() => {
  logger.info('Main', '🚀 Iniciando WilPOS', {
    appPath: __dirname,
    isDev,
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch
  });
}).catch(console.error);

/**
 * Utilidad para registro seguro de handlers IPC con logging mejorado
 */
function safeHandle(channel, handler) {
  try { 
    ipcMain.removeHandler(channel); 
  } catch {} 
  
  ipcMain.handle(channel, errorHandler.wrapIPC(async (event, ...args) => {
    const startTime = performance.now();
    
    try {
      await logger.debug('IPC', `Handler called: ${channel}`, { 
        args: errorHandler.sanitizeArgs(args) 
      });
      
      const result = await handler(event, ...args);
      
      const duration = performance.now() - startTime;
      if (duration > 1000) { // Log slow operations (>1s)
        await logger.performance('Slow IPC handler', duration, { channel });
      }
      
      return result;
    } catch (error) {
      await logger.error('IPC', `Handler error: ${channel}`, {
        error: error.message,
        stack: error.stack,
        args: errorHandler.sanitizeArgs(args)
      });
      
      return await errorHandler.handleError(error, { channel });
    }
  }, channel));
}

/**
 * Configuración de controles de ventana
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
 * Servicio de impresión UNIFICADO
 */
class UnifiedPrinterService {
  constructor() {
    this.modernPrinter = null; // Instancia del servicio moderno
    this.setupHandlers();
  }

  setupHandlers() {
    // Obtener lista de impresoras
    safeHandle('printer:get-printers', async () => {
      try {
        const { execSync } = requireModule('child_process');
        let printers = [];
        
        if (process.platform === 'win32') {
          console.log('🔍 Obteniendo lista de impresoras...');
          
          const output = execSync('wmic printer get name,default,status', { 
            encoding: 'utf8',
            timeout: 10000
          });
          
          console.log('📋 Salida WMIC:', output);
          
          const lines = output.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.toLowerCase().includes('default') && !line.toLowerCase().includes('name'));
          
          console.log('📝 Líneas filtradas:', lines);
          
          printers = lines.map(line => {
            // El formato es: Default Name Status
            // Ejemplo: FALSE    HP LaserJet M1536dnf MFP (520DB3)  Unknown
            const match = line.match(/^(TRUE|FALSE)\s+(.+?)\s+(Unknown|OK|Error|Offline|Online)?\s*$/);
            
            if (match) {
              const isDefault = match[1] === 'TRUE';
              const name = match[2].trim();
              const status = match[3] || 'Unknown';
              const isThermal = this.detectThermalPrinter(name);
              const paperWidth = this.detectPaperWidth(name);
              
              console.log(`🖨️ Impresora encontrada: ${name} (Térmica: ${isThermal})`);
              
              return {
                name,
                isDefault,
                status: status.toLowerCase(),
                isThermal,
                paperWidth,
                displayName: name,
                id: name.replace(/\s+/g, '_')
              };
            } else {
              // Fallback para líneas que no coinciden con el formato esperado
              const parts = line.split(/\s+/);
              if (parts.length >= 2) {
                const name = parts.slice(1).join(' ').trim();
                const isThermal = this.detectThermalPrinter(name);
                
                console.log(`🖨️ Impresora encontrada (fallback): ${name} (Térmica: ${isThermal})`);
                
                return {
                  name,
                  isDefault: parts[0] === 'TRUE',
                  status: 'unknown',
                  isThermal,
                  paperWidth: this.detectPaperWidth(name),
                  displayName: name,
                  id: name.replace(/\s+/g, '_')
                };
              }
            }
            return null;
          }).filter(p => p && p.name);
        } else {
          // Para otros sistemas operativos (macOS, Linux)
          try {
            const { execSync } = requireModule('child_process');
            
            if (process.platform === 'darwin') {
              // macOS
              const output = execSync('lpstat -p', { encoding: 'utf8' });
              const lines = output.split('\n').filter(line => line.startsWith('printer'));
              
              printers = lines.map(line => {
                const name = line.split(' ')[1];
                const isThermal = this.detectThermalPrinter(name);
                
                return {
                  name,
                  isDefault: false,
                  status: 'available',
                  isThermal,
                  paperWidth: this.detectPaperWidth(name),
                  displayName: name,
                  id: name.replace(/\s+/g, '_')
                };
              });
            } else {
              // Linux
              const output = execSync('lpstat -a', { encoding: 'utf8' });
              const lines = output.split('\n').filter(line => line.includes('accepting'));
              
              printers = lines.map(line => {
                const name = line.split(' ')[0];
                const isThermal = this.detectThermalPrinter(name);
                
                return {
                  name,
                  isDefault: false,
                  status: line.includes('accepting') ? 'available' : 'offline',
                  isThermal,
                  paperWidth: this.detectPaperWidth(name),
                  displayName: name,
                  id: name.replace(/\s+/g, '_')
                };
              });
            }
          } catch (err) {
            console.warn('No se pudieron obtener impresoras del sistema:', err.message);
          }
        }
        
        console.log(`✅ Encontradas ${printers.length} impresoras:`, printers.map(p => `${p.name} (${p.isThermal ? 'Térmica' : 'Normal'})`));
        
        return printers;
      } catch (error) {
        console.error('❌ Error obteniendo impresoras:', error);
        await logger.error('Printer', 'Error getting printers list', {
          error: error.message,
          stack: error.stack,
          platform: process.platform
        });
        return [];
      }
    });

    // Imprimir factura con ESC/POS
    safeHandle('printer:print-invoice', async (event, { saleData, printerName }) => {
      // PROBAR PRIMERO CON IMPRESIÓN MODERNA
      if (ModernThermalPrinter) {
        const modernResult = await this.printInvoiceModern(saleData, printerName);
        if (modernResult.success) {
          return modernResult;
        }
        console.log('⚠️ Impresión moderna falló, usando método tradicional...');
      }
      
      // PROBAR MÉTODO POWERSHELL (más confiable en Windows)
      const powershellResult = await this.printWithPowerShell(saleData, printerName);
      if (powershellResult.success) {
        return powershellResult;
      }
      console.log('⚠️ Método PowerShell falló, usando método ESC/POS...');
      
      // FALLBACK: usar método tradicional ESC/POS
      return await this.printInvoiceESC(saleData, printerName);
    });

    // Imprimir etiqueta
    safeHandle('printer:print-label', async (event, { labelData, printerName }) => {
      return await this.printLabelESC(labelData, printerName);
    });

    // Imprimir código de barras
    safeHandle('printer:print-barcode', async (event, { barcodeData, printerName }) => {
      return await this.printBarcodeESC(barcodeData, printerName);
    });

    // Imprimir código QR
    safeHandle('printer:print-qr', async (event, { qrData, printerName }) => {
      return await this.printQRESC(qrData, printerName);
    });

    // Imprimir datos raw
    safeHandle('printer:print-raw', async (event, { data, printerName }) => {
      return await this.printRaw(data, printerName);
    });

    // Probar impresora
    safeHandle('printer:test-printer', async (event, { printerName }) => {
      // PROBAR PRIMERO CON IMPRESIÓN MODERNA
      if (ModernThermalPrinter) {
        const modernResult = await this.testPrinterModern(printerName);
        if (modernResult.success) {
          return modernResult;
        }
        console.log('⚠️ Prueba moderna falló, usando método tradicional...');
      }
      
      // FALLBACK: usar método tradicional
      return await this.testPrinter(printerName);
    });

    // Abrir cajón
    safeHandle('printer:open-cash-drawer', async (event, { printerName }) => {
      return await this.openCashDrawer(printerName);
    });

    // Guardar PDF
    safeHandle('printer:save-pdf', async (event, options) => {
      return await this.savePDF(options);
    });
  }

  /**
   * Detecta si una impresora es térmica basado en patrones conocidos
   */
  detectThermalPrinter(printerName) {
    if (!printerName) return false;
    
    const thermalKeywords = [
      // Marcas conocidas de impresoras térmicas
      'thermal', 'pos', 'receipt', 'ticket', 
      // Modelos específicos de Epson
      'epson tm', 'tm-t', 'tm-u', 'tm-p', 'tm-m', 'tm-t20', 'tm-t88', 'tm-t82',
      // Star Micronics
      'star tsp', 'tsp100', 'tsp143', 'tsp650', 'tsp700', 'tsp800',
      // Bixolon
      'bixolon', 'srp-350', 'srp-330', 'srp-270', 'srp-275',
      // Citizen
      'citizen ct', 'ct-s310', 'ct-s300', 'ct-s2000', 'ct-s4000',
      // XPrinter
      'xprinter', 'xp-58', 'xp-80', 'xp-q200', 'xp-q800',
      // Otros fabricantes
      'zjiang', 'goojprt', 'munbyn', 'rongta', 'hoin',
      // Anchos de papel comunes
      '58mm', '80mm', '57mm', '76mm',
      // Modelos genéricos
      '80mm series', '58mm series', 'series printer'
    ];
    
    const name = printerName.toLowerCase();
    const isThermal = thermalKeywords.some(keyword => name.includes(keyword.toLowerCase()));
    
    // Excluir impresoras que claramente NO son térmicas
    const excludeKeywords = [
      'pdf', 'fax', 'onenote', 'microsoft', 'xps', 'document writer',
      'laser', 'inkjet', 'deskjet', 'officejet', 'laserjet', 'imageclass',
      'photosmart', 'envy', 'pixma', 'stylus', 'workforce'
    ];
    
    const isExcluded = excludeKeywords.some(exclude => name.includes(exclude.toLowerCase()));
    
    return isThermal && !isExcluded;
  }

  /**
   * Detecta el ancho del papel
   */
  detectPaperWidth(printerName) {
    const name = printerName.toLowerCase();
    if (name.includes('58mm') || name.includes('58')) return 58;
    if (name.includes('80mm') || name.includes('80')) return 80;
    return this.detectThermalPrinter(printerName) ? 80 : null;
  }

  /**
   * Imprime factura usando el servicio moderno
   */
  async printInvoiceModern(saleData, printerName) {
    try {
      console.log('🚀 INICIANDO IMPRESIÓN MODERNA');
      
      // Inicializar impresora moderna si no existe
      if (!this.modernPrinter && ModernThermalPrinter) {
        this.modernPrinter = new ModernThermalPrinter();
        const initResult = await this.modernPrinter.initialize(printerName);
        
        if (!initResult.success) {
          console.log('❌ No se pudo inicializar impresora moderna:', initResult.error);
          return initResult;
        }
      }

      if (!this.modernPrinter) {
        return { success: false, error: 'Servicio moderno de impresión no disponible' };
      }

      // Imprimir factura con el servicio moderno
      const result = await this.modernPrinter.printInvoice(saleData);
      
      if (result.success) {
        console.log('✅ ÉXITO: Impresión moderna completada');
      } else {
        console.log('❌ FALLO: Impresión moderna falló -', result.error);
      }

      return result;

    } catch (error) {
      console.error('💥 ERROR CRÍTICO en impresión moderna:', error);
      return { success: false, error: `Error crítico: ${error.message}` };
    }
  }

  /**
   * Prueba impresora usando el servicio moderno
   */
  async testPrinterModern(printerName) {
    try {
      console.log('🧪 INICIANDO PRUEBA MODERNA');
      
      // Inicializar impresora moderna si no existe
      if (!this.modernPrinter && ModernThermalPrinter) {
        this.modernPrinter = new ModernThermalPrinter();
        const initResult = await this.modernPrinter.initialize(printerName);
        
        if (!initResult.success) {
          console.log('❌ No se pudo inicializar impresora moderna para prueba:', initResult.error);
          return initResult;
        }
      }

      if (!this.modernPrinter) {
        return { success: false, error: 'Servicio moderno de impresión no disponible' };
      }

      // Realizar prueba con el servicio moderno
      const result = await this.modernPrinter.testPrint();
      
      if (result.success) {
        console.log('✅ ÉXITO: Prueba moderna completada');
      } else {
        console.log('❌ FALLO: Prueba moderna falló -', result.error);
      }

      return result;

    } catch (error) {
      console.error('💥 ERROR CRÍTICO en prueba moderna:', error);
      return { success: false, error: `Error crítico: ${error.message}` };
    }
  }

  /**
   * Imprime factura usando ESC/POS
   */
  async printInvoiceESC(saleData, printerName) {
    if (!EscPOS) {
      return { success: false, error: 'Módulo de impresión no disponible' };
    }

    try {
      const escCommands = this.generateInvoiceESC(saleData);
      return await this.printRaw(escCommands, printerName);
    } catch (error) {
      console.error('Error printing invoice:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Imprime etiqueta usando ESC/POS
   */
  async printLabelESC(labelData, printerName) {
    if (!EscPOS) {
      return { success: false, error: 'Módulo de impresión no disponible' };
    }

    try {
      const escCommands = this.generateLabelESC(labelData);
      return await this.printRaw(escCommands, printerName);
    } catch (error) {
      console.error('Error printing label:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Imprime código de barras usando ESC/POS
   */
  async printBarcodeESC(barcodeData, printerName) {
    if (!EscPOS) {
      return { success: false, error: 'Módulo de impresión no disponible' };
    }

    try {
      const escCommands = this.generateBarcodeESC(barcodeData);
      return await this.printRaw(escCommands, printerName);
    } catch (error) {
      console.error('Error printing barcode:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Imprime código QR usando ESC/POS
   */
  async printQRESC(qrData, printerName) {
    if (!EscPOS) {
      return { success: false, error: 'Módulo de impresión no disponible' };
    }

    try {
      const escCommands = this.generateQRESC(qrData);
      return await this.printRaw(escCommands, printerName);
    } catch (error) {
      console.error('Error printing QR:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envía comandos RAW directamente a la impresora térmica - VERSIÓN SEGURA
   */
  async printRaw(commands, printerName) {
    // PROTECCIÓN CRÍTICA CONTRA CRASHES
    const safeExecute = async (operation, methodName) => {
      try {
        console.log(`🔄 Intentando ${methodName}...`);
        const result = await Promise.race([
          operation(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 12000)
          )
        ]);
        
        if (result && result.success) {
          console.log(`✅ ${methodName} exitoso`);
          return result;
        } else {
          console.log(`❌ ${methodName} falló:`, result?.error || 'Sin respuesta');
          return null;
        }
      } catch (error) {
        console.log(`💥 ${methodName} error crítico:`, error.message);
        return null;
      }
    };

    try {
      await logger.printer('🖨️ INICIO IMPRESIÓN SEGURA', { printerName, commandsLength: commands?.length });
      
      // Validar entrada
      if (!commands || !printerName) {
        throw new Error('Comandos o impresora no especificados');
      }

      // Preparar buffer con verificación
      let buffer;
      try {
        buffer = typeof commands === 'string' 
          ? Buffer.from(commands, 'binary') 
          : Buffer.isBuffer(commands) ? commands : Buffer.from(String(commands), 'binary');
        
        console.log(`📦 Buffer preparado: ${buffer.length} bytes`);
      } catch (bufferError) {
        throw new Error(`Error preparando buffer: ${bufferError.message}`);
      }

      // MÉTODO 1: Comunicación directa mejorada
      const directResult = await safeExecute(
        () => this.printDirectToDevice(buffer, printerName),
        'Comunicación directa'
      );
      if (directResult) {
        await logger.printer('✅ ÉXITO Método directo');
        return directResult;
      }

      // MÉTODO 2: Puerto de dispositivo con seguridad
      const deviceResult = await safeExecute(
        () => this.printToDevicePort(buffer, printerName),
        'Puerto de dispositivo'
      );
      if (deviceResult) {
        await logger.printer('✅ ÉXITO Método puerto');
        return deviceResult;
      }

      // MÉTODO 3: PowerShell protegido
      const psResult = await safeExecute(
        () => this.printViaPowerShell(buffer, printerName),
        'PowerShell'
      );
      if (psResult) {
        await logger.printer('✅ ÉXITO Método PowerShell');
        return psResult;
      }

      // MÉTODO 4: Red con timeout
      const networkResult = await safeExecute(
        () => this.printToNetworkPrinter(buffer, printerName),
        'Red'
      );
      if (networkResult) {
        await logger.printer('✅ ÉXITO Método red');
        return networkResult;
      }
      
      // TODOS LOS MÉTODOS FALLARON - FINALIZACIÓN SEGURA
      console.log('❌ TODOS LOS MÉTODOS DE IMPRESIÓN FALLARON');
      await logger.printer('❌ ALL METHODS FAILED - No thermal printer communication');
      
      return { 
        success: false, 
        error: 'No se pudo establecer comunicación con la impresora térmica',
        methods_tried: ['direct', 'device_port', 'powershell', 'network'],
        suggestion: 'Verificar que la impresora esté conectada y encendida'
      };

    } catch (error) {
      // MANEJO DE ERRORES CRÍTICOS - EVITAR CRASHES DE LA APLICACIÓN
      console.error('💥 ERROR CRÍTICO EN IMPRESIÓN:', error.message);
      await logger.printer('Critical print error', {
        printerName,
        error: error.message,
        stack: error.stack
      });
      
      return { 
        success: false, 
        error: `Error crítico: ${error.message}`,
        fatal: false // Indicar que la aplicación puede continuar
      };
    }
  }

  /**
   * MÉTODO SIMPLE DE PRUEBA TÉRMICA (para debug)
   */
  async testThermalConnection(printerName) {
    try {
      console.log('🔥 PRUEBA TÉRMICA SIMPLE');
      
      // Solo comandos básicos de inicialización
      const basicTest = Buffer.from([
        0x1B, 0x40,       // ESC @ - Reset
        0x48, 0x6F, 0x6C, 0x61, 0x21, 0x0A, // "Hola!" + newline
        0x0A, 0x0A,       // Saltos de línea
        0x1D, 0x56, 0x00  // Corte parcial
      ]);
      
      return await this.printDirectToDevice(basicTest, printerName);
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Prueba la impresora con múltiples métodos de diagnóstico
   */
  async testPrinter(printerName) {
    try {
      console.log('🧪 INICIANDO PRUEBAS DE DIAGNÓSTICO');
      
      // PRUEBA SIMPLE: Solo comandos básicos
      const simpleTest = await this.testThermalConnection(printerName);
      console.log('📊 Resultado prueba simple:', simpleTest.success ? 'EXITOSO' : 'FALLIDO');
      
      return {
        success: simpleTest.success,
        message: 'Prueba de diagnóstico completada',
        results: {
          thermalConnection: simpleTest.success
        }
      };
      
    } catch (error) {
      console.error('Error en pruebas de diagnóstico:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Prueba directa del puerto con diferentes métodos
   */

  /**
   * Prueba directa del puerto con diferentes métodos
   */
  async testDirectPort(printerName) {
    try {
      const { execSync } = requireModule('child_process');
      const fs = requireModule('fs');
      const os = requireModule('os');
      const path = requireModule('path');

      console.log('🔧 PRUEBA DIRECTA DEL PUERTO');
      
      // Obtener puerto
      const portResult = await this.detectPrinterPort(printerName);
      if (!portResult.success) {
        return { success: false, error: 'No se detectó puerto' };
      }

      const port = portResult.port;
      console.log(`🎯 Probando puerto: ${port}`);

      // Crear mensaje de prueba simple
      const testMessage = 'PRUEBA DIRECTA WILPOS\n\n\n';
      const tempFile = path.join(os.tmpdir(), `wilpos_test_${Date.now()}.txt`);
      fs.writeFileSync(tempFile, testMessage);

      const methods = [
        { name: 'ECHO directo', cmd: `echo PRUEBA DIRECTA > ${port}` },
        { name: 'TYPE archivo', cmd: `type "${tempFile}" > ${port}` },
        { name: 'COPY normal', cmd: `copy "${tempFile}" ${port}` },
        { name: 'COPY binario', cmd: `copy /B "${tempFile}" ${port}` }
      ];

      let anySuccess = false;

      for (const method of methods) {
        try {
          console.log(`🧪 ${method.name}: ${method.cmd}`);
          execSync(method.cmd, { timeout: 3000 });
          console.log(`✅ ${method.name} ejecutado exitosamente`);
          anySuccess = true;
          
          // Esperar un poco para que la impresora procese
          await new Promise(resolve => setTimeout(resolve, 1500));
          
        } catch (error) {
          console.log(`❌ ${method.name} falló: ${error.message}`);
        }
      }

      // Limpiar
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {}

      return { 
        success: anySuccess, 
        message: anySuccess ? 'Al menos un método funcionó' : 'Todos los métodos fallaron' 
      };

    } catch (error) {
      console.error('Error en prueba directa:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Método PowerShell para impresión directa en Windows
   */
  async printWithPowerShell(saleData, printerName) {
    try {
      console.log('🔧 INICIANDO IMPRESIÓN POWERSHELL');
      
      const { execSync } = requireModule('child_process');
      
      // Generar contenido de la factura
      const facturaTexto = this.generateInvoiceText(saleData);
      
      // Crear archivo temporal
      const os = requireModule('os');
      const path = requireModule('path');
      const fs = requireModule('fs');
      
      const tempFile = path.join(os.tmpdir(), `wilpos_powershell_${Date.now()}.txt`);
      fs.writeFileSync(tempFile, facturaTexto, 'utf8');
      
      // Método simple: usar notepad para imprimir
      console.log('🔧 Intentando imprimir con notepad...');
      const result = execSync(`notepad /p "${tempFile}"`, {
        encoding: 'utf8',
        timeout: 15000,
        windowsHide: true
      });
      
      console.log('📋 PowerShell result:', result);
      
      // Limpiar archivo temporal
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {}
      
      // Notepad /p no devuelve output, pero si no hay error es éxito
      console.log('✅ ÉXITO: Comando notepad ejecutado sin errores');
      return { success: true, message: 'Impreso con Notepad' };
      
    } catch (error) {
      console.error('❌ Error en impresión PowerShell:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generar texto simple para la factura
   */
  generateInvoiceText(saleData) {
    let texto = '';
    texto += '        WILPOS\n';
    texto += '=======================\n';
    texto += `FACTURA No: ${saleData.id || 'N/A'}\n`;
    
    const fecha = new Date(saleData.fecha_venta || Date.now()).toLocaleString('es-DO');
    texto += `Fecha: ${fecha}\n`;
    texto += `Cliente: ${saleData.cliente || 'Cliente General'}\n`;
    
    if (saleData.usuario) {
      texto += `Cajero: ${saleData.usuario}\n`;
    }
    
    texto += '=======================\n';
    texto += 'PRODUCTOS:\n';
    
    if (saleData.detalles && Array.isArray(saleData.detalles)) {
      saleData.detalles.forEach(item => {
        const qty = (item.quantity || 1).toString().padStart(2);
        const name = (item.name || 'Producto').substring(0, 15);
        const total = this.formatMoney(item.subtotal || 0);
        texto += `${qty}x ${name.padEnd(15)} ${total}\n`;
      });
    }
    
    texto += '=======================\n';
    
    const subtotal = saleData.total - (saleData.impuestos || 0) + (saleData.descuento || 0);
    texto += `Subtotal: ${this.formatMoney(subtotal)}\n`;
    
    if (saleData.descuento > 0) {
      texto += `Descuento: -${this.formatMoney(saleData.descuento)}\n`;
    }
    
    if (saleData.impuestos > 0) {
      texto += `ITBIS (18%): ${this.formatMoney(saleData.impuestos)}\n`;
    }
    
    texto += '=======================\n';
    texto += `TOTAL: ${this.formatMoney(saleData.total)}\n`;
    texto += '=======================\n';
    texto += `Pago: ${saleData.metodo_pago || 'Efectivo'}\n`;
    
    if (saleData.metodo_pago === 'Efectivo' && saleData.monto_recibido) {
      texto += `Recibido: ${this.formatMoney(saleData.monto_recibido)}\n`;
      const cambio = (saleData.monto_recibido || 0) - (saleData.total || 0);
      if (cambio > 0) {
        texto += `Cambio: ${this.formatMoney(cambio)}\n`;
      }
    }
    
    texto += '\n';
    texto += 'Gracias por su compra\n';
    texto += '¡Vuelva pronto!\n';
    texto += new Date().toLocaleDateString('es-DO') + '\n';
    
    return texto;
  }

  /**
   * Formatear dinero para texto simple
   */
  formatMoney(amount) {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2
    }).format(amount || 0);
  }

  /**
   * Abre el cajón de dinero
   */
  async openCashDrawer(printerName) {
    if (!EscPOS) {
      return { success: false, error: 'Módulo de impresión no disponible' };
    }

    try {
      // Comando ESC/POS para abrir cajón
      const drawerCommand = '\x1B\x70\x00\x32\x32';
      return await this.printRaw(drawerCommand, printerName);
    } catch (error) {
      console.error('Error abriendo cajón:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * MÉTODO 1: Comunicación directa con impresora térmica con inicialización mejorada
   */
  async printDirectToDevice(buffer, printerName) {
    try {
      const { spawn } = requireModule('child_process');
      const fs = requireModule('fs');
      const os = requireModule('os');
      const path = requireModule('path');

      // PASO 1: Crear inicialización básica para impresoras térmicas
      const initCommands = Buffer.from([
        0x1B, 0x40,       // ESC @ - Hard reset
        0x1B, 0x74, 0x00, // ESC t 0 - Character table PC437
        0x1B, 0x52, 0x00, // ESC R 0 - Character set USA  
        0x1D, 0x21, 0x00, // GS ! - Normal size
        0x1B, 0x61, 0x00, // ESC a - Left align
        0x1B, 0x32,       // ESC 2 - Default line spacing
        0x1B, 0x33, 0x18, // ESC 3 - Line spacing 24 dots
      ]);

      // PASO 2: Mensaje de prueba simple
      const testMessage = 'PRUEBA IMPRESORA TERMICA\n' +
                         '========================\n' +
                         'Conectado correctamente\n\n';

      // PASO 3: Combinar todo con corte final
      const cutCommand = Buffer.from([0x1D, 0x56, 0x00]); // Corte parcial
      const testBuffer = Buffer.from(testMessage, 'latin1');
      const fullBuffer = Buffer.concat([initCommands, testBuffer, buffer, cutCommand]);

      // Crear archivo temporal con los datos RAW optimizados
      const tempFile = path.join(os.tmpdir(), `wilpos_direct_${Date.now()}.raw`);
      fs.writeFileSync(tempFile, fullBuffer, 'binary');

      console.log(`📡 Enviando a impresora térmica: ${printerName}`);
      console.log(`📄 Archivo: ${tempFile}`);
      console.log(`📏 Init: ${initCommands.length}b + Test: ${testBuffer.length}b + Data: ${buffer.length}b = ${fullBuffer.length}b total`);

      // MÚLTIPLES MÉTODOS DE ENVÍO PARA COMPATIBILIDAD
      const methods = [
        // Método 1: COPY binario directo
        `copy /B "${tempFile}" "\\\\localhost\\${printerName}"`,
        // Método 2: TYPE directo  
        `type "${tempFile}" > "\\\\localhost\\${printerName}"`,
        // Método 3: Net use + copy
        `net use LPT1: "\\\\localhost\\${printerName}" & copy /B "${tempFile}" LPT1: & net use LPT1: /delete`
      ];

      for (let i = 0; i < methods.length; i++) {
        const method = methods[i];
        console.log(`🔧 Método ${i+1}: ${method.split('&')[0]}...`);

        try {
          const result = await new Promise((resolve) => {
            const process = spawn('cmd', ['/c', method], {
              stdio: ['pipe', 'pipe', 'pipe'],
              shell: true,
              windowsHide: true
            });

            let output = '';
            let errorOutput = '';

            process.stdout.on('data', (data) => output += data.toString());
            process.stderr.on('data', (data) => errorOutput += data.toString());

            process.on('close', (code) => {
              console.log(`📊 Método ${i+1} - Código: ${code}, Error: ${errorOutput || 'ninguno'}`);
              
              if (code === 0 && !errorOutput.toLowerCase().includes('error')) {
                resolve({ success: true, method: `direct_${i+1}`, output, code });
              } else {
                resolve({ success: false, error: errorOutput || `Exit code ${code}` });
              }
            });

            // Timeout por método
            setTimeout(() => {
              process.kill();
              resolve({ success: false, error: 'Timeout' });
            }, 8000);
          });

          if (result.success) {
            console.log(`✅ ÉXITO con método ${i+1}`);
            try { fs.unlinkSync(tempFile); } catch(e) {}
            return result;
          }
        } catch (error) {
          console.log(`❌ Método ${i+1} falló: ${error.message}`);
        }
      }

      // Si todos fallan, limpiar y reportar
      try { fs.unlinkSync(tempFile); } catch(e) {}
      console.log('❌ Todos los métodos directos fallaron');
      return { success: false, error: 'All direct communication methods failed' };

    } catch (error) {
      console.error('💥 Error crítico en comunicación directa:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * MÉTODO 2: Comunicación por puerto de dispositivo
   */
  async printToDevicePort(buffer, printerName) {
    try {
      const { execSync } = requireModule('child_process');
      const fs = requireModule('fs');
      const os = requireModule('os');
      const path = requireModule('path');

      // Intentar detectar puerto COM o LPT
      const portResult = await this.detectPrinterPort(printerName);
      if (!portResult.success) {
        return { success: false, error: 'No se pudo detectar puerto de impresora' };
      }

      const port = portResult.port;
      console.log(`🔌 Usando puerto: ${port}`);

      // Crear archivo temporal
      const tempFile = path.join(os.tmpdir(), `wilpos_port_${Date.now()}.raw`);
      fs.writeFileSync(tempFile, buffer);

      // Envío directo al puerto con múltiples métodos
      console.log(`📤 Intentando envío a puerto ${port}...`);
      
      try {
        // Método 1: TYPE directo
        const typeCommand = `type "${tempFile}" > ${port}`;
        console.log(`🔧 Comando: ${typeCommand}`);
        execSync(typeCommand, { timeout: 5000 });
        console.log(`✅ TYPE exitoso al puerto ${port}`);
      } catch (typeError) {
        console.log(`❌ TYPE falló: ${typeError.message}`);
        
        try {
          // Método 2: COPY /B al puerto
          const copyCommand = `copy /B "${tempFile}" ${port}`;
          console.log(`🔧 Comando fallback: ${copyCommand}`);
          execSync(copyCommand, { timeout: 5000 });
          console.log(`✅ COPY exitoso al puerto ${port}`);
        } catch (copyError) {
          console.log(`❌ COPY falló: ${copyError.message}`);
          
          // Método 3: Redirección con ECHO
          const echoCommand = `echo. && type "${tempFile}" > ${port}`;
          console.log(`🔧 Comando echo: ${echoCommand}`);
          execSync(echoCommand, { timeout: 5000 });
          console.log(`✅ ECHO exitoso al puerto ${port}`);
        }
      }
      
      // Limpiar
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {}

      console.log('✅ Envío por puerto exitoso');
      return { success: true, method: 'device_port', port };

    } catch (error) {
      console.error('Error enviando al puerto:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * MÉTODO 3: PowerShell para impresoras USB térmicas
   */
  async printViaPowerShell(buffer, printerName) {
    try {
      const { spawn } = requireModule('child_process');
      const fs = requireModule('fs');
      const os = requireModule('os');
      const path = requireModule('path');

      console.log(`🔋 Intentando PowerShell para: ${printerName}`);

      // Crear archivo temporal
      const tempFile = path.join(os.tmpdir(), `wilpos_ps_${Date.now()}.raw`);
      fs.writeFileSync(tempFile, buffer);

      // Script PowerShell para impresión directa
      const psScript = `
        try {
          $printerName = "${printerName}"
          $filePath = "${tempFile.replace(/\\/g, '\\\\')}"
          
          Write-Host "📡 PowerShell: Enviando a impresora: $printerName"
          Write-Host "📄 Archivo: $filePath"
          
          # Método 1: Usar Out-Printer
          Get-Content -Path $filePath -Raw -Encoding Byte | Out-Printer -Name $printerName
          Write-Host "✅ Out-Printer exitoso"
          
        } catch {
          Write-Host "❌ Out-Printer falló: $($_.Exception.Message)"
          
          try {
            # Método 2: Usar System.Drawing.Printing
            Add-Type -AssemblyName System.Drawing
            Add-Type -AssemblyName System.Windows.Forms
            
            $doc = New-Object System.Drawing.Printing.PrintDocument
            $doc.PrinterSettings.PrinterName = $printerName
            
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $stream = New-Object System.IO.MemoryStream(,$bytes)
            
            $doc.add_PrintPage({
              param($sender, $e)
              $e.Graphics.DrawString([System.Text.Encoding]::ASCII.GetString($bytes), 
                (New-Object System.Drawing.Font("Courier New", 8)), 
                [System.Drawing.Brushes]::Black, 0, 0)
            })
            
            $doc.Print()
            Write-Host "✅ System.Drawing.Printing exitoso"
            
          } catch {
            Write-Host "❌ System.Drawing.Printing falló: $($_.Exception.Message)"
            throw "Ambos métodos PowerShell fallaron"
          }
        }
      `.trim();

      return new Promise((resolve) => {
        const process = spawn('powershell', ['-Command', psScript], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true
        });

        let output = '';
        let errorOutput = '';

        process.stdout.on('data', (data) => {
          const text = data.toString();
          output += text;
          console.log(`🔋 PS Output: ${text.trim()}`);
        });

        process.stderr.on('data', (data) => {
          const text = data.toString();
          errorOutput += text;
          console.log(`🔋 PS Error: ${text.trim()}`);
        });

        process.on('close', (code) => {
          try {
            fs.unlinkSync(tempFile);
          } catch (e) {}

          if (code === 0 && output.includes('exitoso')) {
            console.log('✅ PowerShell printing exitoso');
            resolve({ success: true, method: 'powershell', output });
          } else {
            console.log('❌ PowerShell printing falló:', errorOutput);
            resolve({ success: false, error: errorOutput || 'PowerShell failed' });
          }
        });

        setTimeout(() => {
          process.kill();
          resolve({ success: false, error: 'PowerShell timeout' });
        }, 15000);
      });

    } catch (error) {
      console.error('Error en PowerShell:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * MÉTODO 4: Comunicación por red (impresoras IP)
   */
  async printToNetworkPrinter(buffer, printerName) {
    try {
      const net = requireModule('net');
      
      // Intentar detectar si es impresora de red
      const ipMatch = printerName.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (!ipMatch) {
        return { success: false, error: 'No es impresora de red' };
      }

      const ip = ipMatch[1];
      const port = 9100; // Puerto estándar para impresoras RAW

      console.log(`🌐 Conectando a impresora de red: ${ip}:${port}`);

      return new Promise((resolve) => {
        const socket = new net.Socket();
        let connected = false;

        socket.setTimeout(5000);

        socket.connect(port, ip, () => {
          connected = true;
          console.log('🔗 Conectado a impresora de red');
          socket.write(buffer);
          socket.end();
        });

        socket.on('close', () => {
          if (connected) {
            console.log('✅ Envío de red completado');
            resolve({ success: true, method: 'network', ip, port });
          }
        });

        socket.on('error', (error) => {
          console.error('❌ Error de red:', error.message);
          resolve({ success: false, error: error.message });
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve({ success: false, error: 'Network timeout' });
        });
      });

    } catch (error) {
      console.error('Error en comunicación de red:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Detecta el puerto físico REAL de la impresora con múltiples métodos
   */
  async detectPrinterPort(printerName) {
    try {
      const { execSync } = requireModule('child_process');

      console.log(`🔍 DETECCIÓN AVANZADA DE PUERTO: ${printerName}`);

      // MÉTODO 1: WMI extendido para obtener más información
      try {
        const wmiCommand = `wmic printer where "name='${printerName}'" get portname,drivername,location,attributes /value`;
        const output = execSync(wmiCommand, { encoding: 'utf8', timeout: 5000 });
        console.log(`📋 WMI Output: ${output}`);
        
        const portMatch = output.match(/PortName=([^\r\n]+)/i);
        if (portMatch) {
          const wmiPort = portMatch[1].trim();
          console.log(`🔌 WMI reporta puerto: ${wmiPort}`);
          
          // Verificar si es un puerto físico real
          if (wmiPort.match(/^(USB\d+|COM\d+|LPT\d+)$/i)) {
            console.log(`✅ Puerto físico válido desde WMI: ${wmiPort}`);
            return { success: true, port: wmiPort, method: 'WMI' };
          }
        }
      } catch (wmiError) {
        console.log(`⚠️ WMI falló: ${wmiError.message}`);
      }

      // MÉTODO 2: Buscar en el registro de Windows
      try {
        console.log(`🔍 Buscando en registro de Windows...`);
        const regCommand = `reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers\\${printerName}" /v Port`;
        const regOutput = execSync(regCommand, { encoding: 'utf8', timeout: 3000 });
        const regMatch = regOutput.match(/Port\s+REG_SZ\s+(.+)/i);
        if (regMatch) {
          const regPort = regMatch[1].trim();
          console.log(`🗃️ Registro reporta puerto: ${regPort}`);
          if (regPort.match(/^(USB\d+|COM\d+|LPT\d+)$/i)) {
            return { success: true, port: regPort, method: 'Registry' };
          }
        }
      } catch (regError) {
        console.log(`⚠️ Registro falló: ${regError.message}`);
      }

      // MÉTODO 3: Listar todos los puertos disponibles y probar cada uno
      console.log(`🔍 PROBANDO PUERTOS FÍSICOS DISPONIBLES...`);
      
      const allPorts = [
        'USB001', 'USB002', 'USB003', 'USB004', 'USB005',
        'COM1', 'COM2', 'COM3', 'COM4', 'COM5',
        'LPT1', 'LPT2', 'LPT3',
        'DOT4_001', 'DOT4_002', 'DOT4_003'
      ];

      for (const testPort of allPorts) {
        try {
          console.log(`🧪 Probando acceso a puerto: ${testPort}`);
          
          // Crear un comando de prueba muy simple
          const testCommand = `echo PRUEBA > ${testPort}`;
          execSync(testCommand, { timeout: 1500 });
          
          console.log(`✅ Puerto ${testPort} responde - ESTE ES EL CORRECTO`);
          
          // Hacer una segunda verificación
          try {
            execSync(`echo. > ${testPort}`, { timeout: 1000 });
            console.log(`🎯 Puerto ${testPort} CONFIRMADO como funcional`);
            return { success: true, port: testPort, method: 'DirectTest' };
          } catch (e) {
            console.log(`❌ Segunda prueba en ${testPort} falló`);
          }
          
        } catch (e) {
          // El puerto no está disponible, continuar
        }
      }

      // MÉTODO 4: Usar PowerShell para listar puertos de impresora
      try {
        console.log(`🔍 Usando PowerShell para detectar puertos...`);
        const psCommand = `powershell -Command "Get-WmiObject -Class Win32_Printer | Where-Object {$_.Name -eq '${printerName}'} | Select-Object Name, PortName"`;
        const psOutput = execSync(psCommand, { encoding: 'utf8', timeout: 5000 });
        console.log(`💻 PowerShell output: ${psOutput}`);
        
        const psMatch = psOutput.match(/PortName\s*:\s*(.+)/i);
        if (psMatch) {
          const psPort = psMatch[1].trim();
          console.log(`⚡ PowerShell detectó puerto: ${psPort}`);
          if (psPort.match(/^(USB\d+|COM\d+|LPT\d+)$/i)) {
            return { success: true, port: psPort, method: 'PowerShell' };
          }
        }
      } catch (psError) {
        console.log(`⚠️ PowerShell falló: ${psError.message}`);
      }

      console.log(`❌ NO SE ENCONTRÓ PUERTO FUNCIONAL - La impresora podría estar offline`);
      return { success: false, error: 'No se encontró puerto funcional para la impresora' };

    } catch (error) {
      console.error(`❌ Error general detectando puerto: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Guarda como PDF
   */
  async savePDF(options) {
    try {
      const { html, path: outPath, ...pdfOptions } = options;
      
      const win = new BrowserWindow({ 
        show: false, 
        webPreferences: { nodeIntegration: false } 
      });
      
      await win.loadURL(`data:text/html,${encodeURIComponent(html)}`);
      
      const finalOptions = {
        printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        ...pdfOptions
      };
      
      const pdf = await win.webContents.printToPDF(finalOptions);
      await fs.ensureDir(dirname(outPath));
      await fs.writeFile(outPath, pdf);
      
      win.destroy();
      
      return { success: true, path: outPath };
    } catch (error) {
      console.error('Error guardando PDF:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sistema de impresión universal para cualquier impresora térmica
   */
  generateInvoiceESC(saleData, paperWidth = 'auto') {
    // Detectar automáticamente el ancho del papel
    const detectedWidth = this.detectPaperWidth(paperWidth);
    
    // Crear factura universal con control total
    return this.createUniversalInvoice(saleData, detectedWidth);
  }

  /**
   * Detecta el ancho del papel de la impresora
   */
  detectPaperWidth(paperWidth) {
    if (paperWidth === '58mm' || paperWidth === 58) return 58;
    if (paperWidth === '80mm' || paperWidth === 80) return 80;
    
    // Auto-detección basada en nombre de impresora (mejora futura)
    return 80; // Por defecto 80mm
  }

  /**
   * Crea factura universal con comandos ESC/POS directos
   */
  createUniversalInvoice(saleData, paperWidth = 80) {
    const commands = [];
    const charWidth = paperWidth === 58 ? 32 : 48;
    
    // ========== INICIALIZACIÓN UNIVERSAL ==========
    commands.push('\x1B\x40'); // ESC @ - Reset COMPLETO (elimina @ª·E)
    commands.push('\x1B\x74\x00'); // ESC t 0 - Tabla PC437 (universal)
    commands.push('\x1B\x52\x00'); // ESC R 0 - Character set USA
    commands.push('\x1B\x44\x00'); // ESC D - Clear horizontal tabs
    commands.push('\x1B\x42\x00'); // ESC B - Clear vertical tabs
    commands.push('\x1C\x2E'); // FS . - Cancel page mode
    
    // Configurar área de impresión según papel
    if (paperWidth === 58) {
      commands.push('\x1D\x57\x68\x01'); // 360 dots para 58mm
    } else {
      commands.push('\x1D\x57\x00\x02'); // 512 dots para 80mm
    }
    
    commands.push('\x1B\x21\x00'); // ESC ! - Cancel formatting
    commands.push('\x1D\x21\x00'); // GS ! - Normal size
    commands.push('\x1B\x61\x00'); // ESC a - Left align
    commands.push('\x1B\x32'); // ESC 2 - Default line spacing
    
    // ========== ENCABEZADO ==========
    commands.push('\x1B\x61\x01'); // Centrar
    commands.push('\x1D\x21\x11'); // Doble tamaño
    commands.push('\x1B\x45\x01'); // Negrita
    commands.push(this.cleanText(saleData.businessName || 'WilPOS') + '\n');
    commands.push('\x1D\x21\x00\x1B\x45\x00'); // Reset
    
    if (saleData.businessInfo) {
      commands.push(this.cleanText(saleData.businessInfo) + '\n');
    }
    
    // Separador responsivo
    commands.push('-'.repeat(charWidth) + '\n');
    
    // ========== INFORMACIÓN ==========
    commands.push('\x1B\x61\x00'); // Izquierda
    commands.push('\x1B\x45\x01FACTURA No: ' + (saleData.id || 'N/A') + '\x1B\x45\x00\n');
    
    const fecha = new Date(saleData.fecha_venta || Date.now()).toLocaleString('es-DO');
    commands.push('Fecha: ' + fecha + '\n');
    commands.push('Cliente: ' + this.cleanText(saleData.cliente || 'Cliente General') + '\n');
    
    if (saleData.usuario) {
      commands.push('Cajero: ' + this.cleanText(saleData.usuario) + '\n');
    }
    
    commands.push('-'.repeat(charWidth) + '\n');
    
    // ========== PRODUCTOS ==========
    if (saleData.detalles && Array.isArray(saleData.detalles)) {
      // Encabezado responsivo
      if (charWidth >= 40) {
        commands.push('Cant Producto            Precio  Total\n');
      } else {
        commands.push('Cant Producto        Total\n');
      }
      commands.push('-'.repeat(charWidth) + '\n');
      
      // Agrupar por categorías
      const categorized = this.groupByCategory(saleData.detalles);
      
      Object.keys(categorized).sort().forEach(categoria => {
        const items = categorized[categoria];
        
        // Mostrar categoría si hay más de una
        if (Object.keys(categorized).length > 1) {
          commands.push('\x1B\x45\x01>> ' + this.cleanText(categoria.toUpperCase()) + '\x1B\x45\x00\n');
        }
        
        items.forEach(item => {
          const qty = (item.quantity || 1).toString().padStart(2);
          const total = this.formatMoney(item.subtotal || 0);
          
          if (charWidth >= 40) {
            const name = this.truncateText(this.cleanText(item.name || 'Producto'), 20);
            const price = this.formatMoney(item.price || 0);
            commands.push(`${qty} ${name.padEnd(20)} ${price.padStart(7)} ${total.padStart(7)}\n`);
          } else {
            const name = this.truncateText(this.cleanText(item.name || 'Producto'), 15);
            commands.push(`${qty} ${name.padEnd(15)} ${total.padStart(10)}\n`);
          }
        });
        
        if (Object.keys(categorized).length > 1) commands.push('\n');
      });
    }
    
    commands.push('-'.repeat(charWidth) + '\n');
    
    // ========== TOTALES ==========
    commands.push('\x1B\x61\x02'); // Derecha
    
    const subtotal = saleData.total - (saleData.impuestos || 0) + (saleData.descuento || 0);
    commands.push('Subtotal: ' + this.formatMoney(subtotal) + '\n');
    
    if (saleData.descuento > 0) {
      commands.push('Descuento: -' + this.formatMoney(saleData.descuento) + '\n');
    }
    
    if (saleData.impuestos > 0) {
      commands.push('ITBIS: ' + this.formatMoney(saleData.impuestos) + '\n');
    }
    
    commands.push('-'.repeat(charWidth) + '\n');
    
    // TOTAL DESTACADO
    commands.push('\x1D\x21\x11\x1B\x45\x01TOTAL: ' + this.formatMoney(saleData.total) + '\x1D\x21\x00\x1B\x45\x00\n');
    
    // ========== PAGO ==========
    commands.push('-'.repeat(charWidth) + '\n');
    commands.push('Metodo: ' + this.cleanText(saleData.metodo_pago || 'Efectivo') + '\n');
    
    if (saleData.metodo_pago === 'Efectivo' && saleData.monto_recibido) {
      commands.push('Recibido: ' + this.formatMoney(saleData.monto_recibido) + '\n');
      const cambio = (saleData.monto_recibido || 0) - (saleData.total || 0);
      if (cambio > 0) {
        commands.push('Cambio: ' + this.formatMoney(cambio) + '\n');
      }
    }
    
    // ========== QR CODE ==========
    const qrData = `FACTURA:${saleData.id}|TOTAL:${saleData.total}|FECHA:${new Date().toISOString().split('T')[0]}`;
    commands.push('\x1B\x61\x01\n'); // Centrar
    commands.push(this.generateQRCommands(qrData));
    
    // ========== PIE ==========
    commands.push('\x1B\x61\x01'); // Centrar
    commands.push('-'.repeat(charWidth) + '\n');
    commands.push(this.cleanText(saleData.mensaje || 'Gracias por su compra') + '\n');
    commands.push('Vuelva pronto\n');
    commands.push(new Date().toLocaleDateString('es-DO') + '\n');
    
    // FINALIZAR - Solo saltos necesarios
    commands.push('\n\n');
    commands.push('\x1D\x56\x00'); // Corte parcial
    
    return commands.join('');
  }

  /**
   * Limpia texto para impresión directa (sin caracteres problemáticos)
   */
  cleanText(text) {
    if (!text) return '';
    
    // Reemplazar caracteres problemáticos con equivalentes seguros
    return text
      .replace(/[áàâã]/gi, 'a')
      .replace(/[éèê]/gi, 'e')
      .replace(/[íìî]/gi, 'i')
      .replace(/[óòôõ]/gi, 'o')
      .replace(/[úùû]/gi, 'u')
      .replace(/ñ/gi, 'n')
      .replace(/[¿¡]/g, '')
      .replace(/[^\x20-\x7E]/g, '') // Solo caracteres ASCII imprimibles
      .trim();
  }

  /**
   * Agrupa productos por categoría
   */
  groupByCategory(items) {
    const grouped = {};
    
    items.forEach(item => {
      const categoria = item.categoria || item.category || 'Productos';
      if (!grouped[categoria]) {
        grouped[categoria] = [];
      }
      grouped[categoria].push(item);
    });
    
    return grouped;
  }

  /**
   * Codifica texto español para impresoras térmicas Xprinter (PC858)
   */
  encodeSpanish(text) {
    if (!text) return '';
    
    // Mapa de caracteres especiales para codificación PC858 (mejor para Xprinter)
    const charMap = {
      'á': '\xA0', 'Á': '\xB5',
      'é': '\x82', 'É': '\x90', 
      'í': '\xA1', 'Í': '\xD6',
      'ó': '\xA2', 'Ó': '\xE0',
      'ú': '\xA3', 'Ú': '\xE9',
      'ñ': '\xA4', 'Ñ': '\xA5',
      'ü': '\x81', 'Ü': '\x9A',
      '¿': '\xA8', '¡': '\xAD',
      '°': '\xF8', '€': '\xD5'
    };
    
    let result = text;
    for (const [char, code] of Object.entries(charMap)) {
      result = result.replace(new RegExp(char, 'g'), code);
    }
    
    return result;
  }

  /**
   * Genera comandos ESC/POS para código QR
   */
  generateQRCommands(data) {
    const commands = [];
    
    // Configurar módulo QR
    commands.push('\x1D\x28\x6B\x04\x00\x31\x41\x32\x00'); // Modelo 2
    commands.push('\x1D\x28\x6B\x03\x00\x31\x43\x03'); // Tamaño módulo 3
    commands.push('\x1D\x28\x6B\x03\x00\x31\x45\x30'); // Corrección de error nivel L
    
    // Almacenar datos
    const dataLength = data.length + 3;
    const pL = dataLength % 256;
    const pH = Math.floor(dataLength / 256);
    commands.push(`\x1D\x28\x6B${String.fromCharCode(pL, pH)}\x31\x50\x30${data}`);
    
    // Imprimir QR
    commands.push('\x1D\x28\x6B\x03\x00\x31\x51\x30');
    
    return commands.join('');
  }

  /**
   * Genera datos para el código QR
   */
  generateQRData(saleData) {
    const qrData = {
      factura: saleData.id || 'N/A',
      fecha: new Date(saleData.fecha_venta || Date.now()).toISOString().split('T')[0],
      total: saleData.total || 0,
      cliente: saleData.cliente || 'Cliente General'
    };
    
    return `FACTURA:${qrData.factura}|FECHA:${qrData.fecha}|TOTAL:${qrData.total}|CLIENTE:${qrData.cliente}`;
  }

  /**
   * Genera comandos para imprimir logo (imagen bitmap)
   */
  generateLogoCommands(logoData) {
    // Para logos simples, usar comandos de imagen bitmap
    // Esto requeriría procesar la imagen y convertirla a formato ESC/POS
    // Por ahora, retornamos un placeholder que se puede expandir
    return '\x1B\x2A\x00\x18\x00' + logoData; // Comando básico de imagen
  }

  /**
   * Configura la impresora Xprinter para formato óptimo
   */
  configureXprinter() {
    const commands = [];
    
    // Reset completo
    commands.push('\x1B\x40'); // ESC @ - Initialize
    
    // Configuraciones específicas para Xprinter
    commands.push('\x1B\x44\x00'); // Clear horizontal tabs
    commands.push('\x1B\x42\x00'); // Clear vertical tabs
    commands.push('\x1B\x33\x14'); // Set line spacing to 1/6 inch (20/120)
    commands.push('\x1B\x32'); // Select default line spacing
    
    // Configurar área de impresión para 80mm
    commands.push('\x1D\x4C\x00\x00'); // Set left margin to 0
    commands.push('\x1D\x57\x00\x02'); // Set print area width (512 dots)
    
    // Seleccionar codificación de caracteres
    commands.push('\x1B\x74\x13'); // Select PC858 character table
    commands.push('\x1B\x52\x07'); // Select Spain international character set
    
    // Configuración por defecto
    commands.push('\x1B\x21\x00'); // Cancel character formatting
    commands.push('\x1D\x21\x00'); // Select character size (normal)
    commands.push('\x1B\x61\x00'); // Left justification
    
    return commands.join('');
  }

  /**
   * Agrupa productos por categoría para una mejor presentación
   */
  groupItemsByCategory(items) {
    const grouped = {};
    
    items.forEach(item => {
      const categoria = item.categoria || item.category || 'Sin Categoría';
      if (!grouped[categoria]) {
        grouped[categoria] = [];
      }
      grouped[categoria].push(item);
    });
    
    return grouped;
  }

  /**
   * Trunca texto de manera inteligente para optimizar espacio
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    
    // Truncar y agregar indicador
    return text.substring(0, maxLength - 1) + '…';
  }

  /**
   * Genera comandos ESC/POS para etiqueta
   */
  generateLabelESC(labelData) {
    const commands = [];

    commands.push('\x1B\x40'); // Inicializar
    commands.push('\x1B\x61\x01'); // Centrar

    // Nombre del producto
    commands.push('\x1B\x45\x01'); // Negrita
    commands.push(`${labelData.name || 'Producto'}\n`);
    commands.push('\x1B\x45\x00'); // Normal

    // Categoría
    if (labelData.category) {
      commands.push(`Cat: ${labelData.category}\n`);
    }

    // Precio
    commands.push('\x1B\x45\x01'); // Negrita
    commands.push('\x1D\x21\x01'); // Doble altura
    commands.push(`${this.formatMoney(labelData.price || 0)}\n`);
    commands.push('\x1D\x21\x00'); // Tamaño normal
    commands.push('\x1B\x45\x00'); // Normal

    // Código de barras
    if (labelData.barcode) {
      commands.push(`COD: ${labelData.barcode}\n`);
    }

    commands.push('\n');
    commands.push('\x1D\x56\x00'); // Cortar

    return commands.join('');
  }

  /**
   * Genera comandos ESC/POS para código de barras
   */
  generateBarcodeESC(barcodeData) {
    const commands = [];

    commands.push('\x1B\x40'); // Inicializar
    commands.push('\x1B\x61\x01'); // Centrar

    // Título
    commands.push('\x1B\x45\x01'); // Negrita
    commands.push('CODIGO DE BARRAS\n');
    commands.push('\x1B\x45\x00'); // Normal

    // Configurar código de barras
    commands.push('\x1D\x68\x64'); // Altura del código de barras (100 puntos)
    commands.push('\x1D\x77\x02'); // Ancho del código de barras

    // Imprimir código de barras CODE128
    const barcodeText = barcodeData.text || barcodeData.barcode || '123456789';
    commands.push('\x1D\x6B\x49'); // CODE128
    commands.push(String.fromCharCode(barcodeText.length)); // Longitud
    commands.push(barcodeText); // Datos

    commands.push('\n\n');

    // Texto del código
    commands.push(`${barcodeText}\n`);

    // Información adicional
    if (barcodeData.name) {
      commands.push(`Producto: ${barcodeData.name}\n`);
    }

    if (barcodeData.price) {
      commands.push(`Precio: ${this.formatMoney(barcodeData.price)}\n`);
    }

    commands.push('\n');
    commands.push('\x1D\x56\x00'); // Cortar

    return commands.join('');
  }

  /**
   * Genera comandos ESC/POS para código QR
   */
  generateQRESC(qrData) {
    const commands = [];

    commands.push('\x1B\x40'); // Inicializar
    commands.push('\x1B\x61\x01'); // Centrar

    // Título
    commands.push('\x1B\x45\x01'); // Negrita
    commands.push('CODIGO QR\n');
    commands.push('\x1B\x45\x00'); // Normal

    const qrText = qrData.text || qrData.url || 'https://ejemplo.com';

    // Configurar QR (modelo 2)
    commands.push('\x1D\x28\x6B\x04\x00\x31\x41\x32\x00'); // Función QR
    commands.push('\x1D\x28\x6B\x03\x00\x31\x43\x08'); // Tamaño del módulo
    commands.push('\x1D\x28\x6B\x03\x00\x31\x45\x30'); // Nivel de corrección de errores

    // Almacenar datos QR
    const qrLength = qrText.length + 3;
    const pL = qrLength & 0xFF;
    const pH = (qrLength >> 8) & 0xFF;
    
    commands.push('\x1D\x28\x6B');
    commands.push(String.fromCharCode(pL, pH));
    commands.push('\x31\x50\x30');
    commands.push(qrText);

    // Imprimir QR
    commands.push('\x1D\x28\x6B\x03\x00\x31\x51\x30');

    commands.push('\n\n');

    // Texto del QR
    commands.push(`${qrText}\n`);

    // Información adicional
    if (qrData.title) {
      commands.push(`${qrData.title}\n`);
    }

    commands.push('\n');
    commands.push('\x1D\x56\x00'); // Cortar

    return commands.join('');
  }

  /**
   * Genera comandos ESC/POS para prueba
   */
  generateTestESC() {
    const commands = [];

    commands.push('\x1B\x40'); // Inicializar
    commands.push('\x1B\x61\x01'); // Centrar
    commands.push('\x1B\x45\x01'); // Negrita
    commands.push('PRUEBA DE IMPRESORA\n');
    commands.push('\x1B\x45\x00'); // Normal

    commands.push(`Fecha: ${new Date().toLocaleString()}\n`);
    commands.push('Sistema: WilPOS\n');
    commands.push('\n');
    commands.push('Impresion exitosa!\n');
    commands.push('\n');

    commands.push('\x1D\x56\x00'); // Cortar

    return commands.join('');
  }

  /**
   * Formatea dinero para recibos
   */
  formatMoney(amount) {
    const symbol = 'RD$'; // Se puede obtener de configuración
    return `${symbol}${Number(amount).toFixed(2)}`;
  }
}

/**
 * Servicio de gestión de ventanas
 */
class WindowService {
  constructor() {
    this.setupHandlers();
  }

  setupHandlers() {
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

    safeHandle('openComponentWindow', async (event, componentName) => {
      if (windowCache.has(componentName)) {
        const cachedWin = windowCache.get(componentName);
        if (!cachedWin.isDestroyed()) {
          cachedWin.focus();
          return { windowId: cachedWin.id, cached: true, success: true };
        }
        windowCache.delete(componentName);
      }

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

      const devPort = process.env.VITE_DEV_PORT || '3000';
      const loadUrl = isDev
        ? `http://localhost:${devPort}/?component=${encodeURIComponent(componentName)}`
        : `file://${join(__dirname, 'dist/index.html')}?component=${encodeURIComponent(componentName)}`;

      await newWin.loadURL(loadUrl);
      windowCache.set(componentName, newWin);

      newWin.on('closed', () => {
        windowCache.delete(componentName);
      });

      return { windowId: newWin.id, cached: false, success: true };
    });
  }
}

/**
 * Servicio de sistema de archivos
 */
class FileService {
  constructor() {
    this.setupHandlers();
  }

  setupHandlers() {
    safeHandle('openFolder', async (event, folderPath) => {
      await fs.ensureDir(folderPath);
      await shell.openPath(folderPath);
      return true;
    });

    safeHandle('ensureDir', async (event, folderPath) => {
      await fs.ensureDir(folderPath);
      return { success: true };
    });

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
 * Crear ventana principal con manejo de errores mejorado
 */
function createMainWindow() {
  try {
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
        sandbox: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false
      },
      icon: join(__dirname, 'assets', 'images', 'icons', 'logo.ico')
    });

    const devPort = process.env.VITE_DEV_PORT || '3000';
    const url = isDev
      ? `http://localhost:${devPort}`
      : `file://${join(__dirname, 'dist/index.html')}`;

    logger.info('Window', 'Loading main window', { url, isDev });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      logger.error('Window', 'Failed to load URL', {
        url: validatedURL,
        errorCode,
        errorDescription
      });
      
      mainWindow.loadURL('data:text/html,<h1>Error de Carga</h1><p>No se pudo cargar la aplicación. Código: ' + errorCode + '</p>');
    });

    mainWindow.webContents.on('crashed', (event, killed) => {
      logger.error('Window', 'Main window crashed', { killed });
    });

    mainWindow.webContents.on('unresponsive', () => {
      logger.warn('Window', 'Main window became unresponsive');
    });

    mainWindow.webContents.on('responsive', () => {
      logger.info('Window', 'Main window became responsive again');
    });

    mainWindow.on('closed', () => {
      logger.info('Window', 'Main window closed');
      mainWindow = null;
    });

    // Memory management
    mainWindow.webContents.on('dom-ready', () => {
      if (process.env.NODE_ENV === 'production') {
        mainWindow.webContents.session.clearCache();
      }
    });

    mainWindow.loadURL(url);
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  } catch (error) {
    logger.error('Window', 'Error creating main window', {
      error: error.message,
      stack: error.stack
    });
    
    errorHandler.handleError(error, { operation: 'createMainWindow' });
  }
}

/**
 * Configurar handlers de sincronización en tiempo real
 */
function setupSyncHandlers() {
  // ipcMain y BrowserWindow ya están importados en el módulo
  
  // Handler para recibir eventos de broadcast desde cualquier ventana
  ipcMain.on('broadcast-sync-event', (event, syncEvent) => {
    // Obtener todas las ventanas abiertas
    const allWindows = BrowserWindow.getAllWindows();
    
    // Enviar el evento a todas las ventanas EXCEPTO la que lo originó
    allWindows.forEach(window => {
      if (window.webContents !== event.sender) {
        window.webContents.send('sync-event', syncEvent);
      }
    });
    
    logger.debug('Sync', 'Broadcasted sync event', {
      type: syncEvent.type,
      action: syncEvent.action,
      windowCount: allWindows.length - 1
    });
  });
  
  logger.info('Sync', 'Real-time sync handlers configured');
}

/**
 * Inicialización de la aplicación con manejo de errores mejorado
 */
app.whenReady().then(async () => {
  const startTime = performance.now();
  
  try {
    // Initialize logging first
    await logger.initialize();
    await logger.info('App', 'Application starting up');

    // Set up security policies
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      logger.security('Permission requested', { permission });
      
      // Deny all permissions by default in production
      if (app.isPackaged) {
        callback(false);
      } else {
        callback(permission === 'media' || permission === 'geolocation');
      }
    });

    // Clear cache in production for security
    if (app.isPackaged) {
      await session.defaultSession.clearCache();
      await session.defaultSession.clearStorageData();
    }
    
    await logger.info('App', 'Session cache cleared');

    // Initialize database with error handling
    try {
      await initializeDatabase();
      await logger.info('App', 'Database initialized successfully');
    } catch (dbError) {
      await logger.error('App', 'Database initialization failed', {
        error: dbError.message,
        stack: dbError.stack
      });
      throw dbError;
    }

    // Configure services
    setupIpcHandlers(); // Handlers de base de datos
    setupSyncHandlers(); // Sistema de sincronización en tiempo real
    setupWindowControls();
    thermalPrinterService = new ReactNativeThermalPrinterService(); // Servicio de impresión React Native EPToolkit
    await thermalPrinterService.initialize(); // Initialize the service
    setupReactNativeThermalPrinterHandlers(); // Setup IPC handlers for React Native thermal printer
    new WindowService();
    new FileService();
    
    await logger.info('App', 'All services configured');

    // Create main window
    createMainWindow();

    // Set up app event handlers
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        logger.info('App', 'Reactivating app - creating new window');
        createMainWindow();
      }
    });

    app.on('second-instance', () => {
      // Focus existing window if user tries to open another instance
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    const initTime = performance.now() - startTime;
    await logger.performance('App initialization', initTime);
    await logger.info('App', `✅ Application initialized successfully in ${initTime.toFixed(2)}ms`);
    
  } catch (err) {
    await logger.error('App', 'Critical initialization error', {
      error: err.message,
      stack: err.stack
    });
    
    await errorHandler.showCriticalErrorDialog(err);
    app.quit();
  }
});

/**
 * Eventos del ciclo de vida de la aplicación
 */
app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', async (event) => {
  try {
    await logger.info('App', 'Application shutting down');
    
    // Prevent immediate quit to allow cleanup
    event.preventDefault();
    
    // Clean up windows
    let windowsDestroyed = 0;
    windowCache.forEach(win => {
      if (!win.isDestroyed()) {
        win.destroy();
        windowsDestroyed++;
      }
    });
    windowCache.clear();
    
    await logger.info('App', `Cleaned up ${windowsDestroyed} cached windows`);
    
    // Close database connection
    try {
      closeDB();
      await logger.info('App', 'Database connection closed');
    } catch (error) {
      await logger.error('App', 'Error closing database', {
        error: error.message,
        stack: error.stack
      });
    }
    
    // Final cleanup
    await logger.info('App', 'Application shutdown complete');
    
    // Now actually quit
    app.quit();
  } catch (error) {
    await logger.error('App', 'Error during shutdown', {
      error: error.message,
      stack: error.stack
    });
    
    // Force quit if cleanup fails
    app.quit();
  }
});

app.on('will-quit', () => {
  const tempDir = join(app.getPath('temp'), 'wilpos-prints');
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('Error limpiando archivos temporales:', error);
  }
});