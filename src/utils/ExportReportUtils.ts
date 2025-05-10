import type {
  SalesData,
  TopProductItem,
  AlertType
} from "../types/reports";

type FormatFn = (value: number) => string;

const ExportReportUtils = {
  generateSalesReportHTML(
    startDate: Date,
    endDate: Date,
    salesData: SalesData,
    formatCurrency: FormatFn
  ): string {
    const { today, period, byMonth, topProducts, categories } = salesData;

    // Encabezado de estilos
    const styles = `
      body { font-family: Arial, sans-serif; color: #333; padding: 20px; }
      h1, h2 { text-align: center; }
      table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
      th { background: #f4f4f4; }
    `;

    // Cabecera y resumen
    let html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Informe de Ventas</title>
        <style>${styles}</style>
      </head>
      <body>
        <h1>Informe de Ventas</h1>
        <p style="text-align:center;">
          Período: ${startDate.toLocaleDateString()} – ${endDate.toLocaleDateString()}
        </p>

        <h2>Resumen General</h2>
        <table>
          <tr><th>Métrica</th><th>Valor</th></tr>
          <tr><td>Ingresos Totales</td><td>${formatCurrency(period.total)}</td></tr>
          <tr><td>Transacciones</td><td>${period.count}</td></tr>
          <tr><td>Ticket Promedio</td><td>${formatCurrency(period.average)}</td></tr>
          <tr><td>Crecimiento</td><td>${period.growth.toFixed(1)}%</td></tr>
          <tr><td>Descuentos</td><td>${formatCurrency(period.discounts)}</td></tr>
          <tr><td>Impuestos</td><td>${formatCurrency(period.taxes)}</td></tr>
        </table>

        <h2>Ventas por Mes</h2>
        <table>
          <tr><th>Mes</th><th>Ventas</th><th>Transacciones</th><th>Ticket Promedio</th></tr>
          ${byMonth
            .map(
              (m) => `
            <tr>
              <td>${m.month}</td>
              <td>${formatCurrency(m.total)}</td>
              <td>${m.count}</td>
              <td>${formatCurrency(m.count > 0 ? m.total / m.count : 0)}</td>
            </tr>`
            )
            .join("")}
        </table>

        <h2>Productos Más Vendidos</h2>
        <table>
          <tr><th>Producto</th><th>Código</th><th>Cantidad</th><th>Total</th></tr>
          ${topProducts
            .map(
              (p) => `
            <tr>
              <td>${p.nombre}</td>
              <td>${p.codigo_barra || "N/A"}</td>
              <td>${p.cantidad_vendida}</td>
              <td>${formatCurrency(p.total_vendido)}</td>
            </tr>`
            )
            .join("")}
        </table>

        <h2>Distribución por Categoría</h2>
        <table>
          <tr><th>Categoría</th><th>Total</th><th>%</th></tr>
          ${categories
            .map(
              (c) => `
            <tr>
              <td>${c.category}</td>
              <td>${formatCurrency(c.total)}</td>
              <td>${c.percentage}%</td>
            </tr>`
            )
            .join("")}
        </table>
      </body>
      </html>
    `;

    return html;
  },

  generatePrintReportHTML(
    startDate: Date,
    endDate: Date,
    salesData: SalesData,
    formatCurrency: FormatFn
  ): string {
    // Reusa el HTML de export y activa impresión al cargar
    const base = this.generateSalesReportHTML(
      startDate,
      endDate,
      salesData,
      formatCurrency
    );
    return base.replace(
      "<body>",
      `<body onload="window.print()" style="margin:0;padding:0;">`
    );
  }
};

export default ExportReportUtils;