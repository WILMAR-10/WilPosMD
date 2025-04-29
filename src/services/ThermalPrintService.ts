// src/services/ThermalPrintService.ts
import PrinterService from './PrinterService'

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
  private printerService: PrinterService

  private constructor() {
    this.printerService = PrinterService.getInstance()
    this.loadSettings()
    console.log("ThermalPrintService initialized")
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

        if (settings.tipo_impresora === 'termica58') {
          this.paperSize = ThermalPaperSize.PAPER_58MM
          console.log("Set paper size to 58mm based on settings")
        } else if (settings.tipo_impresora === 'termica' || settings.tipo_impresora === 'termica80') {
          this.paperSize = ThermalPaperSize.PAPER_80MM
          console.log("Set paper size to 80mm based on settings")
        }
        console.log(`Loaded printer settings – Name: "${this.printerName}", Size: ${this.paperSize}`)
      }
    } catch (e) {
      console.error('Error loading thermal printer settings:', e)
    }
  }

  public async checkPrinterStatus(): Promise<{ available: boolean; printerName?: string; message?: string }> {
    console.log("Checking printer status…")
    try {
      const result = await this.printerService.getPrinters()
      console.log(`Found ${Array.isArray(result.printers) ? result.printers.length : 0} printers`)

      if (this.printerName) {
        console.log(`Looking for configured printer: "${this.printerName}"`)
        const exactMatch = result.printers.find(p => p.name === this.printerName)
        if (exactMatch) {
          console.log("Found exact match for configured printer")
          return {
            available: true,
            printerName: this.printerName,
            message: `Configured printer "${this.printerName}" is available`
          }
        }
        const partialMatch = result.printers.find(p =>
          p.name.toLowerCase().includes(this.printerName!.toLowerCase()) ||
          this.printerName!.toLowerCase().includes(p.name.toLowerCase())
        )
        if (partialMatch) {
          console.log(`Found partial match: "${partialMatch.name}"`)
          return {
            available: true,
            printerName: partialMatch.name,
            message: `Found similar printer "${partialMatch.name}" for configured "${this.printerName}"`
          }
        }
        console.log("Configured printer not found")
        return { available: false, message: `Configured printer "${this.printerName}" not found` }
      }

      console.log("No configured printer, looking for thermal printers")
      const thermal = result.printers.find(p => p.isThermal)
      if (thermal) {
        console.log(`Detected thermal printer: "${thermal.name}"`)
        this.printerName = thermal.name
        return {
          available: true,
          printerName: thermal.name,
          message: `Detected thermal printer "${thermal.name}"`
        }
      }

      console.log("No thermal found, using default if available")
      const def = result.printers.find(p => p.isDefault)
      if (def) {
        console.log(`Using default printer: "${def.name}"`)
        return {
          available: true,
          printerName: def.name,
          message: `Using default printer "${def.name}"`
        }
      }

      console.log("No printers detected")
      return { available: false, message: 'No printers detected' }
    } catch (e) {
      console.error('Error checking printer status:', e)
      return {
        available: false,
        message: `Error checking printer: ${e instanceof Error ? e.message : 'Unknown error'}`
      }
    }
  }

  public async getAllPrinters(): Promise<{ printers: any[] }> {
    try {
      const result = await this.printerService.getPrinters()
      return result && Array.isArray(result.printers)
        ? result
        : { printers: [] }
    } catch (error) {
      console.error('Error getting printers:', error)
      return { printers: [] }
    }
  }

  private generateThermalReceiptHTML(sale: any): string {
    const contentWidth = this.paperSize === ThermalPaperSize.PAPER_58MM ? '48mm' : '72mm'
    try {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura ${sale.id || ''}</title>
          <style>
            @page { margin:0; size:${this.paperSize} auto; }
            body { font-family:Arial,sans-serif; width:${contentWidth}; padding:3mm; margin:0; font-size:10pt; line-height:1.2; }
            .header { text-align:center; margin-bottom:5mm; }
            .company { font-size:12pt; font-weight:bold; margin-bottom:2mm; }
            .title { font-size:10pt; font-weight:bold; text-align:center;
                     border-top:1px dashed#000; border-bottom:1px dashed#000;
                     padding:2mm 0; margin:2mm 0; }
            table { width:100%; border-collapse:collapse; }
            th,td { text-align:left; font-size:9pt; padding:1mm; }
            .right { text-align:right; }
            .total-line { display:flex; justify-content:space-between; font-size:9pt; margin:1mm 0; }
            .grand-total { font-weight:bold; font-size:11pt; border-top:1px solid#000;
                           padding-top:2mm; margin-top:2mm; }
            .footer { text-align:center; font-size:8pt; margin-top:5mm;
                      border-top:1px dashed#000; padding-top:2mm; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company">WILPOS</div>
            <div class="invoice-id">Factura #${sale.id || 'N/A'}</div>
            <div>Fecha: ${new Date(sale.fecha_venta).toLocaleDateString()}</div>
            <div>Cliente: ${sale.cliente || 'Cliente General'}</div>
          </div>
          <div class="title">DETALLES DE VENTA</div>
          <table>
            <tr>
              <th>CANT</th><th>DESCRIPCIÓN</th><th class="right">PRECIO</th><th class="right">TOTAL</th>
            </tr>
            ${sale.detalles.map((item: any) => `
              <tr>
                <td>${item.quantity}</td>
                <td>${item.name.substring(0,15)}${item.name.length>15?'...':''}</td>
                <td class="right">RD$${item.price.toFixed(2)}</td>
                <td class="right">RD$${item.subtotal.toFixed(2)}</td>
              </tr>
            `).join('')}
          </table>
          <div class="total-line"><span>Subtotal:</span><span>RD$${(sale.total - sale.impuestos).toFixed(2)}</span></div>
          <div class="total-line"><span>Impuestos:</span><span>RD$${sale.impuestos.toFixed(2)}</span></div>
          ${sale.descuento > 0 ? `<div class="total-line"><span>Descuento:</span><span>-RD$${sale.descuento.toFixed(2)}</span></div>` : ''}
          <div class="grand-total"><span>TOTAL:</span><span>RD$${sale.total.toFixed(2)}</span></div>
          ${sale.metodo_pago === 'Efectivo'
            ? `<div class="total-line"><span>Recibido:</span><span>RD$${sale.monto_recibido.toFixed(2)}</span></div>
               <div class="total-line"><span>Cambio:</span><span>RD$${sale.cambio.toFixed(2)}</span></div>`
            : `<div class="total-line"><span>Método:</span><span>${sale.metodo_pago}</span></div>`}
          <div class="footer">
            <p>Gracias por su compra</p>
            <p>WILPOS - Sistema de Punto de Venta</p>
            <p>${new Date().toLocaleString()}</p>
          </div>
        </body>
        </html>`
    } catch (error) {
      console.error('Error generating thermal receipt HTML:', error)
      return `
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"><title>Factura</title></head>
        <body><h2>Factura #${sale.id||'N/A'}</h2>
        <p>Total: RD$${sale.total.toFixed(2)}</p><p>Gracias!</p></body></html>`
    }
  }

  public async printReceipt(sale: any): Promise<PrintResult> {
    try {
      const html = this.generateThermalReceiptHTML(sale)
      const opts = {
        html,
        printerName: this.printerName,
        silent: true,
        options: { thermalPrinter: true, width: this.paperSize }
      }
      const res = await this.printerService.print(opts)
      if (!res.success) throw new Error(res.error || 'Error printing')
      return { success: true, message: 'Print sent to thermal printer' }
    } catch (error) {
      console.error('Error printing receipt:', error)
      return {
        success: false,
        message: `Error printing: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  public async testPrinter(): Promise<PrintResult> {
    try {
      return await this.printerService.testPrinter(this.printerName)
    } catch (error) {
      console.error('Error testing printer:', error)
      return {
        success: false,
        message: `Error testing printer: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }
}

export default ThermalPrintService