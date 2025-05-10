// src/types/printer.ts

/**
 * Types related to printer functionality
 */

/**
 * Enum for printer types used in configuration
 */
export enum PrinterType {
  STANDARD = 'normal',
  THERMAL_80MM = 'termica',
  THERMAL_58MM = 'termica58'
}

/**
 * Interface for a printer device
 */
export interface Printer {
  /** Name of the printer in the system */
  name: string;
  /** Whether the printer is the system default */
  isDefault?: boolean;
  /** Description provided by the system */
  description?: string;
  /** Whether the printer is detected as a thermal receipt printer */
  isThermal?: boolean;
  /** Port information if available */
  portName?: string;
}

/**
 * Options for printing documents
 */
export interface PrintOptions {
  /** HTML content to print */
  html?: string;
  /** Raw text/buffer to print */
  data?: string | Uint8Array;
  /** Printer to use - if not specified, uses default */
  printerName?: string;
  /** Whether to show the printer dialog */
  silent?: boolean;
  /** Number of copies to print */
  copies?: number;
  /** Additional printer-specific options */
  options?: {
    /** Paper width for thermal printers */
    paperWidth?: string;
    /** Print speed setting */
    printSpeed?: string;
    /** Font size for printing */
    fontSize?: string;
    /** Indicate this is a thermal receipt printer */
    thermalPrinter?: boolean;
    /** Any other printer-specific options */
    [key: string]: any;
  };
}

/**
 * Options for saving PDF files
 */
export interface SavePdfOptions {
  /** Output path for the PDF */
  path: string;
  /** HTML content to convert */
  html: string;
  /** PDF generation options */
  options?: {
    /** Include background colors/images */
    printBackground?: boolean;
    /** Page margins */
    margins?: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
    /** Page format */
    format?: string;
    /** Other PDF options */
    [key: string]: any;
  };
}

/**
 * Result of a printing operation
 */
export interface PrintResult {
  /** Whether the print operation was successful */
  success: boolean;
  /** ID assigned by the print system if applicable */
  jobID?: number | string;
  /** Error message if printing failed */
  error?: string;
  /** Message about the print operation */
  message?: string;
}

/**
 * Result of a PDF save operation
 */
export interface SavePdfResult {
  /** Whether the save operation was successful */
  success: boolean;
  /** Path where the PDF was saved */
  path?: string;
  /** Error message if saving failed */
  error?: string;
}

/**
 * Status of a printer
 */
export interface PrinterStatus {
  /** Whether the printer is available */
  available: boolean;
  /** Name of the printer checked */
  printerName?: string;
  /** Message about the printer status */
  message?: string;
  /** Error details if any */
  error?: string;
}

/**
 * Options for printing an invoice
 */
export interface PrintInvoiceOptions {
  /** Printer to use */
  printerName?: string;
  /** Whether to show the printer dialog */
  silent?: boolean;
  /** Number of copies to print */
  copies?: number;
  /** Printer-specific options */
  options?: {
    /** Paper width for thermal printers */
    paperWidth?: string;
    /** Print speed setting */
    printSpeed?: string;
    /** Other options */
    [key: string]: any;
  };
}