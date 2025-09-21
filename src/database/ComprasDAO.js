// ComprasDAO.js - Manejo de compras a proveedores
import { getDB } from './db.js';

class ComprasDAO {
    // =====================================================
    // COMPRAS
    // =====================================================
    
    static async create(compra) {
        const db = getDB();
        
        // Iniciar transacción
        const transaction = db.transaction(() => {
            // 1. Crear la compra
            const compraStmt = db.prepare(`
                INSERT INTO compras (
                    proveedor_id, numero_factura, numero_ncf, subtotal, itbis, total,
                    estado, metodo_pago, fecha_compra, fecha_vencimiento, notas, usuario_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const compraResult = compraStmt.run(
                compra.proveedor_id,
                compra.numero_factura,
                compra.numero_ncf,
                compra.subtotal,
                compra.itbis || 0,
                compra.total,
                compra.estado || 'pendiente',
                compra.metodo_pago,
                compra.fecha_compra,
                compra.fecha_vencimiento,
                compra.notas,
                compra.usuario_id
            );
            
            const compraId = compraResult.lastInsertRowid;
            
            // 2. Crear los detalles de la compra
            const detalleStmt = db.prepare(`
                INSERT INTO compra_detalles (
                    compra_id, producto_id, cantidad, precio_unitario, costo_final, itbis, subtotal
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            const actualizarStockStmt = db.prepare(`
                UPDATE productos 
                SET stock = stock + ?, costo = ?, ultima_modificacion = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            
            const movimientoStmt = db.prepare(`
                INSERT INTO movimientos_inventario (
                    producto_id, tipo, cantidad, motivo, notas, usuario_id
                ) VALUES (?, 'entrada', ?, ?, ?, ?)
            `);
            
            for (const detalle of compra.detalles) {
                // Insertar detalle de compra
                detalleStmt.run(
                    compraId,
                    detalle.producto_id,
                    detalle.cantidad,
                    detalle.precio_unitario,
                    detalle.costo_final || detalle.precio_unitario,
                    detalle.itbis || 0.18,
                    detalle.subtotal
                );
                
                // Solo actualizar stock si la compra está "recibida"
                if (compra.estado === 'recibida') {
                    // Actualizar stock y costo del producto
                    actualizarStockStmt.run(
                        detalle.cantidad,
                        detalle.costo_final || detalle.precio_unitario,
                        detalle.producto_id
                    );
                    
                    // Registrar movimiento de inventario
                    movimientoStmt.run(
                        detalle.producto_id,
                        detalle.cantidad,
                        'Compra',
                        `Compra #${compraId} - ${compra.numero_factura}`,
                        compra.usuario_id
                    );
                }
            }
            
            return compraId;
        });
        
        const result = transaction();
        
        // Registrar en flujo de efectivo si está pagada
        if (compra.estado === 'pagada') {
            await this.registrarFlujoPago(result, compra.total, compra.usuario_id);
        }
        
        return { id: result, success: true };
    }
    
    static async getAll(filters = {}) {
        const db = getDB();
        let query = `
            SELECT c.*, p.nombre as proveedor_nombre, p.contacto as proveedor_contacto
            FROM compras c
            JOIN proveedores p ON c.proveedor_id = p.id
            WHERE 1=1
        `;
        const params = [];
        
        if (filters.estado) {
            query += ' AND c.estado = ?';
            params.push(filters.estado);
        }
        
        if (filters.proveedor_id) {
            query += ' AND c.proveedor_id = ?';
            params.push(filters.proveedor_id);
        }
        
        if (filters.fecha_inicio && filters.fecha_fin) {
            query += ' AND c.fecha_compra BETWEEN ? AND ?';
            params.push(filters.fecha_inicio, filters.fecha_fin);
        }
        
        query += ' ORDER BY c.fecha_compra DESC, c.fecha_creacion DESC';
        
        const stmt = db.prepare(query);
        return stmt.all(...params);
    }
    
    static async getById(id) {
        const db = getDB();
        const compraStmt = db.prepare(`
            SELECT c.*, p.nombre as proveedor_nombre, p.contacto as proveedor_contacto,
                   p.telefono as proveedor_telefono, p.email as proveedor_email
            FROM compras c
            JOIN proveedores p ON c.proveedor_id = p.id
            WHERE c.id = ?
        `);
        
        const compra = compraStmt.get(id);
        if (!compra) return null;
        
        // Obtener detalles
        const detallesStmt = db.prepare(`
            SELECT cd.*, prod.nombre as producto_nombre, prod.codigo_barra
            FROM compra_detalles cd
            JOIN productos prod ON cd.producto_id = prod.id
            WHERE cd.compra_id = ?
        `);
        
        compra.detalles = detallesStmt.all(id);
        
        return compra;
    }
    
    // Marcar compra como recibida y actualizar inventario
    static async markAsReceived(id, usuario_id) {
        const db = getDB();
        
        const transaction = db.transaction(() => {
            // 1. Actualizar estado de la compra
            const updateCompraStmt = db.prepare(`
                UPDATE compras 
                SET estado = 'recibida', ultima_modificacion = CURRENT_TIMESTAMP
                WHERE id = ? AND estado = 'pendiente'
            `);
            
            const result = updateCompraStmt.run(id);
            if (result.changes === 0) {
                throw new Error('Compra no encontrada o ya procesada');
            }
            
            // 2. Obtener detalles de la compra
            const detallesStmt = db.prepare(`
                SELECT * FROM compra_detalles WHERE compra_id = ?
            `);
            const detalles = detallesStmt.all(id);
            
            // 3. Actualizar stock y costos
            const actualizarStockStmt = db.prepare(`
                UPDATE productos 
                SET stock = stock + ?, costo = ?, ultima_modificacion = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            
            const movimientoStmt = db.prepare(`
                INSERT INTO movimientos_inventario (
                    producto_id, tipo, cantidad, motivo, notas, usuario_id
                ) VALUES (?, 'entrada', ?, 'Recepción de compra', ?, ?)
            `);
            
            for (const detalle of detalles) {
                // Actualizar stock y costo
                actualizarStockStmt.run(
                    detalle.cantidad,
                    detalle.costo_final,
                    detalle.producto_id
                );
                
                // Registrar movimiento
                movimientoStmt.run(
                    detalle.producto_id,
                    detalle.cantidad,
                    `Compra #${id} recibida`,
                    usuario_id
                );
            }
            
            return result.changes;
        });
        
        const result = transaction();
        return { success: result > 0 };
    }
    
    // Marcar compra como pagada
    static async markAsPaid(id, fecha_pago, usuario_id) {
        const db = getDB();
        
        const updateStmt = db.prepare(`
            UPDATE compras 
            SET estado = 'pagada', fecha_pago = ?
            WHERE id = ?
        `);
        
        const result = updateStmt.run(fecha_pago, id);
        
        if (result.changes > 0) {
            // Obtener monto para registro de flujo
            const compra = db.prepare('SELECT total FROM compras WHERE id = ?').get(id);
            await this.registrarFlujoPago(id, compra.total, usuario_id);
        }
        
        return { success: result.changes > 0 };
    }
    
    // Registrar pago en flujo de efectivo
    static async registrarFlujoPago(compraId, monto, usuarioId) {
        const db = getDB();
        const stmt = db.prepare(`
            INSERT INTO flujo_efectivo (
                tipo, concepto, categoria, monto, fecha,
                referencia_id, referencia_tipo, descripcion, usuario_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
            'operativo',
            'Pago a proveedor',
            'compra',
            -monto, // Negativo porque es salida de efectivo
            new Date().toISOString().split('T')[0],
            compraId,
            'compra',
            `Pago de compra #${compraId}`,
            usuarioId
        );
    }
    
    static async delete(id) {
        const db = getDB();
        
        const transaction = db.transaction(() => {
            // 1. Verificar que la compra se puede eliminar
            const compra = db.prepare('SELECT estado FROM compras WHERE id = ?').get(id);
            if (!compra) {
                throw new Error('Compra no encontrada');
            }
            
            if (compra.estado === 'recibida' || compra.estado === 'pagada') {
                throw new Error('No se puede eliminar una compra que ya fue recibida o pagada');
            }
            
            // 2. Eliminar detalles
            const deleteDetallesStmt = db.prepare('DELETE FROM compra_detalles WHERE compra_id = ?');
            deleteDetallesStmt.run(id);
            
            // 3. Eliminar compra
            const deleteCompraStmt = db.prepare('DELETE FROM compras WHERE id = ?');
            const result = deleteCompraStmt.run(id);
            
            return result.changes;
        });
        
        const result = transaction();
        return { success: result > 0 };
    }
    
    // Obtener estadísticas de compras
    static async getStatistics(fechaInicio, fechaFin) {
        const db = getDB();
        
        const statsStmt = db.prepare(`
            SELECT 
                COUNT(*) as total_compras,
                SUM(total) as monto_total,
                SUM(CASE WHEN estado = 'pendiente' THEN total ELSE 0 END) as pendientes,
                SUM(CASE WHEN estado = 'recibida' THEN total ELSE 0 END) as recibidas,
                SUM(CASE WHEN estado = 'pagada' THEN total ELSE 0 END) as pagadas,
                AVG(total) as promedio_compra
            FROM compras
            WHERE fecha_compra BETWEEN ? AND ?
        `);
        
        const stats = statsStmt.get(fechaInicio, fechaFin);
        
        // Compras por proveedor
        const proveedoresStmt = db.prepare(`
            SELECT p.nombre, COUNT(*) as cantidad, SUM(c.total) as monto
            FROM compras c
            JOIN proveedores p ON c.proveedor_id = p.id
            WHERE c.fecha_compra BETWEEN ? AND ?
            GROUP BY p.id, p.nombre
            ORDER BY monto DESC
            LIMIT 10
        `);
        
        stats.por_proveedor = proveedoresStmt.all(fechaInicio, fechaFin);
        
        return stats;
    }
    
    // Obtener productos más comprados
    static async getTopPurchasedProducts(fechaInicio, fechaFin, limit = 10) {
        const db = getDB();
        
        const stmt = db.prepare(`
            SELECT 
                p.nombre,
                p.codigo_barra,
                SUM(cd.cantidad) as cantidad_total,
                SUM(cd.subtotal) as monto_total,
                AVG(cd.precio_unitario) as precio_promedio,
                COUNT(DISTINCT c.id) as compras
            FROM compra_detalles cd
            JOIN compras c ON cd.compra_id = c.id
            JOIN productos p ON cd.producto_id = p.id
            WHERE c.fecha_compra BETWEEN ? AND ?
            GROUP BY p.id, p.nombre, p.codigo_barra
            ORDER BY cantidad_total DESC
            LIMIT ?
        `);
        
        return stmt.all(fechaInicio, fechaFin, limit);
    }
}

export default ComprasDAO;