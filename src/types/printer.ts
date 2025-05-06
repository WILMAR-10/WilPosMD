// src/types/printer.ts

/**
 * Tipos y estructuras para impresión ESC/POS nativa vía printer module
 */

/**
 * Enum de tipos de impresora para configuración visual
 */
export enum PrinterType {
  STANDARD = 'normal',
  THERMAL_80MM = 'termica80',
  THERMAL_58MM = 'termica58'
}

/**
 * Representa una impresora detectada en el sistema
 */
export interface Printer {
  /** Nombre de la impresora según el spooler del sistema */
  name: string;
  /** Si esta marcada como predeterminada */
  isDefault?: boolean;
  /** Descripción opcional */
  description?: string;
  /** Indicador genérico para impresoras térmicas */
  isThermal?: boolean;
}

/**
 * Parámetros para impresión RAW (ESC/POS)
 */
export interface RawPrintOptions {
  /** Secuencia ESC/POS en string o bytes */
  data: string | Uint8Array;
  /** Nombre de la impresora; si null, usa la predeterminada */
  printerName?: string | null;
}

/**
 * Resultado genérico de una operación de impresión RAW
 */
export interface PrintResult {
  /** Éxito al enviar datos a la impresora */
  success: boolean;
  /** Identificador de job en el spooler (si aplica) */
  jobID?: number | string;
  /** Mensaje de error en caso de fallo */
  error?: string;
}

/**
 * Estado básico de la impresora para UI
 */
export interface PrinterStatus {
  /** Disponible o no */
  available: boolean;
  /** Nombre de la impresora configurada */
  printerName?: string;
  /** Mensaje informativo */
  message?: string;
  /** Error si ocurrió alguno */
  error?: string;
}
