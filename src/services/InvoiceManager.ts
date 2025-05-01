import type { PreviewSale } from "../types/sales"
import ThermalPrintService from "./ThermalPrintService"

// Interfaz para opciones de impresión
export interface PrintOptions {
  silent?: boolean
  printerName?: string
  copies?: number
}

// Interfaz para opciones de PDF
export interface SavePdfOptions {
  directory: string
  filename?: string
  overwrite?: boolean
}

/**
 * Servicio unificado para manejo de facturas, impresión y PDF
 * Actúa como fachada (patrón Facade) para servicios subyacentes
 */
export class InvoiceManager {
  private static instance: InvoiceManager
  private thermalPrintService: ThermalPrintService

  // Constructor privado
  private constructor() {
    this.thermalPrintService = ThermalPrintService.getInstance()
  }

  // Obtener instancia singleton
  public static getInstance(): InvoiceManager {
    if (!InvoiceManager.instance) {
      InvoiceManager.instance = new InvoiceManager()
    }
    return InvoiceManager.instance
  }

  /**
   * Imprime una factura
   * @param sale Datos de la venta
   * @param htmlContent Contenido HTML (opcional)
   * @param options Opciones de impresión
   * @returns Resultado de la operación
   */
  public async printInvoice(sale: PreviewSale, htmlContent?: string, options?: PrintOptions): Promise<boolean> {
    try {
      // Verificar si la API está disponible
      if (!window.api?.printInvoice && !window.printerApi?.print) {
        console.error("API de impresión no disponible")
        return false
      }

      // Usar ThermalPrintService para imprimir
      const result = await this.thermalPrintService.printReceipt(sale)
      return result.success
    } catch (error) {
      console.error("Error al imprimir:", error)
      return false
    }
  }

  /**
   * Guardar factura como PDF
   * @param sale Datos de la venta
   * @param htmlContent Contenido HTML
   * @param options Opciones para guardar
   * @returns Ruta del archivo PDF o null si falla
   */
  public async saveAsPdf(
    sale: PreviewSale,
    htmlContent: string,
    options?: Partial<SavePdfOptions>,
  ): Promise<string | null> {
    try {
      // Verificar si la API está disponible
      if (!window.api?.savePdf && !window.printerApi?.savePdf) {
        console.warn("API para guardar PDF no disponible")
        return null
      }

      // Cargar configuración si es necesario
      let saveDirectory = options?.directory || ""
      if (!saveDirectory && window.api?.getSettings) {
        const settings = await window.api.getSettings()
        saveDirectory = settings?.ruta_pdf || ""

        if (!saveDirectory && window.api.getAppPaths) {
          const paths = await window.api.getAppPaths()
          // Usar la carpeta "informe" dentro de WilPOS
          saveDirectory = `${paths.documents}/WilPOS/informe`
        }
      }

      // Generar nombre de archivo si no se proporciona
      const filename = options?.filename || `factura-${sale.id || "temp"}-${new Date().toISOString().split("T")[0]}.pdf`

      // Ruta completa
      const filePath = `${saveDirectory}/${filename}`

      // Guardar PDF
      let result
      if (window.printerApi?.savePdf) {
        result = await window.printerApi.savePdf({
          html: htmlContent,
          path: filePath,
          options: { printBackground: true },
        })
      } else if (window.api?.savePdf) {
        result = await window.api.savePdf({
          html: htmlContent,
          path: filePath,
          options: { printBackground: true },
        })
      }

      if (!result?.success) {
        throw new Error(result?.error || "Error al guardar PDF")
      }

      return result.path || filePath
    } catch (error) {
      console.error("Error al guardar como PDF:", error)
      return null
    }
  }

  /**
   * Generar HTML para impresora térmica
   * @param sale Datos de la venta
   * @returns HTML formateado
   */
  public generateThermalPrintHTML(sale: PreviewSale): string {
    try {
      // Esta función genera un HTML básico para facturas térmicas
      // Si estás usando FacturaViewer para el HTML, deberías modificar esto
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura ${sale.id || "Temporal"}</title>
          <style>
            @page {
              margin: 0;
              size: 80mm auto;
            }
            body {
              font-family: 'Arial', 'Helvetica', sans-serif;
              margin: 0;
              padding: 5mm;
              width: 70mm;
              font-size: 10pt;
              line-height: 1.2;
            }
            .header {
              text-align: center;
              margin-bottom: 3mm;
            }
            .company {
              font-size: 12pt;
              font-weight: bold;
              margin-bottom: 1mm;
            }
            .invoice-id {
              font-size: 10pt;
              font-weight: bold;
              margin-bottom: 1mm;
            }
            .section {
              margin: 3mm 0;
              padding: 2mm 0;
              border-top: 1px dashed #000;
              border-bottom: 1px dashed #000;
              text-align: center;
              font-weight: bold;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 3mm 0;
            }
            th, td {
              text-align: left;
              padding: 1mm;
              font-size: 9pt;
            }
            th {
              font-weight: bold;
            }
            .right {
              text-align: right;
            }
            .center {
              text-align: center;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin: 1mm 0;
            }
            .grand-total {
              font-weight: bold;
              font-size: 12pt;
              margin: 2mm 0;
              border-top: 1px solid #000;
              padding-top: 2mm;
            }
            .footer {
              text-align: center;
              font-size: 9pt;
              margin-top: 5mm;
              border-top: 1px dashed #000;
              padding-top: 2mm;
            }
          </style>
        </head>
        <body>
          <!-- Header Section -->
          <div class="header">
            <div class="company">WILPOS</div>
            <div class="invoice-id">Factura #${sale.id || "N/A"}</div>
            <div>Fecha: ${new Date(sale.fecha_venta).toLocaleString()}</div>
            <div>Cliente: ${sale.cliente || "Cliente General"}</div>
          </div>

          <!-- Items Section -->
          <div class="section">DETALLE DE VENTA</div>
          <table>
            <tr>
              <th>CANT</th>
              <th>DESCRIPCIÓN</th>
              <th class="right">PRECIO</th>
              <th class="right">TOTAL</th>
            </tr>
            ${sale.detalles
              .map(
                (item) => `
              <tr>
                <td>${item.quantity}</td>
                <td>${item.name.substring(0, 18)}${item.name.length > 18 ? "..." : ""}</td>
                <td class="right">${this.formatCurrency(item.price)}</td>
                <td class="right">${this.formatCurrency(item.subtotal)}</td>
              </tr>
            `,
              )
              .join("")}
          </table>

          <!-- Totals -->
          <div>
            <div class="total-row">
              <span>Subtotal:</span>
              <span>${this.formatCurrency(sale.total - sale.impuestos)}</span>
            </div>
            
            ${
              sale.impuestos > 0
                ? `
              <div class="total-row">
                <span>Impuestos:</span>
                <span>${this.formatCurrency(sale.impuestos)}</span>
              </div>
            `
                : ""
            }
            
            ${
              sale.descuento > 0
                ? `
              <div class="total-row">
                <span>Descuento:</span>
                <span>-${this.formatCurrency(sale.descuento)}</span>
              </div>
            `
                : ""
            }
            
            <div class="grand-total">
              <span>TOTAL:</span>
              <span>${this.formatCurrency(sale.total)}</span>
            </div>

            <!-- Payment Information -->
            ${
              sale.metodo_pago === "Efectivo"
                ? `
              <div class="total-row">
                <span>Recibido:</span>
                <span>${this.formatCurrency(sale.monto_recibido)}</span>
              </div>
              <div class="total-row">
                <span>Cambio:</span>
                <span>${this.formatCurrency(sale.cambio)}</span>
              </div>
            `
                : `
              <div class="total-row">
                <span>Método de pago:</span>
                <span>${sale.metodo_pago}</span>
              </div>
            `
            }
          </div>

          <!-- Footer Section -->
          <div class="footer">
            <p>Gracias por su compra</p>
            <p>WILPOS - Sistema de Punto de Venta</p>
            <p>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
          </div>
        </body>
        </html>
      `
    } catch (error) {
      console.error("Error generating thermal print HTML:", error)
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura Simplificada</title>
          <style>
            body { font-family: Arial; padding: 10mm; }
          </style>
        </head>
        <body>
          <h2>Factura #${sale?.id || "N/A"}</h2>
          <p>Fecha: ${new Date().toLocaleString()}</p>
          <p>Total: ${this.formatCurrency(sale?.total || 0)}</p>
          <p>Gracias por su compra</p>
          <p>WILPOS - Sistema de Punto de Venta</p>
        </body>
        </html>
      `
    }
  }

  /**
   * Genera contenido HTML para impresión estándar
   * @param sale Datos de la venta
   * @returns HTML formateado
   */
  public generatePrintHTML(sale: PreviewSale): string {
    try {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura ${sale.id || "Temporal"}</title>
          <style>
            @page {
              margin: 10mm;
              size: A4;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
            }
            .invoice-container {
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .invoice-title {
              font-size: 18px;
              margin: 15px 0;
              text-align: center;
              font-weight: bold;
            }
            .invoice-details {
              display: flex;
              justify-content: space-between;
              margin-bottom: 20px;
            }
            .invoice-details div {
              margin-bottom: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            table th, table td {
              padding: 8px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            table th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            .totals {
              margin-top: 20px;
              text-align: right;
            }
            .totals div {
              margin-bottom: 5px;
            }
            .total-line {
              font-weight: bold;
              font-size: 16px;
              border-top: 2px solid #000;
              padding-top: 5px;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header">
              <div class="company-name">WILPOS</div>
              <div>Sistema de Punto de Venta</div>
            </div>
            
            <div class="invoice-title">FACTURA #${sale.id || "N/A"}</div>
            
            <div class="invoice-details">
              <div>
                <div><strong>Fecha:</strong> ${new Date(sale.fecha_venta).toLocaleString()}</div>
                <div><strong>Cliente:</strong> ${sale.cliente || "Cliente General"}</div>
              </div>
              <div>
                <div><strong>Método de pago:</strong> ${sale.metodo_pago}</div>
                <div><strong>Estado:</strong> ${sale.estado || "Completada"}</div>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>ITBIS</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${sale.detalles
                  .map(
                    (item) => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>${this.formatCurrency(item.price)}</td>
                    <td>${item.is_exempt ? "Exento" : (item.itebis * 100).toFixed(0) + "%"}</td>
                    <td>${this.formatCurrency(item.subtotal)}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
            
            <div class="totals">
              <div><strong>Subtotal:</strong> ${this.formatCurrency(sale.total - sale.impuestos)}</div>
              <div><strong>ITBIS:</strong> ${this.formatCurrency(sale.impuestos)}</div>
              ${sale.descuento > 0 ? `<div><strong>Descuento:</strong> -${this.formatCurrency(sale.descuento)}</div>` : ""}
              <div class="total-line"><strong>TOTAL:</strong> ${this.formatCurrency(sale.total)}</div>
              
              ${
                sale.metodo_pago === "Efectivo"
                  ? `
                <div><strong>Monto recibido:</strong> ${this.formatCurrency(sale.monto_recibido)}</div>
                <div><strong>Cambio:</strong> ${this.formatCurrency(sale.cambio)}</div>
              `
                  : ""
              }
            </div>
            
            <div class="footer">
              <p>Gracias por su compra</p>
              <p>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        </body>
        </html>
      `
    } catch (error) {
      console.error("Error generating print HTML:", error)
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura Simplificada</title>
          <style>
            body { font-family: Arial; padding: 20px; }
          </style>
        </head>
        <body>
          <h2>Factura #${sale?.id || "N/A"}</h2>
          <p>Fecha: ${new Date().toLocaleString()}</p>
          <p>Total: ${this.formatCurrency(sale?.total || 0)}</p>
          <p>Gracias por su compra</p>
        </body>
        </html>
      `
    }
  }

  /**
   * Formatea valores monetarios
   * @param amount Cantidad a formatear
   * @returns Cadena formateada
   */
  private formatCurrency(amount: number): string {
    try {
      // Formatear usando Intl.NumberFormat
      return new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: "DOP",
        minimumFractionDigits: 2,
      }).format(amount)
    } catch (error) {
      // Formato alternativo en caso de error
      return `RD$ ${amount.toFixed(2)}`
    }
  }
}

export default InvoiceManager