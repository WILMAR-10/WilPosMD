// src/services/ThermalPrintService.ts
import { Printer, PrintResult } from '../types/printer';

/**
 * Servicio centralizado para impresión ESC/POS utilizando la API nativa (printer module)
 */
class ThermalPrintService {
  private static instance: ThermalPrintService;

  private constructor() {
    // Singleton: no initialization necesaria
  }

  /**
   * Obtiene la instancia única del servicio
   */
  public static getInstance(): ThermalPrintService {
    if (!ThermalPrintService.instance) {
      ThermalPrintService.instance = new ThermalPrintService();
    }
    return ThermalPrintService.instance;
  }

  /**
   * Lista de impresoras detectadas en el sistema
   */
  public async getPrinters(): Promise<Printer[]> {
    const res = await window.printerApi.getPrinters();
    // La API puede devolver directamente un array o { success, printers }
    if (Array.isArray(res)) {
      return res;
    }
    if ((res as any).success) {
      return (res as any).printers;
    }
    return [];
  }

  /**
   * Envía datos RAW (ESC/POS) a la impresora seleccionada o predeterminada
   * @param data - Secuencias ESC/POS (string o Buffer/Uint8Array)
   * @param printerName - Nombre de la impresora (opcional)
   */
  public async printRaw(
    data: string | Uint8Array,
    printerName?: string
  ): Promise<PrintResult> {
    const target = printerName || undefined;
    return window.printerApi.printRaw(data, target);
  }
  

  /**
   * Realiza una prueba rápida de impresión
   */
  public async testPrinter(printerName?: string): Promise<PrintResult> {
    // Comando ESC @ + mensaje + corte
    const cmd = '\x1B\x40' + 'WILPOS TEST PAGE\n' + '\x1D\x56\x00';
    return this.printRaw(cmd, printerName);
  }

  /**
   * Abre el cajón de efectivo mediante pulso ESC/POS
   */
  public async openCashDrawer(printerName?: string): Promise<PrintResult> {
    const pulse = '\x1B\x70\x00\x19\x19';
    return this.printRaw(pulse, printerName);
  }
}

export default ThermalPrintService;
