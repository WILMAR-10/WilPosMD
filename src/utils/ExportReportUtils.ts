// ExportReportUtils.ts - Utilidades para exportación de informes
import type { SalesData } from "../types/reports"

/**
 * Clase de utilidad para generar HTML para informes exportables
 */
class ExportReportUtils {
  /**
   * Genera HTML para un informe de ventas completo (PDF)
   * @param startDate Fecha de inicio
   * @param endDate Fecha de fin
   * @param salesData Datos de ventas
   * @param formatCurrency Función para formatear moneda
   * @returns HTML formateado
   */
  static generateSalesReportHTML(
    startDate: Date,
    endDate: Date,
    salesData: SalesData,
    formatCurrency: (amount: number) => string,
  ): string {
    try {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Informe de Ventas ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</title>
          <style>
            @page {
              margin: 20mm;
              size: A4;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              color: #333;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #3b82f6;
              padding-bottom: 10px;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #3b82f6;
              margin-bottom: 5px;
            }
            .title {
              font-size: 20px;
              font-weight: bold;
              margin: 10px 0;
            }
            .subtitle {
              font-size: 16px;
              color: #666;
              margin-bottom: 20px;
            }
            .date-range {
              font-size: 14px;
              color: #666;
              margin-bottom: 10px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin-bottom: 30px;
            }
            .summary-card {
              background-color: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 15px;
            }
            .card-title {
              font-size: 14px;
              color: #6b7280;
              margin-bottom: 5px;
            }
            .card-value {
              font-size: 18px;
              font-weight: bold;
              color: #111827;
            }
            .card-meta {
              font-size: 12px;
              color: #6b7280;
              margin-top: 5px;
            }
            .section {
              margin-bottom: 30px;
            }
            .section-title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 15px;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th {
              background-color: #f3f4f6;
              text-align: left;
              padding: 10px;
              font-size: 14px;
              font-weight: bold;
              color: #374151;
              border-bottom: 1px solid #e5e7eb;
            }
            td {
              padding: 10px;
              border-bottom: 1px solid #e5e7eb;
              font-size: 14px;
            }
            tr:nth-child(even) {
              background-color: #f9fafb;
            }
            .text-right {
              text-align: right;
            }
            .chart-container {
              height: 200px;
              margin-bottom: 30px;
              display: flex;
              align-items: flex-end;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 10px;
            }
            .chart-bar {
              flex: 1;
              margin: 0 3px;
              background-color: #3b82f6;
              min-height: 5px;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .chart-label {
              font-size: 10px;
              color: #6b7280;
              margin-top: 5px;
              text-align: center;
              transform: rotate(-45deg);
              white-space: nowrap;
              max-width: 50px;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .footer {
              margin-top: 50px;
              text-align: center;
              font-size: 12px;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
              padding-top: 20px;
            }
            .positive {
              color: #10b981;
            }
            .negative {
              color: #ef4444;
            }
            .category-bar {
              height: 10px;
              background-color: #e5e7eb;
              border-radius: 5px;
              margin-bottom: 15px;
              position: relative;
            }
            .category-fill {
              height: 10px;
              background-color: #3b82f6;
              border-radius: 5px;
            }
            .category-label {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              margin-bottom: 5px;
            }
            .category-name {
              font-weight: bold;
            }
            .page-break {
              page-break-after: always;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header -->
            <div class="header">
              <div class="logo">WILPOS</div>
              <div class="title">Informe de Ventas</div>
              <div class="date-range">Período: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</div>
            </div>

            <!-- Summary Cards -->
            <div class="summary-grid">
              <div class="summary-card">
                <div class="card-title">Ingresos Totales</div>
                <div class="card-value">${formatCurrency(salesData.period.total)}</div>
                <div class="card-meta">
                  ${
                    salesData.period.growth >= 0
                      ? `<span class="positive">+${salesData.period.growth.toFixed(1)}%</span> vs. período anterior`
                      : `<span class="negative">${salesData.period.growth.toFixed(1)}%</span> vs. período anterior`
                  }
                </div>
              </div>
              
              <div class="summary-card">
                <div class="card-title">Valor Promedio de Ticket</div>
                <div class="card-value">${formatCurrency(salesData.period.average)}</div>
                <div class="card-meta">Promedio del período</div>
              </div>
              
              <div class="summary-card">
                <div class="card-title">Total de Transacciones</div>
                <div class="card-value">${salesData.period.count.toLocaleString()}</div>
                <div class="card-meta">Clientes atendidos</div>
              </div>
              
              <div class="summary-card">
                <div class="card-title">Ventas de Hoy</div>
                <div class="card-value">${formatCurrency(salesData.today.total)}</div>
                <div class="card-meta">${salesData.today.count} transacciones</div>
              </div>
            </div>

            <!-- Sales Trend Chart -->
            <div class="section">
              <div class="section-title">Tendencia de Ventas</div>
              ${
                salesData.byMonth.length === 0
                  ? `<p style="text-align: center; color: #6b7280;">No hay datos de ventas para mostrar</p>`
                  : `
                  <div class="chart-container">
                    ${salesData.byMonth
                      .map((month) => {
                        const maxValue = Math.max(...salesData.byMonth.map((m) => m.total), 1)
                        const height = Math.max(5, (month.total / maxValue) * 180)
                        return `
                          <div class="chart-bar" style="height: ${height}px;">
                            <div class="chart-label">${month.month}</div>
                          </div>
                        `
                      })
                      .join("")}
                  </div>
                  `
              }
            </div>

            <!-- Categories -->
            <div class="section">
              <div class="section-title">Ventas por Categoría</div>
              ${
                salesData.categories.length === 0
                  ? `<p style="text-align: center; color: #6b7280;">No hay datos de categorías para mostrar</p>`
                  : salesData.categories
                      .slice(0, 5)
                      .map(
                        (category) => `
                        <div class="category-label">
                          <span class="category-name">${category.category}</span>
                          <span>${formatCurrency(category.total)} (${category.percentage}%)</span>
                        </div>
                        <div class="category-bar">
                          <div class="category-fill" style="width: ${category.percentage}%;"></div>
                        </div>
                      `,
                      )
                      .join("")
              }
            </div>

            <!-- Top Products Table -->
            <div class="section">
              <div class="section-title">Productos Más Vendidos</div>
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Código</th>
                    <th>Cantidad</th>
                    <th class="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    salesData.topProducts.length === 0
                      ? `<tr><td colspan="4" style="text-align: center;">No hay productos vendidos en este período</td></tr>`
                      : salesData.topProducts
                          .map(
                            (product, index) => `
                            <tr>
                              <td>${product.nombre}</td>
                              <td>${product.codigo_barra || "N/A"}</td>
                              <td>${product.cantidad_vendida}</td>
                              <td class="text-right">${formatCurrency(product.total_vendido)}</td>
                            </tr>
                          `,
                          )
                          .join("")
                  }
                </tbody>
              </table>
            </div>

            <!-- Monthly Summary Table -->
            <div class="section">
              <div class="section-title">Resumen por Mes</div>
              <table>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th class="text-right">Ventas</th>
                    <th class="text-right">Transacciones</th>
                    <th class="text-right">Ticket Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    salesData.byMonth.length === 0
                      ? `<tr><td colspan="4" style="text-align: center;">No hay datos de ventas por mes en este período</td></tr>`
                      : salesData.byMonth
                          .map(
                            (month) => `
                            <tr>
                              <td>${month.month}</td>
                              <td class="text-right">${formatCurrency(month.total)}</td>
                              <td class="text-right">${month.count}</td>
                              <td class="text-right">${formatCurrency(
                                month.count > 0 ? month.total / month.count : 0,
                              )}</td>
                            </tr>
                          `,
                          )
                          .join("")
                  }
                </tbody>
              </table>
            </div>

            <!-- Footer -->
            <div class="footer">
              <p>Informe generado el ${new Date().toLocaleString()}</p>
              <p>WILPOS - Sistema de Punto de Venta</p>
            </div>
          </div>
        </body>
        </html>
      `
    } catch (error) {
      console.error("Error generating sales report HTML:", error)
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Error en Informe</title>
        </head>
        <body>
          <h1>Error al generar informe</h1>
          <p>Se produjo un error al generar el informe de ventas.</p>
          <p>Error: ${error instanceof Error ? error.message : "Error desconocido"}</p>
          <p>Fecha: ${new Date().toLocaleString()}</p>
        </body>
        </html>
      `
    }
  }

  /**
   * Genera HTML para un informe de ventas para impresión
   * @param startDate Fecha de inicio
   * @param endDate Fecha de fin
   * @param salesData Datos de ventas
   * @param formatCurrency Función para formatear moneda
   * @returns HTML formateado
   */
  static generatePrintReportHTML(
    startDate: Date,
    endDate: Date,
    salesData: SalesData,
    formatCurrency: (amount: number) => string,
  ): string {
    try {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Informe de Ventas para Impresión</title>
          <style>
            @page {
              margin: 10mm;
              size: A4;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              color: #333;
              font-size: 12px;
            }
            .container {
              max-width: 100%;
              margin: 0 auto;
              padding: 10px;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 1px solid #000;
              padding-bottom: 10px;
            }
            .logo {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .title {
              font-size: 16px;
              font-weight: bold;
              margin: 5px 0;
            }
            .date-range {
              font-size: 12px;
              margin-bottom: 5px;
            }
            .summary-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .summary-table th,
            .summary-table td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            .summary-table th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            .section {
              margin-bottom: 20px;
            }
            .section-title {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 10px;
              border-bottom: 1px solid #ddd;
              padding-bottom: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              font-size: 10px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 6px;
              text-align: left;
            }
            th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            .text-right {
              text-align: right;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 10px;
              border-top: 1px solid #ddd;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header -->
            <div class="header">
              <div class="logo">WILPOS</div>
              <div class="title">Informe de Ventas</div>
              <div class="date-range">Período: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</div>
            </div>

            <!-- Summary Table -->
            <div class="section">
              <div class="section-title">Resumen</div>
              <table class="summary-table">
                <tr>
                  <th>Concepto</th>
                  <th>Valor</th>
                </tr>
                <tr>
                  <td>Ingresos Totales</td>
                  <td>${formatCurrency(salesData.period.total)}</td>
                </tr>
                <tr>
                  <td>Transacciones</td>
                  <td>${salesData.period.count.toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Ticket Promedio</td>
                  <td>${formatCurrency(salesData.period.average)}</td>
                </tr>
                <tr>
                  <td>Crecimiento</td>
                  <td>${salesData.period.growth.toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>Ventas de Hoy</td>
                  <td>${formatCurrency(salesData.today.total)} (${salesData.today.count} transacciones)</td>
                </tr>
              </table>
            </div>

            <!-- Top Products Table -->
            <div class="section">
              <div class="section-title">Productos Más Vendidos</div>
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Código</th>
                    <th>Cantidad</th>
                    <th class="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    salesData.topProducts.length === 0
                      ? `<tr><td colspan="4" style="text-align: center;">No hay productos vendidos en este período</td></tr>`
                      : salesData.topProducts
                          .map(
                            (product) => `
                            <tr>
                              <td>${product.nombre}</td>
                              <td>${product.codigo_barra || "N/A"}</td>
                              <td>${product.cantidad_vendida}</td>
                              <td class="text-right">${formatCurrency(product.total_vendido)}</td>
                            </tr>
                          `,
                          )
                          .join("")
                  }
                </tbody>
              </table>
            </div>

            <!-- Categories Table -->
            <div class="section">
              <div class="section-title">Ventas por Categoría</div>
              <table>
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th class="text-right">Total</th>
                    <th class="text-right">Porcentaje</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    salesData.categories.length === 0
                      ? `<tr><td colspan="3" style="text-align: center;">No hay datos de categorías para mostrar</td></tr>`
                      : salesData.categories
                          .map(
                            (category) => `
                            <tr>
                              <td>${category.category}</td>
                              <td class="text-right">${formatCurrency(category.total)}</td>
                              <td class="text-right">${category.percentage}%</td>
                            </tr>
                          `,
                          )
                          .join("")
                  }
                </tbody>
              </table>
            </div>

            <!-- Monthly Summary Table -->
            <div class="section">
              <div class="section-title">Resumen por Mes</div>
              <table>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th class="text-right">Ventas</th>
                    <th class="text-right">Transacciones</th>
                    <th class="text-right">Ticket Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    salesData.byMonth.length === 0
                      ? `<tr><td colspan="4" style="text-align: center;">No hay datos de ventas por mes en este período</td></tr>`
                      : salesData.byMonth
                          .map(
                            (month) => `
                            <tr>
                              <td>${month.month}</td>
                              <td class="text-right">${formatCurrency(month.total)}</td>
                              <td class="text-right">${month.count}</td>
                              <td class="text-right">${formatCurrency(
                                month.count > 0 ? month.total / month.count : 0,
                              )}</td>
                            </tr>
                          `,
                          )
                          .join("")
                  }
                </tbody>
              </table>
            </div>

            <!-- Footer -->
            <div class="footer">
              <p>Informe generado el ${new Date().toLocaleString()}</p>
              <p>WILPOS - Sistema de Punto de Venta</p>
            </div>
          </div>
        </body>
        </html>
      `
    } catch (error) {
      console.error("Error generating print report HTML:", error)
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Error en Informe</title>
        </head>
        <body>
          <h1>Error al generar informe</h1>
          <p>Se produjo un error al generar el informe de ventas para impresión.</p>
          <p>Error: ${error instanceof Error ? error.message : "Error desconocido"}</p>
          <p>Fecha: ${new Date().toLocaleString()}</p>
        </body>
        </html>
      `
    }
  }
}

export default ExportReportUtils
