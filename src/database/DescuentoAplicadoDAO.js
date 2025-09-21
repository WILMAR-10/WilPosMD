// src/database/DescuentoAplicadoDAO.js
import { getDB } from './db.js';

export default class DescuentoAplicadoDAO {
  static getAll() {
    try {
      const db = getDB();
      return db.prepare(`
        SELECT da.*, v.fecha_venta, v.total as venta_total
        FROM descuentos_aplicados da
        JOIN ventas v ON da.venta_id = v.id
        ORDER BY da.fecha_aplicacion DESC
      `).all();
    } catch (error) {
      console.error('Error getting all descuentos aplicados:', error);
      throw error;
    }
  }

  static getByVentaId(ventaId) {
    try {
      const db = getDB();
      return db.prepare(`
        SELECT * FROM descuentos_aplicados 
        WHERE venta_id = ?
        ORDER BY fecha_aplicacion ASC
      `).all(ventaId);
    } catch (error) {
      console.error('Error getting descuentos by venta id:', error);
      throw error;
    }
  }

  static create(descuentoAplicado) {
    try {
      const db = getDB();
      const stmt = db.prepare(`
        INSERT INTO descuentos_aplicados (
          venta_id, descuento_id, oferta_id, tipo, nombre, valor_aplicado
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        descuentoAplicado.venta_id,
        descuentoAplicado.descuento_id || null,
        descuentoAplicado.oferta_id || null,
        descuentoAplicado.tipo,
        descuentoAplicado.nombre,
        descuentoAplicado.valor_aplicado
      );
      
      return { id: result.lastInsertRowid, ...descuentoAplicado };
    } catch (error) {
      console.error('Error creating descuento aplicado:', error);
      throw error;
    }
  }

  static getTotalDescuentosByPeriod(startDate, endDate) {
    try {
      const db = getDB();
      return db.prepare(`
        SELECT 
          COUNT(*) as total_descuentos,
          SUM(valor_aplicado) as total_valor_descuentos,
          AVG(valor_aplicado) as promedio_descuento,
          tipo
        FROM descuentos_aplicados da
        JOIN ventas v ON da.venta_id = v.id
        WHERE v.fecha_venta BETWEEN ? AND ?
        GROUP BY tipo
      `).all(startDate, endDate);
    } catch (error) {
      console.error('Error getting descuentos totals by period:', error);
      throw error;
    }
  }

  static getMostUsedDiscounts(startDate, endDate, limit = 10) {
    try {
      const db = getDB();
      return db.prepare(`
        SELECT 
          nombre,
          COUNT(*) as usos,
          SUM(valor_aplicado) as valor_total,
          AVG(valor_aplicado) as valor_promedio,
          tipo
        FROM descuentos_aplicados da
        JOIN ventas v ON da.venta_id = v.id
        WHERE v.fecha_venta BETWEEN ? AND ?
        GROUP BY nombre, tipo
        ORDER BY usos DESC
        LIMIT ?
      `).all(startDate, endDate, limit);
    } catch (error) {
      console.error('Error getting most used discounts:', error);
      throw error;
    }
  }

  static getDiscountEffectiveness(startDate, endDate) {
    try {
      const db = getDB();
      
      // Obtener ventas con y sin descuentos
      const stats = db.prepare(`
        SELECT 
          COUNT(CASE WHEN da.id IS NOT NULL THEN 1 END) as ventas_con_descuento,
          COUNT(v.id) as total_ventas,
          AVG(CASE WHEN da.id IS NOT NULL THEN v.total END) as promedio_venta_con_descuento,
          AVG(v.total) as promedio_venta_general,
          SUM(CASE WHEN da.id IS NOT NULL THEN da.valor_aplicado ELSE 0 END) as total_descuentos_aplicados
        FROM ventas v
        LEFT JOIN descuentos_aplicados da ON v.id = da.venta_id
        WHERE v.fecha_venta BETWEEN ? AND ?
      `).get(startDate, endDate);
      
      return {
        ...stats,
        porcentaje_ventas_con_descuento: stats.total_ventas > 0 
          ? (stats.ventas_con_descuento / stats.total_ventas) * 100 
          : 0,
        impacto_promedio: stats.promedio_venta_con_descuento && stats.promedio_venta_general
          ? ((stats.promedio_venta_con_descuento - stats.promedio_venta_general) / stats.promedio_venta_general) * 100
          : 0
      };
    } catch (error) {
      console.error('Error getting discount effectiveness:', error);
      throw error;
    }
  }

  static delete(id) {
    try {
      const db = getDB();
      const result = db.prepare('DELETE FROM descuentos_aplicados WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting descuento aplicado:', error);
      throw error;
    }
  }

  static deleteByVentaId(ventaId) {
    try {
      const db = getDB();
      const result = db.prepare('DELETE FROM descuentos_aplicados WHERE venta_id = ?').run(ventaId);
      return result.changes;
    } catch (error) {
      console.error('Error deleting descuentos by venta id:', error);
      throw error;
    }
  }
}