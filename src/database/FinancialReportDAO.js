// src/database/FinancialReportDAO.js
import { getDB } from './db.js';

export default class FinancialReportDAO {
  
  // ==================== BALANCE GENERAL ====================
  
  static async getBalanceSheet(fechaHasta = null) {
    try {
      const db = getDB();
      const fecha = fechaHasta || new Date().toISOString().split('T')[0];
      
      // ACTIVOS CORRIENTES
      const activosCorrientes = {
        // Efectivo en caja (calculado desde ventas - gastos)
        efectivo: await this.getEfectivoEnCaja(fecha),
        
        // Inventario (valor del stock actual)
        inventario: await this.getValorInventario(),
        
        // Cuentas por cobrar
        cuentasPorCobrar: await this.getCuentasPorCobrar(fecha)
      };
      
      // ACTIVOS FIJOS
      const activosFijos = await this.getActivosFijos(fecha);
      
      // PASIVOS CORRIENTES  
      const pasivosCorrientes = {
        cuentasPorPagar: await this.getCuentasPorPagar(fecha)
      };
      
      // PATRIMONIO
      const patrimonio = await this.getPatrimonio(fecha);
      
      // Calcular totales
      const totalActivosCorrientes = Object.values(activosCorrientes).reduce((sum, val) => sum + val, 0);
      const totalActivosFijos = activosFijos.reduce((sum, activo) => sum + activo.valor_actual, 0);
      const totalActivos = totalActivosCorrientes + totalActivosFijos;
      
      const totalPasivos = Object.values(pasivosCorrientes).reduce((sum, val) => sum + val, 0);
      const totalPatrimonio = patrimonio.reduce((sum, item) => sum + item.monto, 0);
      
      return {
        fecha: fecha,
        activos: {
          corrientes: {
            ...activosCorrientes,
            total: totalActivosCorrientes
          },
          fijos: {
            detalle: activosFijos,
            total: totalActivosFijos
          },
          total: totalActivos
        },
        pasivos: {
          corrientes: {
            ...pasivosCorrientes,
            total: totalPasivos
          },
          total: totalPasivos
        },
        patrimonio: {
          detalle: patrimonio,
          total: totalPatrimonio
        },
        // Verificación contable: Activos = Pasivos + Patrimonio
        verificacion: {
          activos: totalActivos,
          pasivosMasPatrimonio: totalPasivos + totalPatrimonio,
          diferencia: totalActivos - (totalPasivos + totalPatrimonio),
          balanceado: Math.abs(totalActivos - (totalPasivos + totalPatrimonio)) < 0.01
        }
      };
      
    } catch (error) {
      console.error('Error generating balance sheet:', error);
      throw error;
    }
  }
  
  // ==================== ESTADO DE RESULTADOS ====================
  
  static async getIncomeStatement(fechaInicio, fechaFin) {
    try {
      const db = getDB();
      
      // INGRESOS
      const ventasResult = db.prepare(`
        SELECT 
          SUM(total) as ingresos_brutos,
          SUM(descuento) as descuentos_ventas,
          SUM(impuestos) as impuestos_cobrados
        FROM ventas 
        WHERE fecha_venta BETWEEN ? AND ?
        AND estado = 'Completada'
      `).get(fechaInicio, fechaFin);
      
      const ingresosNetos = (ventasResult.ingresos_brutos || 0) - (ventasResult.descuentos_ventas || 0);
      
      // COSTO DE VENTAS (basado en productos vendidos)
      const costoVentas = await this.getCostoProductosVendidos(fechaInicio, fechaFin);
      
      // UTILIDAD BRUTA
      const utilidadBruta = ingresosNetos - costoVentas;
      
      // GASTOS OPERATIVOS
      const gastosOperativos = await this.getGastosOperativos(fechaInicio, fechaFin);
      
      // UTILIDAD OPERATIVA
      const utilidadOperativa = utilidadBruta - gastosOperativos.total;
      
      // UTILIDAD NETA (sin otros ingresos/gastos por ahora)
      const utilidadNeta = utilidadOperativa;
      
      return {
        periodo: { inicio: fechaInicio, fin: fechaFin },
        ingresos: {
          brutos: ventasResult.ingresos_brutos || 0,
          descuentos: ventasResult.descuentos_ventas || 0,
          netos: ingresosNetos
        },
        costoVentas: costoVentas,
        utilidadBruta: utilidadBruta,
        gastosOperativos: gastosOperativos,
        utilidadOperativa: utilidadOperativa,
        utilidadNeta: utilidadNeta,
        impuestos: ventasResult.impuestos_cobrados || 0,
        // Ratios útiles
        margenBruto: ingresosNetos > 0 ? (utilidadBruta / ingresosNetos) * 100 : 0,
        margenOperativo: ingresosNetos > 0 ? (utilidadOperativa / ingresosNetos) * 100 : 0,
        margenNeto: ingresosNetos > 0 ? (utilidadNeta / ingresosNetos) * 100 : 0
      };
      
    } catch (error) {
      console.error('Error generating income statement:', error);
      throw error;
    }
  }
  
  // ==================== FLUJO DE EFECTIVO ====================
  
  static async getCashFlowStatement(fechaInicio, fechaFin) {
    try {
      const db = getDB();
      
      // ACTIVIDADES OPERATIVAS
      const operativas = db.prepare(`
        SELECT 
          tipo_movimiento,
          SUM(monto) as total
        FROM flujo_efectivo
        WHERE tipo_actividad = 'operativa'
        AND fecha BETWEEN ? AND ?
        GROUP BY tipo_movimiento
      `).all(fechaInicio, fechaFin);
      
      // ACTIVIDADES DE INVERSIÓN
      const inversion = db.prepare(`
        SELECT 
          tipo_movimiento,
          SUM(monto) as total
        FROM flujo_efectivo
        WHERE tipo_actividad = 'inversion'
        AND fecha BETWEEN ? AND ?
        GROUP BY tipo_movimiento
      `).all(fechaInicio, fechaFin);
      
      // ACTIVIDADES DE FINANCIACIÓN
      const financiacion = db.prepare(`
        SELECT 
          tipo_movimiento,
          SUM(monto) as total
        FROM flujo_efectivo
        WHERE tipo_actividad = 'financiacion'
        AND fecha BETWEEN ? AND ?
        GROUP BY tipo_movimiento
      `).all(fechaInicio, fechaFin);
      
      // Calcular netos
      const calcularNeto = (flujos) => {
        const entradas = flujos.find(f => f.tipo_movimiento === 'entrada')?.total || 0;
        const salidas = flujos.find(f => f.tipo_movimiento === 'salida')?.total || 0;
        return entradas - salidas;
      };
      
      const flujoOperativo = calcularNeto(operativas);
      const flujoInversion = calcularNeto(inversion);
      const flujoFinanciacion = calcularNeto(financiacion);
      
      const flujoNetoTotal = flujoOperativo + flujoInversion + flujoFinanciacion;
      
      return {
        periodo: { inicio: fechaInicio, fin: fechaFin },
        actividades: {
          operativas: {
            detalle: operativas,
            neto: flujoOperativo
          },
          inversion: {
            detalle: inversion,
            neto: flujoInversion
          },
          financiacion: {
            detalle: financiacion,
            neto: flujoFinanciacion
          }
        },
        flujoNetoTotal: flujoNetoTotal,
        efectivoInicial: await this.getEfectivoInicial(fechaInicio),
        efectivoFinal: await this.getEfectivoFinal(fechaFin)
      };
      
    } catch (error) {
      console.error('Error generating cash flow statement:', error);
      throw error;
    }
  }
  
  // ==================== MÉTODOS AUXILIARES ====================
  
  static async getEfectivoEnCaja(fecha) {
    const db = getDB();
    
    // Ingresos por ventas hasta la fecha
    const ingresos = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total
      FROM ventas 
      WHERE fecha_venta <= ? AND estado = 'Completada'
    `).get(fecha).total;
    
    // Gastos hasta la fecha
    const gastos = db.prepare(`
      SELECT COALESCE(SUM(monto), 0) as total
      FROM gastos 
      WHERE fecha <= ?
    `).get(fecha).total;
    
    return ingresos - gastos;
  }
  
  static async getValorInventario() {
    const db = getDB();
    
    return db.prepare(`
      SELECT COALESCE(SUM(stock * costo), 0) as valor_inventario
      FROM productos 
      WHERE borrado = 0
    `).get().valor_inventario;
  }
  
  static async getCuentasPorCobrar(fecha) {
    const db = getDB();
    
    return db.prepare(`
      SELECT COALESCE(SUM(saldo_pendiente), 0) as total
      FROM cuentas_por_cobrar 
      WHERE fecha_venta <= ? AND estado != 'cobrado'
    `).get(fecha).total;
  }
  
  static async getActivosFijos(fecha) {
    const db = getDB();
    
    return db.prepare(`
      SELECT nombre, categoria, valor_actual, fecha_adquisicion
      FROM activos_fijos
      WHERE fecha_adquisicion <= ? AND estado = 'activo'
    `).all(fecha);
  }
  
  static async getCuentasPorPagar(fecha) {
    const db = getDB();
    
    return db.prepare(`
      SELECT COALESCE(SUM(saldo_pendiente), 0) as total
      FROM cuentas_por_pagar 
      WHERE fecha_factura <= ? AND estado != 'pagado'
    `).get(fecha).total;
  }
  
  static async getPatrimonio(fecha) {
    const db = getDB();
    
    return db.prepare(`
      SELECT tipo, concepto, monto, fecha
      FROM patrimonio
      WHERE fecha <= ?
      ORDER BY fecha DESC
    `).all(fecha);
  }
  
  static async getCostoProductosVendidos(fechaInicio, fechaFin) {
    const db = getDB();
    
    const resultado = db.prepare(`
      SELECT COALESCE(SUM(vd.cantidad * p.costo), 0) as costo_total
      FROM venta_detalles vd
      JOIN ventas v ON vd.venta_id = v.id
      JOIN productos p ON vd.producto_id = p.id
      WHERE v.fecha_venta BETWEEN ? AND ?
      AND v.estado = 'Completada'
    `).get(fechaInicio, fechaFin);
    
    return resultado.costo_total;
  }
  
  static async getGastosOperativos(fechaInicio, fechaFin) {
    const db = getDB();
    
    const gastos = db.prepare(`
      SELECT 
        categoria,
        SUM(monto) as total
      FROM gastos
      WHERE fecha BETWEEN ? AND ?
      GROUP BY categoria
    `).all(fechaInicio, fechaFin);
    
    const totalGastos = gastos.reduce((sum, gasto) => sum + gasto.total, 0);
    
    return {
      detalle: gastos,
      total: totalGastos
    };
  }
  
  static async getEfectivoInicial(fecha) {
    // Por simplicidad, calculamos desde el inicio
    return this.getEfectivoEnCaja('1900-01-01');
  }
  
  static async getEfectivoFinal(fecha) {
    return this.getEfectivoEnCaja(fecha);
  }
}