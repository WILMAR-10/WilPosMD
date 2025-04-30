// src/services/PrinterService.ts
/**
 * Servicio unificado para todas las operaciones relacionadas con impresoras
 */
export class PrinterService {
  private static instance: PrinterService;
  private lastDetectedPrinters: any[] = [];
  private printerDetectionTimestamp: number = 0;

  private constructor() {
    console.log("PrinterService inicializado");
  }

  public static getInstance(): PrinterService {
    if (!PrinterService.instance) {
      PrinterService.instance = new PrinterService();
    }
    return PrinterService.instance;
  }

  /**
   * Obtiene todas las impresoras disponibles con detección mejorada de USB
   */
  async getPrinters(): Promise<{ success: boolean; printers: any[]; error?: string }> {
    try {
      const now = Date.now();
      // Solo usar caché si ha pasado menos de 30 segundos desde la última detección
      if (
        this.lastDetectedPrinters.length > 0 &&
        now - this.printerDetectionTimestamp < 30000
      ) {
        console.log("Usando caché de impresoras detectadas recientemente");
        return {
          success: true,
          printers: this.lastDetectedPrinters
        };
      }

      console.log("Iniciando detección de impresoras...");

      // 1) Intentar con window.printerApi.getPrinters
      if (window.printerApi?.getPrinters) {
        const result = await window.printerApi.getPrinters();
        console.log("Resultado de detección:", JSON.stringify(result, null, 2));
        if (result?.printers && Array.isArray(result.printers)) {
          const enhanced = result.printers.map(p => ({
            ...p,
            isThermal: p.isThermal || this.isThermalPrinter(p.name)
          }));
          this.lastDetectedPrinters = enhanced;
          this.printerDetectionTimestamp = now;
          return { success: true, printers: enhanced };
        }
      }

      // 2) Fallback a window.api.getPrinters si existe
      if (window.api?.getPrinters) {
        try {
          const printers = await window.api.getPrinters();
          if (Array.isArray(printers)) {
            const enhanced = printers.map(p => ({
              ...p,
              isThermal: p.isThermal || this.isThermalPrinter(p.name)
            }));
            this.lastDetectedPrinters = enhanced;
            this.printerDetectionTimestamp = now;
            return { success: true, printers: enhanced };
          }
        } catch (apiError) {
          console.warn("Error con window.api.getPrinters:", apiError);
        }
      }

      // 3) Fallback estático
      console.warn("No hay API de impresoras disponible, usando fallback");
      const common = [
        { name: "Microsoft Print to PDF", isDefault: false, isThermal: false },
        { name: "POS-58",                isDefault: false, isThermal: true  },
        { name: "POS-80",                isDefault: false, isThermal: true  },
        { name: "POS58",                 isDefault: false, isThermal: true  },
        { name: "POS80",                 isDefault: false, isThermal: true  },
        { name: "XP-58",                 isDefault: false, isThermal: true  },
        { name: "XP-80",                 isDefault: false, isThermal: true  },
        { name: "Generic / Text Only",   isDefault: false, isThermal: false },
        { name: "EPSON TM-T20",          isDefault: false, isThermal: true  },
        { name: "EPSON TM-T88V",         isDefault: false, isThermal: true  },
      ];
      this.lastDetectedPrinters = common;
      this.printerDetectionTimestamp = now;
      return { success: true, printers: common };
    } catch (error) {
      console.error("Error obteniendo impresoras:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        printers: []
      };
    }
  }

  /**
   * Imprime contenido
   */
  async print(options: any): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log("PrinterService.print llamado con opciones:", options);
      const isThermal =
        options.options?.thermalPrinter === true ||
        (options.printerName && this.isThermalPrinter(options.printerName));

      if (isThermal && options.rawText && window.printerApi?.printRaw) {
        try {
          console.log("Intentando impresión RAW ESC/POS");
          const raw = await window.printerApi.printRaw(options.rawText, options.printerName);
          if (raw.success) {
            return raw;
          }
          console.warn("Impresión RAW falló, continuando con método HTML");
        } catch (rawError) {
          console.warn("Error en impresión RAW:", rawError);
        }
      }

      if (window.printerApi?.print) {
        console.log(`Enviando trabajo a impresora: ${options.printerName || 'Predeterminada'}`);
        const result = await window.printerApi.print(options);
        if (!result) throw new Error("No hubo respuesta de la API de impresión");
        console.log("Resultado de impresión:", result);
        return result;
      }

      throw new Error("No hay API de impresión disponible");
    } catch (error) {
      console.error("Error imprimiendo:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Guarda como PDF
   */
  async savePdf(options: any): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      if (window.printerApi?.savePdf) {
        return await window.printerApi.savePdf(options);
      }
      throw new Error("No hay API para guardar PDF disponible");
    } catch (error) {
      console.error("Error guardando PDF:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Prueba impresora enviando una página de prueba
   */
  async testPrinter(printerName?: string): Promise<{ success: boolean; message?: string }> {
    console.log(`Probando impresora: ${printerName || 'Predeterminada'}`);
    try {
      const { printers } = await this.getPrinters();
      const target = printerName
        ? printers.find(p => p.name === printerName)
        : printers.find(p => p.isDefault) || printers[0];

      if (!target) {
        return { success: false, message: `No se encontró la impresora: ${printerName || 'Predeterminada'}` };
      }

      const isThermal = target.isThermal || this.isThermalPrinter(target.name);
      console.log(`Impresora ${target.name} térmica: ${isThermal}`);

      // Intentar API específica de prueba
      if (window.api?.testPrinter) {
        try {
          const res = await window.api.testPrinter(target.name);
          if (res.success) return res;
          console.warn("Test específico falló, intentando alternativo");
        } catch (testError) {
          console.warn("Error con testPrinter API:", testError);
        }
      }

      // ESC/POS directo
      if (isThermal && window.printerApi?.printRaw) {
        try {
          console.log("Probando con comandos ESC/POS directos");
          const cmds =
            "\x1B@" +
            "\x1B!0" +
            "\x1Ba\x01" +
            "WILPOS - TEST DE IMPRESORA TERMICA\n\n" +
            "Si puede leer esto, la impresora funciona!\n\n" +
            `Fecha: ${new Date().toLocaleString()}\n\n` +
            "\x1Ba\x00" +
            `Impresora: ${target.name}\n\n` +
            "\x1Ba\x01" +
            "WilPOS - Sistema de Punto de Venta\n\n" +
            "\x1Bd\x01" +
            "\x1B@";
          const rawRes = await window.printerApi.printRaw(cmds, target.name);
          if (rawRes.success) {
            return { success: true, message: "Prueba enviada con ESC/POS" };
          }
          console.warn("ESC/POS falló, usando HTML");
        } catch (rawErr) {
          console.error("Error ESC/POS:", rawErr);
        }
      }

      // Fallback HTML
      console.log("Probando con método de impresión HTML");
      const width = target.name?.toLowerCase().includes('58mm') ? '58mm' : '80mm';
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Prueba de Impresora</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 10mm; max-width: ${width}; margin: 0 auto; }
            .title { font-size: 14pt; font-weight: bold; margin-bottom: 5mm; }
            .content { font-size: 10pt; margin-bottom: 5mm; }
            .footer { margin-top: 10mm; font-size: 8pt; border-top: 1px dashed #000; padding-top: 2mm; }
          </style>
        </head>
        <body>
          <div class="title">PRUEBA DE IMPRESORA</div>
          <div class="content">
            <p>Verifica si su impresora funciona correctamente.</p>
            <p>Impresora: ${target.name}</p>
            <p>Tipo: ${isThermal ? 'Térmica' : 'Estándar'}</p>
            <p>Fecha: ${new Date().toLocaleString()}</p>
          </div>
          <div class="footer">WilPOS - Sistema de Punto de Venta</div>
        </body>
        </html>`;
      const result = await this.print({
        html,
        printerName: target.name,
        silent: true,
        options: { thermalPrinter: isThermal, width }
      });

      return result.success
        ? { success: true, message: `Prueba enviada: ${target.name}` }
        : { success: false, message: `Error: ${result.error || 'desconocido'}` };
    } catch (error) {
      console.error("Error probando impresora:", error);
      return {
        success: false,
        message: `Error probando impresora: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Imprime comandos ESC/POS directamente en la impresora
   */
  async printRaw(commands: string, printerName?: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`Enviando comandos directos a impresora: ${printerName || 'Predeterminada'}`);
      if (window.printerApi?.printRaw) {
        return await window.printerApi.printRaw(commands, printerName);
      }
      throw new Error("API de impresión RAW no disponible");
    } catch (error) {
      console.error("Error con impresión directa:", error);
      return {
        success: false,
        message: `Impresión directa falló: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Determina si una impresora es térmica por su nombre
   */
  private isThermalPrinter(name?: string): boolean {
    if (!name) return false;
    const lower = name.toLowerCase();
    const patterns = [
      'thermal','receipt','pos','58mm','80mm','tm-','tmt','epson',
      'bixolon','citizen','star','rongta','xprinter','zjiang',
      'gprinter','xp-','tsp','cbt','ticket','escpos'
    ];
    return patterns.some(p => lower.includes(p));
  }
}

export default PrinterService;