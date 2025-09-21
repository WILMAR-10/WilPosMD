// src/database/FacturacionElectronicaDAO.js - DAO para Facturación Electrónica DGII
import { getDB } from './db.js';

export class FacturacionElectronicaDAO {
  static tableName = 'facturacion_electronica';

  /**
   * Crear tabla de facturación electrónica
   */
  static createTable() {
    const db = getDB();
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venta_id INTEGER NOT NULL,
        ncf_electronico TEXT NOT NULL UNIQUE,
        tipo_comprobante TEXT NOT NULL DEFAULT '01',
        estado TEXT NOT NULL DEFAULT 'PENDIENTE',
        fecha_emision DATETIME NOT NULL,
        fecha_envio DATETIME,
        fecha_aprobacion DATETIME,
        codigo_seguimiento TEXT,
        xml_firmado TEXT,
        respuesta_dgii TEXT,
        certificado_id TEXT,
        vigente_hasta DATETIME,
        intentos_envio INTEGER DEFAULT 0,
        ultimo_error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE
      )
    `;

    db.exec(createTableSQL);

    // Crear índices para optimizar consultas
    const createIndexes = [
      `CREATE INDEX IF NOT EXISTS idx_fe_venta_id ON ${this.tableName} (venta_id)`,
      `CREATE INDEX IF NOT EXISTS idx_fe_ncf ON ${this.tableName} (ncf_electronico)`,
      `CREATE INDEX IF NOT EXISTS idx_fe_estado ON ${this.tableName} (estado)`,
      `CREATE INDEX IF NOT EXISTS idx_fe_fecha_emision ON ${this.tableName} (fecha_emision)`,
      `CREATE INDEX IF NOT EXISTS idx_fe_codigo_seguimiento ON ${this.tableName} (codigo_seguimiento)`
    ];

    createIndexes.forEach(indexSQL => db.exec(indexSQL));
    
    console.log(`✅ Tabla ${this.tableName} creada/verificada exitosamente`);
    return true;
  }

  /**
   * Crear registro de factura electrónica
   */
  static create(facturaElectronica) {
    const db = getDB();
    
    const insertSQL = `
      INSERT INTO ${this.tableName} 
      (venta_id, ncf_electronico, tipo_comprobante, estado, fecha_emision, 
       fecha_envio, codigo_seguimiento, xml_firmado, certificado_id, vigente_hasta) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const stmt = db.prepare(insertSQL);
      const result = stmt.run(
        facturaElectronica.venta_id,
        facturaElectronica.ncf_electronico,
        facturaElectronica.tipo_comprobante || '01',
        facturaElectronica.estado || 'PENDIENTE',
        facturaElectronica.fecha_emision,
        facturaElectronica.fecha_envio || null,
        facturaElectronica.codigo_seguimiento || null,
        facturaElectronica.xml_firmado || null,
        facturaElectronica.certificado_id || null,
        facturaElectronica.vigente_hasta || null
      );

      console.log(`✅ Factura electrónica creada con ID: ${result.lastInsertRowid}`);
      return {
        success: true,
        id: result.lastInsertRowid,
        data: { ...facturaElectronica, id: result.lastInsertRowid }
      };
    } catch (error) {
      console.error('❌ Error creando factura electrónica:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener factura electrónica por ID de venta
   */
  static getByVentaId(ventaId) {
    const db = getDB();
    
    const selectSQL = `
      SELECT * FROM ${this.tableName} 
      WHERE venta_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `;

    try {
      const stmt = db.prepare(selectSQL);
      const result = stmt.get(ventaId);
      
      return {
        success: true,
        data: result || null
      };
    } catch (error) {
      console.error('❌ Error obteniendo factura electrónica:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener factura electrónica por NCF
   */
  static getByNCF(ncf) {
    const db = getDB();
    
    const selectSQL = `
      SELECT fe.*, v.total, v.fecha_venta, v.cliente 
      FROM ${this.tableName} fe
      LEFT JOIN ventas v ON fe.venta_id = v.id
      WHERE fe.ncf_electronico = ?
    `;

    try {
      const stmt = db.prepare(selectSQL);
      const result = stmt.get(ncf);
      
      return {
        success: true,
        data: result || null
      };
    } catch (error) {
      console.error('❌ Error obteniendo factura por NCF:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Actualizar estado de factura electrónica
   */
  static updateStatus(id, estado, detalles = {}) {
    const db = getDB();
    
    let updateSQL = `UPDATE ${this.tableName} SET estado = ?, updated_at = CURRENT_TIMESTAMP`;
    const params = [estado];
    
    // Agregar campos opcionales según el estado
    if (detalles.fecha_envio) {
      updateSQL += ', fecha_envio = ?';
      params.push(detalles.fecha_envio);
    }
    
    if (detalles.fecha_aprobacion) {
      updateSQL += ', fecha_aprobacion = ?';
      params.push(detalles.fecha_aprobacion);
    }
    
    if (detalles.codigo_seguimiento) {
      updateSQL += ', codigo_seguimiento = ?';
      params.push(detalles.codigo_seguimiento);
    }
    
    if (detalles.respuesta_dgii) {
      updateSQL += ', respuesta_dgii = ?';
      params.push(detalles.respuesta_dgii);
    }
    
    if (detalles.ultimo_error) {
      updateSQL += ', ultimo_error = ?';
      params.push(detalles.ultimo_error);
    }
    
    if (detalles.incrementar_intentos) {
      updateSQL += ', intentos_envio = intentos_envio + 1';
    }
    
    updateSQL += ' WHERE id = ?';
    params.push(id);

    try {
      const stmt = db.prepare(updateSQL);
      const result = stmt.run(...params);
      
      return {
        success: true,
        changes: result.changes,
        data: this.getById(id).data
      };
    } catch (error) {
      console.error('❌ Error actualizando estado:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener factura electrónica por ID
   */
  static getById(id) {
    const db = getDB();
    
    const selectSQL = `SELECT * FROM ${this.tableName} WHERE id = ?`;

    try {
      const stmt = db.prepare(selectSQL);
      const result = stmt.get(id);
      
      return {
        success: true,
        data: result || null
      };
    } catch (error) {
      console.error('❌ Error obteniendo factura por ID:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Listar facturas electrónicas con filtros
   */
  static list(filters = {}) {
    const db = getDB();
    
    let selectSQL = `
      SELECT fe.*, v.total, v.fecha_venta, v.cliente, v.metodo_pago
      FROM ${this.tableName} fe
      LEFT JOIN ventas v ON fe.venta_id = v.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Aplicar filtros
    if (filters.estado) {
      selectSQL += ' AND fe.estado = ?';
      params.push(filters.estado);
    }
    
    if (filters.fecha_desde) {
      selectSQL += ' AND fe.fecha_emision >= ?';
      params.push(filters.fecha_desde);
    }
    
    if (filters.fecha_hasta) {
      selectSQL += ' AND fe.fecha_emision <= ?';
      params.push(filters.fecha_hasta);
    }
    
    if (filters.tipo_comprobante) {
      selectSQL += ' AND fe.tipo_comprobante = ?';
      params.push(filters.tipo_comprobante);
    }
    
    // Ordenar por fecha de emisión descendente
    selectSQL += ' ORDER BY fe.fecha_emision DESC';
    
    // Paginación
    if (filters.limit) {
      selectSQL += ' LIMIT ?';
      params.push(filters.limit);
      
      if (filters.offset) {
        selectSQL += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    try {
      const stmt = db.prepare(selectSQL);
      const results = stmt.all(...params);
      
      // Obtener total de registros para paginación
      const countSQL = `
        SELECT COUNT(*) as total 
        FROM ${this.tableName} fe
        LEFT JOIN ventas v ON fe.venta_id = v.id
        WHERE 1=1
      `;
      
      const countStmt = db.prepare(countSQL);
      const totalResult = countStmt.get();
      
      return {
        success: true,
        data: results,
        total: totalResult.total
      };
    } catch (error) {
      console.error('❌ Error listando facturas electrónicas:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * Obtener estadísticas de facturación electrónica
   */
  static getStats(fechaDesde = null, fechaHasta = null) {
    const db = getDB();
    
    let whereClause = '1=1';
    const params = [];
    
    if (fechaDesde) {
      whereClause += ' AND fecha_emision >= ?';
      params.push(fechaDesde);
    }
    
    if (fechaHasta) {
      whereClause += ' AND fecha_emision <= ?';
      params.push(fechaHasta);
    }

    const statsSQL = `
      SELECT 
        COUNT(*) as total_facturas,
        COUNT(CASE WHEN estado = 'APROBADA' THEN 1 END) as aprobadas,
        COUNT(CASE WHEN estado = 'PENDIENTE' THEN 1 END) as pendientes,
        COUNT(CASE WHEN estado = 'RECHAZADA' THEN 1 END) as rechazadas,
        COUNT(CASE WHEN estado = 'ERROR' THEN 1 END) as errores,
        AVG(CASE WHEN estado = 'APROBADA' THEN 1.0 ELSE 0.0 END) * 100 as tasa_aprobacion
      FROM ${this.tableName}
      WHERE ${whereClause}
    `;

    try {
      const stmt = db.prepare(statsSQL);
      const stats = stmt.get(...params);
      
      return {
        success: true,
        data: {
          totalFacturas: stats.total_facturas || 0,
          aprobadas: stats.aprobadas || 0,
          pendientes: stats.pendientes || 0,
          rechazadas: stats.rechazadas || 0,
          errores: stats.errores || 0,
          tasaAprobacion: Math.round((stats.tasa_aprobacion || 0) * 100) / 100
        }
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener facturas pendientes de envío
   */
  static getPendingSubmissions(limit = 50) {
    const db = getDB();
    
    const selectSQL = `
      SELECT fe.*, v.total, v.fecha_venta, v.cliente
      FROM ${this.tableName} fe
      LEFT JOIN ventas v ON fe.venta_id = v.id
      WHERE fe.estado IN ('PENDIENTE', 'ERROR') 
        AND fe.intentos_envio < 3
      ORDER BY fe.fecha_emision ASC
      LIMIT ?
    `;

    try {
      const stmt = db.prepare(selectSQL);
      const results = stmt.all(limit);
      
      return {
        success: true,
        data: results
      };
    } catch (error) {
      console.error('❌ Error obteniendo facturas pendientes:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * Marcar factura como enviada
   */
  static markAsSent(id, codigoSeguimiento, respuestaDGII = null) {
    return this.updateStatus(id, 'ENVIADA', {
      fecha_envio: new Date().toISOString(),
      codigo_seguimiento: codigoSeguimiento,
      respuesta_dgii: respuestaDGII
    });
  }

  /**
   * Marcar factura como aprobada
   */
  static markAsApproved(id, respuestaDGII = null) {
    return this.updateStatus(id, 'APROBADA', {
      fecha_aprobacion: new Date().toISOString(),
      respuesta_dgii: respuestaDGII
    });
  }

  /**
   * Marcar factura como rechazada
   */
  static markAsRejected(id, error, respuestaDGII = null) {
    return this.updateStatus(id, 'RECHAZADA', {
      ultimo_error: error,
      respuesta_dgii: respuestaDGII,
      incrementar_intentos: true
    });
  }

  /**
   * Verificar si una venta tiene factura electrónica
   */
  static hasElectronicInvoice(ventaId) {
    const result = this.getByVentaId(ventaId);
    return result.success && result.data !== null;
  }

  /**
   * Obtener siguiente número de secuencia para NCF
   */
  static getNextNCFSequence(tipoComprobante = '01') {
    const db = getDB();
    
    const selectSQL = `
      SELECT MAX(CAST(SUBSTR(ncf_electronico, 4) AS INTEGER)) as max_sequence
      FROM ${this.tableName}
      WHERE tipo_comprobante = ?
        AND ncf_electronico LIKE ?
    `;

    try {
      const stmt = db.prepare(selectSQL);
      const result = stmt.get(tipoComprobante, `E${tipoComprobante}%`);
      
      const nextSequence = (result.max_sequence || 0) + 1;
      
      return {
        success: true,
        sequence: nextSequence,
        ncf: `E${tipoComprobante}${nextSequence.toString().padStart(10, '0')}`
      };
    } catch (error) {
      console.error('❌ Error obteniendo secuencia NCF:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default FacturacionElectronicaDAO;