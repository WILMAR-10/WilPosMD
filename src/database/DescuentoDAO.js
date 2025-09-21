// DescuentoDAO.js - Sistema completo de descuentos y ofertas
import { getDB } from './db.js';

class DescuentoDAO {
    // =====================================================
    // DESCUENTOS BASICOS
    // =====================================================
    
    static async create(descuento) {
        const db = getDB();
        
        const stmt = db.prepare(`
            INSERT INTO descuentos (
                nombre, descripcion, tipo, valor, valor_maximo, codigo_cupon,
                cantidad_minima, monto_minimo, categoria, producto_id,
                fecha_inicio, fecha_fin, activo, limite_uso, veces_usado,
                es_acumulable, usuario_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            descuento.nombre,
            descuento.descripcion,
            descuento.tipo,
            descuento.valor,
            descuento.valor_maximo || null,
            descuento.codigo_cupon || null,
            descuento.cantidad_minima || null,
            descuento.monto_minimo || null,
            descuento.categoria || null,
            descuento.producto_id || null,
            descuento.fecha_inicio || null,
            descuento.fecha_fin || null,
            descuento.activo || 1,
            descuento.limite_uso || null,
            0, // veces_usado
            descuento.es_acumulable || 0,
            descuento.usuario_id
        );
        
        return { id: result.lastInsertRowid, success: true };
    }
    
    static async getAll(filters = {}) {
        const db = getDB();
        let query = `
            SELECT d.*, p.nombre as producto_nombre
            FROM descuentos d
            LEFT JOIN productos p ON d.producto_id = p.id
            WHERE 1=1
        `;
        const params = [];
        
        if (filters.activo !== undefined) {
            query += ' AND d.activo = ?';
            params.push(filters.activo);
        }
        
        if (filters.tipo) {
            query += ' AND d.tipo = ?';
            params.push(filters.tipo);
        }
        
        if (filters.vigente) {
            const hoy = new Date().toISOString().split('T')[0];
            query += ' AND (d.fecha_inicio IS NULL OR d.fecha_inicio <= ?) AND (d.fecha_fin IS NULL OR d.fecha_fin >= ?)';
            params.push(hoy, hoy);
        }
        
        query += ' ORDER BY d.fecha_creacion DESC';
        
        const stmt = db.prepare(query);
        return stmt.all(...params);
    }
    
    static async getById(id) {
        const db = getDB();
        const stmt = db.prepare(`
            SELECT d.*, p.nombre as producto_nombre
            FROM descuentos d
            LEFT JOIN productos p ON d.producto_id = p.id
            WHERE d.id = ?
        `);
        
        return stmt.get(id);
    }
    
    static async getByCupon(codigo_cupon) {
        const db = getDB();
        const hoy = new Date().toISOString().split('T')[0];
        
        const stmt = db.prepare(`
            SELECT * FROM descuentos
            WHERE codigo_cupon = ? 
            AND activo = 1
            AND (fecha_inicio IS NULL OR fecha_inicio <= ?)
            AND (fecha_fin IS NULL OR fecha_fin >= ?)
            AND (limite_uso IS NULL OR veces_usado < limite_uso)
        `);
        
        return stmt.get(codigo_cupon, hoy, hoy);
    }
    
    // =====================================================
    // LOGICA DE DESCUENTOS AVANZADA
    // =====================================================
    
    // Obtener descuentos aplicables a un producto
    static async getApplicableDiscounts(producto_id, categoria, cantidad, monto_total) {
        const db = getDB();
        const hoy = new Date().toISOString().split('T')[0];
        
        const stmt = db.prepare(`
            SELECT * FROM descuentos
            WHERE activo = 1
            AND (fecha_inicio IS NULL OR fecha_inicio <= ?)
            AND (fecha_fin IS NULL OR fecha_fin >= ?)
            AND (limite_uso IS NULL OR veces_usado < limite_uso)
            AND (
                (tipo = 'general') OR
                (tipo = 'producto' AND producto_id = ?) OR
                (tipo = 'categoria' AND categoria = ?) OR
                (tipo = 'cantidad' AND cantidad_minima <= ?) OR
                (tipo = 'monto' AND monto_minimo <= ?)
            )
            ORDER BY valor DESC
        `);
        
        return stmt.all(hoy, hoy, producto_id, categoria, cantidad, monto_total);
    }
    
    // Calcular descuento aplicable segun tipo
    static calcularDescuento(descuento, cantidad, precio_unitario, monto_total) {
        let descuento_aplicado = 0;
        
        switch (descuento.tipo) {
            case 'porcentaje':
                descuento_aplicado = monto_total * (descuento.valor / 100);
                if (descuento.valor_maximo && descuento_aplicado > descuento.valor_maximo) {
                    descuento_aplicado = descuento.valor_maximo;
                }
                break;
                
            case 'monto_fijo':
                descuento_aplicado = Math.min(descuento.valor, monto_total);
                break;
                
            case 'buy_x_get_y':
                const cantidad_gratis = Math.floor(cantidad / (descuento.cantidad_minima + 1)) * 1;
                descuento_aplicado = cantidad_gratis * precio_unitario;
                break;
                
            default:
                descuento_aplicado = descuento.valor;
        }
        
        return Math.max(0, descuento_aplicado);
    }
    
    // Aplicar descuento y registrar uso
    static async aplicarDescuento(descuento_id, venta_id, monto_descuento, usuario_id) {
        const db = getDB();
        
        const transaction = db.transaction(() => {
            // 1. Registrar aplicación del descuento
            const aplicarStmt = db.prepare(`
                INSERT INTO descuentos_aplicados (
                    descuento_id, venta_id, monto_descuento, usuario_id
                ) VALUES (?, ?, ?, ?)
            `);
            
            aplicarStmt.run(descuento_id, venta_id, monto_descuento, usuario_id);
            
            // 2. Incrementar contador de uso
            const incrementarStmt = db.prepare(`
                UPDATE descuentos 
                SET veces_usado = veces_usado + 1 
                WHERE id = ?
            `);
            
            incrementarStmt.run(descuento_id);
        });
        
        transaction();
        return { success: true };
    }
    
    // =====================================================
    // DESCUENTOS PREDEFINIDOS
    // =====================================================
    
    // Crear descuentos de temporada predefinidos
    static async createSeasonalOffers(usuario_id) {
        const ofertas = [
            {
                nombre: "Descuento Fin de Semana",
                descripcion: "15% de descuento todos los fines de semana",
                tipo: "porcentaje",
                valor: 15,
                codigo_cupon: "WEEKEND15",
                activo: 1,
                usuario_id
            },
            {
                nombre: "Compra Mayor",
                descripcion: "$100 de descuento en compras mayores a $1000",
                tipo: "monto_fijo",
                valor: 100,
                monto_minimo: 1000,
                codigo_cupon: "MAYOR100",
                activo: 1,
                usuario_id
            },
            {
                nombre: "Llevar 3 Pagar 2",
                descripcion: "Compra 2 productos y lleva 3",
                tipo: "buy_x_get_y",
                valor: 1,
                cantidad_minima: 2,
                codigo_cupon: "3X2",
                activo: 1,
                usuario_id
            }
        ];
        
        const results = [];
        for (const oferta of ofertas) {
            const result = await this.create(oferta);
            results.push(result);
        }
        
        return results;
    }
    
    // =====================================================
    // MANAGEMENT Y ACTUALIZACIONES
    // =====================================================
    
    static async update(id, descuento) {
        const db = getDB();
        
        const stmt = db.prepare(`
            UPDATE descuentos SET
                nombre = ?, descripcion = ?, tipo = ?, valor = ?, valor_maximo = ?,
                codigo_cupon = ?, cantidad_minima = ?, monto_minimo = ?, categoria = ?,
                producto_id = ?, fecha_inicio = ?, fecha_fin = ?, activo = ?,
                limite_uso = ?, es_acumulable = ?, ultima_modificacion = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        const result = stmt.run(
            descuento.nombre,
            descuento.descripcion,
            descuento.tipo,
            descuento.valor,
            descuento.valor_maximo || null,
            descuento.codigo_cupon || null,
            descuento.cantidad_minima || null,
            descuento.monto_minimo || null,
            descuento.categoria || null,
            descuento.producto_id || null,
            descuento.fecha_inicio || null,
            descuento.fecha_fin || null,
            descuento.activo,
            descuento.limite_uso || null,
            descuento.es_acumulable || 0,
            id
        );
        
        return { success: result.changes > 0 };
    }
    
    static async delete(id) {
        const db = getDB();
        
        // Verificar que no se haya usado
        const usoStmt = db.prepare('SELECT COUNT(*) as count FROM descuentos_aplicados WHERE descuento_id = ?');
        const uso = usoStmt.get(id);
        
        if (uso.count > 0) {
            return { success: false, error: 'No se puede eliminar un descuento que ya ha sido usado' };
        }
        
        const stmt = db.prepare('DELETE FROM descuentos WHERE id = ?');
        const result = stmt.run(id);
        
        return { success: result.changes > 0 };
    }
    
    // Desactivar descuento
    static async deactivate(id) {
        const db = getDB();
        
        const stmt = db.prepare(`
            UPDATE descuentos 
            SET activo = 0, ultima_modificacion = CURRENT_TIMESTAMP 
            WHERE id = ?
        `);
        
        const result = stmt.run(id);
        return { success: result.changes > 0 };
    }
    
    // =====================================================
    // ESTADISTICAS Y REPORTES
    // =====================================================
    
    // Estadísticas de descuentos
    static async getStatistics(fechaInicio, fechaFin) {
        const db = getDB();
        
        const statsStmt = db.prepare(`
            SELECT 
                d.tipo,
                COUNT(da.id) as total_aplicaciones,
                SUM(da.monto_descuento) as monto_total_descontado,
                AVG(da.monto_descuento) as promedio_descuento,
                d.nombre as descuento_nombre
            FROM descuentos d
            LEFT JOIN descuentos_aplicados da ON d.id = da.descuento_id
            WHERE da.fecha_aplicacion BETWEEN ? AND ?
            GROUP BY d.id, d.tipo, d.nombre
            ORDER BY monto_total_descontado DESC
        `);
        
        return statsStmt.all(fechaInicio, fechaFin);
    }
    
    // Obtener historial de aplicaciones
    static async getApplicationHistory(descuento_id) {
        const db = getDB();
        
        const stmt = db.prepare(`
            SELECT da.*, v.total as venta_total, u.nombre as usuario_nombre
            FROM descuentos_aplicados da
            JOIN ventas v ON da.venta_id = v.id
            JOIN usuarios u ON da.usuario_id = u.id
            WHERE da.descuento_id = ?
            ORDER BY da.fecha_aplicacion DESC
        `);
        
        return stmt.all(descuento_id);
    }
    
    // =====================================================
    // COMPATIBILIDAD CON SISTEMA EXISTENTE
    // =====================================================
    
    static getActiveDiscounts() {
        try {
            const db = getDB();
            const now = new Date().toISOString();
            
            return db.prepare(`
                SELECT d.*, p.nombre as producto_nombre, p.precio_venta
                FROM descuentos d
                LEFT JOIN productos p ON d.producto_id = p.id
                WHERE d.activo = 1 
                AND (d.fecha_fin IS NULL OR d.fecha_fin > ?)
                ORDER BY d.fecha_creacion DESC
            `).all(now);
        } catch (error) {
            console.error('Error getting active discounts:', error);
            throw error;
        }
    }

    static toggleActive(id) {
        try {
            const db = getDB();
            const current = db.prepare('SELECT activo FROM descuentos WHERE id = ?').get(id);
            if (!current) return false;
            
            const newStatus = current.activo === 1 ? 0 : 1;
            const result = db.prepare('UPDATE descuentos SET activo = ? WHERE id = ?').run(newStatus, id);
            return result.changes > 0;
        } catch (error) {
            console.error('Error toggling descuento status:', error);
            throw error;
        }
    }

    static incrementUsage(id) {
        try {
            const db = getDB();
            const result = db.prepare(`
                UPDATE descuentos 
                SET veces_usado = veces_usado + 1 
                WHERE id = ?
            `).run(id);
            return result.changes > 0;
        } catch (error) {
            console.error('Error incrementing discount usage:', error);
            throw error;
        }
    }

    static getByCouponCode(codigo) {
        try {
            const db = getDB();
            return db.prepare(`
                SELECT d.*, p.nombre as producto_nombre
                FROM descuentos d
                LEFT JOIN productos p ON d.producto_id = p.id
                WHERE d.codigo_cupon = ? AND d.activo = 1
            `).get(codigo);
        } catch (error) {
            console.error('Error getting discount by coupon code:', error);
            throw error;
        }
    }
}

export default DescuentoDAO;