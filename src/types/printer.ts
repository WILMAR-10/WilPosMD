// src/types/printer.ts

  // Define interface for printer devices
  export interface Printer {
    name: string;
    description?: string;
    status?: number;
    isDefault?: boolean;
    options?: Record<string, any>;
  }
  
  // Interface for print options
  export interface PrintOptions {
    silent?: boolean;
    printerName?: string | null;
    copies?: number;
    printBackground?: boolean;
    options?: {
      paperWidth?: string;
      printSpeed?: string;
      fontSize?: string;
      [key: string]: any;
    };
  }
  
  // Interface for response from print operation
  export interface PrintResult {
    success: boolean;
    error?: string;
    needManualPrint?: boolean;
  }
  
  // Interface for PDF saving options
  export interface SavePdfOptions {
    directory: string;    
    filename?: string;    
    overwrite?: boolean;  
  }
  
  // Interface for the API printInvoice method (matches preload.cjs expectations)
  export interface PrintInvoiceOptions {
    html: string;
    printerName?: string;  // Note: This accepts undefined but not null
    silent?: boolean;
    copies?: number;
    options?: Record<string, any>;
  }
  
  // Interface for save PDF results
  export interface SavePdfResult {
    success: boolean;
    path?: string;
    originalPath?: string;
    message?: string;
    error?: string;
  }