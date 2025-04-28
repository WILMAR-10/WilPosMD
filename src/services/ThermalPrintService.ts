// src/services/ThermalPrintService.ts
import PrinterService from './PrinterService'
import { PreviewSale } from '../types/sales'

export enum ThermalPaperSize {
  PAPER_80MM = '80mm',
  PAPER_58MM = '58mm'
}

export interface PrintResult {
  success: boolean
  message?: string
}

export class ThermalPrintService {
  private static instance: ThermalPrintService
  private printerName?: string
  private paperSize: ThermalPaperSize = ThermalPaperSize.PAPER_80MM
  private printerService = PrinterService.getInstance()

  private constructor() {
    this.loadSettings()
  }

  public static getInstance(): ThermalPrintService {
    if (!ThermalPrintService.instance) {
      ThermalPrintService.instance = new ThermalPrintService()
    }
    return ThermalPrintService.instance
  }

  private async loadSettings(): Promise<void> {
    try {
      if (window.api?.getSettings) {
        const settings = await window.api.getSettings()
        this.printerName = settings.impresora_termica || undefined
        this.paperSize =
          settings.tipo_impresora === 'termica58'
            ? ThermalPaperSize.PAPER_58MM
            : ThermalPaperSize.PAPER_80MM
      }
    } catch (e) {
      console.error('Error loading thermal printer settings:', e)
    }
  }

  public async checkPrinterStatus(): Promise<{ available: boolean; printerName?: string; message?: string }> {
    try {
      const { printers } = await this.printerService.getPrinters()
      if (this.printerName) {
        const found = printers.find(p => p.name === this.printerName)
        if (found) {
          return { available: true, printerName: this.printerName, message: `Configured printer "${this.printerName}" available` }
        }
        return { available: false, message: `Configured printer "${this.printerName}" not found` }
      }
      const thermal = printers.find(p => this.isThermalPrinter(p.name))
      if (thermal) {
        this.printerName = thermal.name
        return { available: true, printerName: thermal.name, message: `Detected thermal printer "${thermal.name}"` }
      }
      const def = printers.find(p => p.isDefault)
      if (def) {
        return { available: true, printerName: def.name, message: `Using default printer "${def.name}"` }
      }
      return { available: false, message: 'No printers detected' }
    } catch (e) {
      console.error('Error checking printer status:', e)
      return { available: false, message: `Error: ${e instanceof Error ? e.message : 'Unknown'}` }
    }
  }

  public async getAllPrinters(): Promise<{ printers: any[] }> {
    return this.printerService.getPrinters()
  }

  private isThermalPrinter(name: string): boolean {
    const n = name.toLowerCase()
    return ['thermal', 'receipt', 'pos', '80mm', '58mm'].some(k => n.includes(k))
  }

  private generateThermalReceiptHTML(sale: PreviewSale): string {
    const width = this.paperSize === ThermalPaperSize.PAPER_58MM ? '48mm' : '72mm'
    try {
      return `
        <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${sale.id}</title>
        <style>@page{margin:0;size:${this.paperSize}}body{font:10pt Arial;width:${width};padding:3mm;}
        .header{text-align:center;margin-bottom:5mm}.company{font-weight:bold;margin-bottom:2mm}
        .title{font-weight:bold;text-align:center;border-top:1px dashed#000;border-bottom:1px dashed#000;padding:2mm 0;margin:2mm 0}
        table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:1mm;font-size:9pt}
        .right{text-align:right}.total-line{display:flex;justify-content:space-between;font-size:9pt;margin:1mm 0}
        .grand-total{font-weight:bold;font-size:11pt;border-top:1px solid#000;padding-top:2mm;margin-top:2mm}
        .footer{text-align:center;font-size:8pt;border-top:1px dashed#000;padding-top:2mm;margin-top:5mm}
        </style></head><body>
          <div class="header">
            <div class="company">WILPOS</div>
            <div>Invoice #${sale.id}</div>
            <div>Date: ${new Date(sale.fecha_venta).toLocaleDateString()}</div>
            <div>Client: ${sale.cliente || 'General'}</div>
          </div>
          <div class="title">SALE DETAILS</div>
          <table>
            <tr><th>QTY</th><th>DESC</th><th class="right">PRICE</th><th class="right">TOTAL</th></tr>
            ${sale.detalles
              .map(
                i => `<tr>
                  <td>${i.quantity}</td>
                  <td>${i.name.slice(0, 15)}${i.name.length > 15 ? '...' : ''}</td>
                  <td class="right">RD$${i.price.toFixed(2)}</td>
                  <td class="right">RD$${i.subtotal.toFixed(2)}</td>
                </tr>`
              )
              .join('')}
          </table>
          <div class="total-line"><span>Subtotal:</span><span>RD$${(sale.total - sale.impuestos).toFixed(2)}</span></div>
          <div class="total-line"><span>Tax:</span><span>RD$${sale.impuestos.toFixed(2)}</span></div>
          ${
            sale.descuento > 0
              ? `<div class="total-line"><span>Discount:</span><span>-RD$${sale.descuento.toFixed(2)}</span></div>`
              : ''
          }
          <div class="grand-total"><span>TOTAL:</span><span>RD$${sale.total.toFixed(2)}</span></div>
          ${
            sale.metodo_pago === 'Efectivo'
              ? `<div class="total-line"><span>Received:</span><span>RD$${sale.monto_recibido.toFixed(2)}</span></div>
                 <div class="total-line"><span>Change:</span><span>RD$${sale.cambio.toFixed(2)}</span></div>`
              : `<div class="total-line"><span>Method:</span><span>${sale.metodo_pago}</span></div>`
          }
          <div class="footer">
            <p>Thank you for your purchase</p>
            <p>WILPOS - POS System</p>
            <p>${new Date().toLocaleString()}</p>
          </div>
        </body></html>`
    } catch {
      return `
        <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice</title></head><body>
        <h2>Invoice #${sale.id}</h2><p>Total: RD$${sale.total.toFixed(2)}</p><p>Thank you!</p>
        </body></html>`
    }
  }

  public async printReceipt(sale: PreviewSale): Promise<PrintResult> {
    try {
      const html = this.generateThermalReceiptHTML(sale)
      const opts = {
        html,
        printerName: this.printerName,
        silent: true,
        options: { thermalPrinter: true, pageSize: this.paperSize }
      }
      const res = await this.printerService.print(opts)
      if (!res.success) throw new Error(res.error || 'Print failed')
      return { success: true, message: 'Print sent to thermal printer' }
    } catch (e) {
      console.error('Error printing receipt:', e)
      return { success: false, message: `Error: ${e instanceof Error ? e.message : 'Unknown'}` }
    }
  }

  public async testPrinter(): Promise<PrintResult> {
    try {
      return this.printerService.testPrinter(this.printerName)
    } catch (e) {
      console.error('Error testing printer:', e)
      return { success: false, message: `Error: ${e instanceof Error ? e.message : 'Unknown'}` }
    }
  }
}

export default ThermalPrintService