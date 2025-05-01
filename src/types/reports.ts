// src/types/reports.ts - Tipos para informes y reportes

// Tipo para alertas en la interfaz
export type AlertType = "success" | "warning" | "error" | "info"

// Tipo para elementos de reporte de ventas
export interface SalesReportItem {
  fecha: string
  num_ventas: number
  total_ventas: number
  promedio_venta: number
  total_descuentos: number
  total_impuestos: number
}

// Tipo para productos más vendidos
export interface TopProductItem {
  producto_id: number
  nombre: string
  codigo_barra?: string
  cantidad_vendida: number
  total_vendido: number
}

// Tipo para datos de ventas procesados
export interface SalesData {
  today: {
    total: number
    count: number
    average: number
  }
  period: {
    total: number
    count: number
    average: number
    growth: number
  }
  byMonth: {
    month: string
    total: number
    count: number
  }[]
  topProducts: TopProductItem[]
  categories: {
    category: string
    total: number
    percentage: number
  }[]
}

// Tipo para reporte diario
export interface DailyReport {
  fecha: string
  ventas_total: number
  num_ventas: number
  gastos_total: number
  num_gastos: number
  balance: number
}

// Tipo para reporte de inventario
export interface InventoryReport {
  producto_id: number
  nombre: string
  stock_inicial: number
  entradas: number
  salidas: number
  stock_actual: number
  valor_inventario: number
}

// Tipo para reporte de clientes
export interface CustomerReport {
  cliente_id: number
  nombre: string
  num_compras: number
  total_compras: number
  promedio_compra: number
  ultima_compra: string
}
