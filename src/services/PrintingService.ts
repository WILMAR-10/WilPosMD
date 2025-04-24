import { PreviewSale } from '../types/sales';
import { PrinterInfo, PrinterType, PrintOptions, SavePdfOptions } from '../types/electron';

export class PrintingService {
  private static _instance: PrintingService;
  private printerType = PrinterType.STANDARD;
  private printerName?: string;
  private savePdfEnabled = true;
  private pdfSavePath = '';

  private constructor() {
    this.loadSettings();
  }

  public static getInstance() {
    if (!this._instance) this._instance = new PrintingService();
    return this._instance;
  }

  private async loadSettings() {
    try {
      if (window.api?.getSettings) {
        const cfg = await window.api.getSettings();
        this.printerName = cfg.impresora_termica || undefined;
        this.printerType = (cfg.tipo_impresora as PrinterType) || PrinterType.STANDARD;
        this.savePdfEnabled = cfg.guardar_pdf !== false;
        this.pdfSavePath = cfg.ruta_pdf || '';
      }
    } catch (e) {
      console.error('Error loading print settings:', e);
    }
  }

  public async getAvailablePrinters(): Promise<PrinterInfo[]> {
    try {
      const res = await window.printerApi.getPrinters();
      if (!res.success) throw new Error(res.error);
      return res.printers.map(p => ({
        ...p,
        isThermal: this.isThermalPrinter(p.name),
      }));
    } catch (e) {
      console.warn('Could not fetch printers:', e);
      return [];
    }
  }

  public async checkPrinterStatus(): Promise<{ available: boolean; printerName?: string; message: string }> {
    const list = await this.getAvailablePrinters();
    // configured
    if (this.printerName) {
      const found = list.find(p => p.name === this.printerName);
      if (found) return { available: true, printerName: this.printerName, message: `Using configured printer "${this.printerName}"` };
      return { available: false, message: `Configured "${this.printerName}" not found` };
    }
    // auto‑detect thermal
    const therm = list.find(p => p.isThermal);
    if (therm) {
      this.printerName = therm.name;
      return { available: true, printerName: therm.name, message: `Detected thermal printer "${therm.name}"` };
    }
    // fallback default
    const def = list.find(p => p.isDefault);
    if (def) {
      this.printerName = def.name;
      return { available: true, printerName: def.name, message: `Using default printer "${def.name}"` };
    }
    return { available: false, message: 'No printers found' };
  }

  private isThermalPrinter(name: string) {
    const n = name.toLowerCase();
    return ['thermal','receipt','pos','80mm','58mm'].some(t => n.includes(t));
  }

  private generateThermalHTML(sale: PreviewSale): string {
    const width = this.printerType === PrinterType.THERMAL_58MM ? '48mm' : '72mm';
    const size = this.printerType === PrinterType.THERMAL_58MM ? '58mm' : '80mm';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      @page{margin:0;size:${size}}
      body{font-family:Arial,sans-serif;width:${width};padding:5mm;margin:0}
      table{width:100%;border-collapse:collapse}
      th,td{font-size:10pt;padding:2px;text-align:left}
      .right{text-align:right}
      .total{font-weight:bold;border-top:1px solid #000;margin-top:4mm;padding-top:2mm}
    </style></head><body>
      <div style="text-align:center">
        <h2>Factura #${sale.id}</h2>
        <p>${new Date(sale.fecha_venta).toLocaleString()}</p>
      </div>
      <table>
        <tr><th>Cant</th><th>Descr.</th><th class="right">Total</th></tr>
        ${sale.detalles.map(i=>`<tr>
          <td>${i.quantity}</td>
          <td>${i.name}</td>
          <td class="right">${i.subtotal.toFixed(2)}</td>
        </tr>`).join('')}
      </table>
      <div class="total">Total: ${sale.total.toFixed(2)}</div>
    </body></html>`;
  }

  private generateStandardHTML(sale: PreviewSale): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      @page{margin:10mm;size:A4}
      body{font-family:Arial,sans-serif;margin:0;padding:0}
      .cont{max-width:800px;margin:0 auto;padding:20px}
      h1{text-align:center}
      table{width:100%;border-collapse:collapse;margin-top:20px}
      th,td{border:1px solid #ddd;padding:8px}
      th{background:#f4f4f4}
      .tot{text-align:right;margin-top:20px}
      .footer{text-align:center;margin-top:40px;font-size:12px;color:#666}
    </style></head><body><div class="cont">
      <h1>Factura #${sale.id}</h1>
      <p>Fecha: ${new Date(sale.fecha_venta).toLocaleString()}</p>
      <table>
        <thead><tr>
          <th>Producto</th><th>Cant</th><th>Precio</th><th>Subtotal</th>
        </tr></thead>
        <tbody>
          ${sale.detalles.map(i=>`<tr>
            <td>${i.name}</td>
            <td>${i.quantity}</td>
            <td>${i.price.toFixed(2)}</td>
            <td>${i.subtotal.toFixed(2)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="tot"><strong>Total: ${sale.total.toFixed(2)}</strong></div>
      <div class="footer"><p>Gracias por su compra</p></div>
    </div></body></html>`;
  }

  public async printInvoice(
    sale: PreviewSale,
    opts: PrintOptions = {}
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const isThermal = this.printerType !== PrinterType.STANDARD;
      const html = isThermal
        ? this.generateThermalHTML(sale)
        : this.generateStandardHTML(sale);
      const job = {
        html,
        printerName: opts.printerName || this.printerName,
        silent: opts.silent !== false,
        copies: opts.copies || 1,
        options: { thermalPrinter: isThermal, pageSize: isThermal ? this.printerType : 'A4' }
      };
      const res = await window.printerApi.print(job);
      if (!res.success) throw new Error(res.error);
      if (this.savePdfEnabled) {
        await this.saveAsPdf(sale, html, { directory: this.pdfSavePath });
      }
      return { success: true };
    } catch (e) {
      console.error('Print failed:', e);
      return { success: false, message: e instanceof Error ? e.message : String(e) };
    }
  }

  public async saveAsPdf(
    sale: PreviewSale,
    html: string,
    opts: SavePdfOptions
  ): Promise<string | null> {
    try {
      const filename =
        opts.filename ||
        `factura-${sale.id}-${new Date().toISOString().split('T')[0]}.pdf`;
      const fullPath = `${opts.directory}/${filename}`;
      const res = await window.printerApi.savePdf({
        html,
        path: fullPath,
        options: { printBackground: true, margins: { top: 5, bottom: 5, left: 5, right: 5 }, pageSize: 'A4' }
      });
      if (!res.success) throw new Error(res.error);
      return res.path || fullPath;
    } catch (e) {
      console.error('PDF save failed:', e);
      return null;
    }
  }
}