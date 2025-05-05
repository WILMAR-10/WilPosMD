// src/types/printer.ts

// Define printer type enum
export enum PrinterType {
  STANDARD = 'normal',
  THERMAL_80MM = 'termica',
  THERMAL_58MM = 'termica58'
}

// Define interface for printer devices
export interface Printer {
  name: string;
  portName?: string;
  description?: string;
  status?: number;
  isDefault?: boolean;
  isThermal?: boolean;
  options?: Record<string, any>;
}

// Interface for print options
export interface PrintOptions {
  html?: string;
  silent?: boolean;
  printerName?: string | null;
  copies?: number;
  printBackground?: boolean;
  options?: {
    paperWidth?: string;
    printSpeed?: string;
    fontSize?: string;
    thermal?: boolean;
    [key: string]: any;
  };
}

// Interface for response from print operation
export interface PrintResult {
  success: boolean;
  error?: string;
  message?: string;
  needManualPrint?: boolean;
}

// Interface for PDF saving options
export interface SavePdfOptions {
  directory?: string;
  path?: string;
  filename?: string;
  html?: string;
  overwrite?: boolean;
  options?: {
    printBackground?: boolean;
    margins?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };
    pageSize?: string;
    [key: string]: any;
  };
}

// Interface for the API printInvoice method (matches preload.cjs expectations)
export interface PrintInvoiceOptions {
  html: string;
  printerName?: string;
  silent?: boolean;
  copies?: number;
  options?: {
    paperWidth?: string;
    printSpeed?: string;
    fontSize?: string;
    [key: string]: any;
    };
}
// Interface for save PDF results
export interface SavePdfResult {
  success: boolean;
  path?: string;
  originalPath?: string;
  message?: string;
  error?: string;
}

// Interface for printer status
export interface PrinterStatus {
  available: boolean;
  printerName?: string;
  message?: string;
  error?: string;
}