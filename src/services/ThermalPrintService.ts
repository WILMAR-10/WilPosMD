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
  private usbPrinterDetected: boolean = false
  private serialPortDetected: boolean = false

  private constructor() {
    this.printerService = PrinterService.getInstance()
    this.loadSettings()
    console.log("ThermalPrintService inicializado")
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
          console.log("Configurado tamaño de papel a 58mm según configuración")
        } else if (settings.tipo_impresora === 'termica' || settings.tipo_impresora === 'termica80') {
          this.paperSize = ThermalPaperSize.PAPER_80MM
          console.log("Configurado tamaño de papel a 80mm según configuración")
        }
        console.log(`Configuración de impresora cargada – Nombre: "${this.printerName}", Tamaño: ${this.paperSize}`)
      }
    } catch (e) {
      console.error('Error cargando configuración de impresora térmica:', e)
    }
  }

  public async checkPrinterStatus(): Promise<{ available: boolean; printerName?: string; message?: string }> {
    console.log("Verificando estado de impresora...")
    try {
      const result = await this.printerService.getPrinters()
      console.log(`Encontradas ${Array.isArray(result.printers) ? result.printers.length : 0} impresoras`)

      // 1) USB o serie
      const usbOrSerial = result.printers.filter(p =>
        ['usb-windows','usb-linux','usb-macos','serial'].includes(p.source)
      )
      if (usbOrSerial.length > 0) {
        const dev = usbOrSerial[0]
        this.usbPrinterDetected = true
        this.printerName = dev.name
        return {
          available: true,
          printerName: dev.name,
          message: `Detectada impresora USB/Serie: "${dev.name}"`
        }
      }

      // 2) Impresora configurada exactamente
      if (this.printerName) {
        console.log(`Buscando impresora configurada: "${this.printerName}"`)
        const exact = result.printers.find(p => p.name === this.printerName)
        if (exact) {
          return {
            available: true,
            printerName: this.printerName,
            message: `Impresora configurada "${this.printerName}" disponible`
          }
        }
        const partial = result.printers.find(p =>
          p.name.toLowerCase().includes(this.printerName!.toLowerCase()) ||
          this.printerName!.toLowerCase().includes(p.name.toLowerCase())
        )
        if (partial) {
          return {
            available: true,
            printerName: partial.name,
            message: `Encontrada impresora similar "${partial.name}" para configurada "${this.printerName}"`
          }
        }
        return { available: false, message: `Impresora configurada "${this.printerName}" no encontrada` }
      }

      // 3) Primera térmica
      const thermal = result.printers.find(p => p.isThermal)
      if (thermal) {
        this.printerName = thermal.name
        return {
          available: true,
          printerName: thermal.name,
          message: `Detectada impresora térmica "${thermal.name}"`
        }
      }

      // 4) Default
      const def = result.printers.find(p => p.isDefault)
      if (def) {
        return {
          available: true,
          printerName: def.name,
          message: `Usando impresora predeterminada "${def.name}"`
        }
      }

      return { available: false, message: 'No se detectaron impresoras' }
    } catch (e) {
      console.error('Error verificando estado de impresora:', e)
      return {
        available: false,
        message: `Error verificando impresora: ${e instanceof Error ? e.message : 'Error desconocido'}`
      }
    }
  }

  public async getAllPrinters(): Promise<{ printers: any[] }> {
    try {
      const result = await this.printerService.getPrinters()
      return Array.isArray(result.printers) ? result : { printers: [] }
    } catch (error) {
      console.error('Error obteniendo impresoras:', error)
      return { printers: [] }
    }
  }

  private generateThermalReceiptHTML(sale: any): string {
    const contentWidth = this.paperSize === ThermalPaperSize.PAPER_58MM ? '48mm' : '72mm'
    try {
      return `
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"><title>Factura ${sale.id||''}</title>
        <style>
          @page { margin:0; size:${this.paperSize} auto; }
          body { font-family:Arial; width:${contentWidth}; padding:3mm; margin:0; font-size:10pt; }
          /* ... resto del CSS ... */
        </style>
        </head><body>
        <!-- ... contenido de recibo ... -->
        </body></html>`
    } catch (error) {
      console.error('Error generando HTML:', error)
      return `<html><body><h2>Factura #${sale.id||'N/A'}</h2><p>Total: RD$${sale.total.toFixed(2)}</p></body></html>`
    }
  }

  private generateESCPOSCommands(sale: any): string {
    try {
      const ESC = '\x1B', LF = '\x0A'
      let cmd = `${ESC}@${ESC}a\x01`  // init + center
      // ... construir comandos ESC/POS completos ...
      cmd += `${ESC}d\x04${ESC}m`    // feed & cut
      return cmd
    } catch (error) {
      console.error('Error generando ESC/POS:', error)
      return '\x1B@FACTURA\nTotal...\n\x1Bd\x04'
    }
  }

  public async printReceipt(sale: any): Promise<PrintResult> {
    try {
      const status = await this.checkPrinterStatus()
      if (!status.available || !status.printerName) {
        return { success: false, message: status.message || 'No hay impresora disponible' }
      }

      const directAvail = this.usbPrinterDetected || this.serialPortDetected
      if (directAvail && window.printerApi?.printRaw) {
        try {
          const escpos = this.generateESCPOSCommands(sale)
          const raw = await this.printerService.printRaw(escpos, status.printerName)
          if (raw.success) {
            return { success: true, message: 'Factura enviada directamente' }
          }
        } catch { /* fallback a HTML */ }
      }

      const html = this.generateThermalReceiptHTML(sale)
      const result = await this.printerService.print({
        html,
        printerName: status.printerName,
        silent: true,
        options: { thermalPrinter: true, width: this.paperSize }
      })
      if (!result.success) throw new Error(result.error || 'Error de impresión')
      return { success: true, message: 'Recibo enviado a impresora térmica' }
    } catch (error) {
      console.error('Error imprimiendo recibo:', error)
      return { success: false, message: `Error: ${error instanceof Error ? error.message : 'Desconocido'}` }
    }
  }

  public async testPrinter(): Promise<PrintResult> {
    try {
      return await this.printerService.testPrinter(this.printerName)
    } catch (error) {
      console.error('Error probando impresora:', error)
      return { success: false, message: `Error: ${error instanceof Error ? error.message : 'Desconocido'}` }
    }
  }
}

export default ThermalPrintService