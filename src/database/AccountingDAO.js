// AccountingDAO.js - Manejo de datos contables completos
import { getDB } from './db.js';

class AccountingDAO {
    // =====================================================
    // ACTIVOS
    // =====================================================
    static async createAsset(asset) {
        const db = getDB();
        const stmt = db.prepare(`
            INSERT INTO activos (
                nombre, tipo, categoria, valor_inicial, valor_actual, 
                vida_util_anos, fecha_adquisicion, descripcion, usuario_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            asset.nombre,
            asset.tipo,
            asset.categoria,
            asset.valor_inicial,
            asset.valor_actual || asset.valor_inicial,
            asset.vida_util_anos || 0,
            asset.fecha_adquisicion,
            asset.descripcion,
            asset.usuario_id
        );
        
        return { id: result.lastInsertRowid, success: true };
    }

    static async getAssets(filters = {}) {
        const db = getDB();
        let query = 'SELECT * FROM activos WHERE activo = 1';
        const params = [];

        if (filters.tipo) {
            query += ' AND tipo = ?';
            params.push(filters.tipo);
        }

        if (filters.categoria) {
            query += ' AND categoria = ?';
            params.push(filters.categoria);
        }

        query += ' ORDER BY fecha_creacion DESC';
        
        const stmt = db.prepare(query);
        return stmt.all(...params);
    }

    static async updateAssetDepreciation(id, depreciacion_acumulada, valor_actual) {
        const db = getDB();
        const stmt = db.prepare(`
            UPDATE activos 
            SET depreciacion_acumulada = ?, valor_actual = ?, ultima_modificacion = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        const result = stmt.run(depreciacion_acumulada, valor_actual, id);
        return { success: result.changes > 0 };
    }

    // =====================================================
    // PASIVOS
    // =====================================================
    static async createLiability(liability) {
        const db = getDB();
        const stmt = db.prepare(`
            INSERT INTO pasivos (
                nombre, tipo, categoria, monto, saldo_pendiente,
                fecha_vencimiento, proveedor_id, descripcion, usuario_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            liability.nombre,
            liability.tipo,
            liability.categoria,
            liability.monto,
            liability.saldo_pendiente || liability.monto,
            liability.fecha_vencimiento,
            liability.proveedor_id,
            liability.descripcion,
            liability.usuario_id
        );
        
        return { id: result.lastInsertRowid, success: true };
    }

    static async getLiabilities(filters = {}) {
        const db = getDB();
        let query = `
            SELECT p.*, pr.nombre as proveedor_nombre 
            FROM pasivos p 
            LEFT JOIN proveedores pr ON p.proveedor_id = pr.id 
            WHERE 1=1
        `;
        const params = [];

        if (filters.tipo) {
            query += ' AND p.tipo = ?';
            params.push(filters.tipo);
        }

        if (filters.estado) {
            query += ' AND p.estado = ?';
            params.push(filters.estado);
        }

        query += ' ORDER BY p.fecha_vencimiento ASC';
        
        const stmt = db.prepare(query);
        return stmt.all(...params);
    }

    static async payLiability(id, monto_pago, usuario_id) {
        const db = getDB();
        
        // Obtener el pasivo actual
        const liability = db.prepare('SELECT * FROM pasivos WHERE id = ?').get(id);
        if (!liability) {
            throw new Error('Pasivo no encontrado');
        }

        const nuevo_saldo = liability.saldo_pendiente - monto_pago;
        const nuevo_estado = nuevo_saldo <= 0 ? 'pagado' : 'pendiente';

        const stmt = db.prepare(`
            UPDATE pasivos 
            SET saldo_pendiente = ?, estado = ?, ultima_modificacion = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        const result = stmt.run(nuevo_saldo, nuevo_estado, id);

        // Registrar en flujo de efectivo
        if (result.changes > 0) {
            await this.addCashFlow({
                tipo: 'operativo',
                concepto: 'Pago de pasivo',
                categoria: 'pago_pasivo',
                monto: -monto_pago,
                referencia_id: id,
                referencia_tipo: 'pasivo',
                descripcion: `Pago de ${liability.nombre}`,
                usuario_id
            });
        }

        return { success: result.changes > 0 };
    }

    // =====================================================
    // PATRIMONIO
    // =====================================================
    static async addEquity(equity) {
        const db = getDB();
        const stmt = db.prepare(`
            INSERT INTO patrimonio (concepto, tipo, monto, fecha, descripcion, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            equity.concepto,
            equity.tipo,
            equity.monto,
            equity.fecha,
            equity.descripcion,
            equity.usuario_id
        );
        
        return { id: result.lastInsertRowid, success: true };
    }

    static async getEquity() {
        const db = getDB();
        const stmt = db.prepare('SELECT * FROM patrimonio ORDER BY fecha DESC');
        return stmt.all();
    }

    // =====================================================
    // GASTOS OPERATIVOS
    // =====================================================
    static async createOperatingExpense(expense) {
        const db = getDB();
        const stmt = db.prepare(`
            INSERT INTO gastos_operativos (
                descripcion, categoria, subcategoria, monto, fecha,
                metodo_pago, proveedor_id, comprobante, deducible_impuestos,
                notas, usuario_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            expense.descripcion,
            expense.categoria,
            expense.subcategoria,
            expense.monto,
            expense.fecha,
            expense.metodo_pago,
            expense.proveedor_id,
            expense.comprobante,
            expense.deducible_impuestos ? 1 : 0,
            expense.notas,
            expense.usuario_id
        );

        // Registrar en flujo de efectivo
        await this.addCashFlow({
            tipo: 'operativo',
            concepto: expense.descripcion,
            categoria: 'gasto_operativo',
            monto: -expense.monto,
            referencia_id: result.lastInsertRowid,
            referencia_tipo: 'gasto_operativo',
            descripcion: `Gasto: ${expense.descripcion}`,
            usuario_id: expense.usuario_id
        });
        
        return { id: result.lastInsertRowid, success: true };
    }

    static async getOperatingExpenses(filters = {}) {
        const db = getDB();
        let query = `
            SELECT go.*, pr.nombre as proveedor_nombre 
            FROM gastos_operativos go 
            LEFT JOIN proveedores pr ON go.proveedor_id = pr.id 
            WHERE go.estado = 'pagado'
        `;
        const params = [];

        if (filters.fecha_inicio && filters.fecha_fin) {
            query += ' AND go.fecha BETWEEN ? AND ?';
            params.push(filters.fecha_inicio, filters.fecha_fin);
        }

        if (filters.categoria) {
            query += ' AND go.categoria = ?';
            params.push(filters.categoria);
        }

        query += ' ORDER BY go.fecha DESC';
        
        const stmt = db.prepare(query);
        return stmt.all(...params);
    }

    // =====================================================
    // FLUJO DE EFECTIVO
    // =====================================================
    static async addCashFlow(flow) {
        const db = getDB();
        const stmt = db.prepare(`
            INSERT INTO flujo_efectivo (
                tipo, concepto, categoria, monto, fecha,
                referencia_id, referencia_tipo, descripcion, usuario_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            flow.tipo,
            flow.concepto,
            flow.categoria,
            flow.monto,
            flow.fecha || new Date().toISOString().split('T')[0],
            flow.referencia_id,
            flow.referencia_tipo,
            flow.descripcion,
            flow.usuario_id
        );
        
        return { id: result.lastInsertRowid, success: true };
    }

    static async getCashFlow(filters = {}) {
        const db = getDB();
        let query = 'SELECT * FROM flujo_efectivo WHERE 1=1';
        const params = [];

        if (filters.tipo) {
            query += ' AND tipo = ?';
            params.push(filters.tipo);
        }

        if (filters.fecha_inicio && filters.fecha_fin) {
            query += ' AND fecha BETWEEN ? AND ?';
            params.push(filters.fecha_inicio, filters.fecha_fin);
        }

        query += ' ORDER BY fecha DESC, fecha_creacion DESC';
        
        const stmt = db.prepare(query);
        return stmt.all(...params);
    }

    // =====================================================
    // REPORTES FINANCIEROS INTEGRADOS
    // =====================================================
    
    // Balance General
    static async getBalanceSheet(fecha = null) {
        const db = getDB();
        const fechaFiltro = fecha || new Date().toISOString().split('T')[0];
        
        // Activos
        const activosCorrientes = db.prepare(`
            SELECT SUM(valor_actual) as total 
            FROM activos 
            WHERE tipo = 'corriente' AND activo = 1 AND fecha_adquisicion <= ?
        `).get(fechaFiltro).total || 0;

        const activosFijos = db.prepare(`
            SELECT SUM(valor_actual) as total 
            FROM activos 
            WHERE tipo = 'fijo' AND activo = 1 AND fecha_adquisicion <= ?
        `).get(fechaFiltro).total || 0;

        // Efectivo en caja
        const efectivoVentas = db.prepare(`
            SELECT SUM(total) as total 
            FROM ventas 
            WHERE DATE(fecha_venta) <= ? AND metodo_pago = 'Efectivo'
        `).get(fechaFiltro).total || 0;

        const efectivoGastos = db.prepare(`
            SELECT SUM(monto) as total 
            FROM gastos_operativos 
            WHERE DATE(fecha) <= ? AND metodo_pago = 'Efectivo'
        `).get(fechaFiltro).total || 0;

        // Inventario (activo corriente)
        const inventario = db.prepare(`
            SELECT SUM(stock * costo) as total 
            FROM productos 
            WHERE borrado = 0
        `).get().total || 0;

        // Pasivos
        const pasivosCorrientes = db.prepare(`
            SELECT SUM(saldo_pendiente) as total 
            FROM pasivos 
            WHERE tipo = 'corriente' AND estado != 'pagado'
        `).get().total || 0;

        const pasivosLargoPlazo = db.prepare(`
            SELECT SUM(saldo_pendiente) as total 
            FROM pasivos 
            WHERE tipo = 'largo_plazo' AND estado != 'pagado'
        `).get().total || 0;

        // Patrimonio
        const patrimonio = db.prepare(`
            SELECT SUM(monto) as total 
            FROM patrimonio 
            WHERE fecha <= ?
        `).get(fechaFiltro).total || 0;

        // Utilidades retenidas (ventas - gastos)
        const totalVentas = db.prepare(`
            SELECT SUM(total) as total 
            FROM ventas 
            WHERE DATE(fecha_venta) <= ?
        `).get(fechaFiltro).total || 0;

        const totalGastos = db.prepare(`
            SELECT SUM(monto) as total 
            FROM gastos_operativos 
            WHERE fecha <= ?
        `).get(fechaFiltro).total || 0;

        const utilidadEjercicio = totalVentas - totalGastos;
        
        const efectivoNeto = efectivoVentas - efectivoGastos;
        const totalActivosCorrientes = activosCorrientes + efectivoNeto + inventario;
        const totalActivos = totalActivosCorrientes + activosFijos;
        const totalPasivos = pasivosCorrientes + pasivosLargoPlazo;
        const totalPatrimonio = patrimonio + utilidadEjercicio;

        return {
            activos: {
                corrientes: {
                    efectivo: efectivoNeto,
                    inventario: inventario,
                    otros: activosCorrientes,
                    total: totalActivosCorrientes
                },
                fijos: {
                    propiedades: activosFijos,
                    total: activosFijos
                },
                total: totalActivos
            },
            pasivos: {
                corrientes: pasivosCorrientes,
                largo_plazo: pasivosLargoPlazo,
                total: totalPasivos
            },
            patrimonio: {
                capital: patrimonio,
                utilidades_retenidas: utilidadEjercicio,
                total: totalPatrimonio
            },
            fecha: fechaFiltro,
            balanceado: Math.abs(totalActivos - (totalPasivos + totalPatrimonio)) < 0.01
        };
    }

    // Estado de Resultados
    static async getIncomeStatement(fechaInicio, fechaFin) {
        const db = getDB();
        
        // Ingresos
        const ventasStmt = db.prepare(`
            SELECT 
                SUM(total) as ventas_brutas,
                SUM(descuento) as descuentos,
                SUM(impuestos) as impuestos
            FROM ventas 
            WHERE DATE(fecha_venta) BETWEEN ? AND ?
        `);
        const ventas = ventasStmt.get(fechaInicio, fechaFin);
        
        const ventasNetas = (ventas.ventas_brutas || 0) - (ventas.descuentos || 0);
        
        // Costo de productos vendidos
        const costoProductosStmt = db.prepare(`
            SELECT SUM(vd.cantidad * p.costo) as costo_productos
            FROM venta_detalles vd
            JOIN productos p ON vd.producto_id = p.id
            JOIN ventas v ON vd.venta_id = v.id
            WHERE DATE(v.fecha_venta) BETWEEN ? AND ?
        `);
        const costoProductos = costoProductosStmt.get(fechaInicio, fechaFin).costo_productos || 0;
        
        // Utilidad bruta
        const utilidadBruta = ventasNetas - costoProductos;
        
        // Gastos operativos por categoría
        const gastosStmt = db.prepare(`
            SELECT categoria, SUM(monto) as total
            FROM gastos_operativos 
            WHERE fecha BETWEEN ? AND ? AND estado = 'pagado'
            GROUP BY categoria
        `);
        const gastosPorCategoria = gastosStmt.all(fechaInicio, fechaFin);
        
        const totalGastosOperativos = gastosPorCategoria.reduce((sum, gasto) => sum + (gasto.total || 0), 0);
        
        // Utilidad operativa
        const utilidadOperativa = utilidadBruta - totalGastosOperativos;
        
        // Utilidad neta (sin considerar impuestos por ahora)
        const utilidadNeta = utilidadOperativa;

        return {
            periodo: { inicio: fechaInicio, fin: fechaFin },
            ingresos: {
                ventas_brutas: ventas.ventas_brutas || 0,
                descuentos: ventas.descuentos || 0,
                ventas_netas: ventasNetas,
                impuestos_cobrados: ventas.impuestos || 0
            },
            costos: {
                productos_vendidos: costoProductos
            },
            utilidad_bruta: utilidadBruta,
            gastos_operativos: {
                por_categoria: gastosPorCategoria,
                total: totalGastosOperativos
            },
            utilidad_operativa: utilidadOperativa,
            utilidad_neta: utilidadNeta,
            margen_bruto: ventasNetas > 0 ? (utilidadBruta / ventasNetas * 100) : 0,
            margen_neto: ventasNetas > 0 ? (utilidadNeta / ventasNetas * 100) : 0
        };
    }

    // Estado de Flujo de Efectivo
    static async getCashFlowStatement(fechaInicio, fechaFin) {
        const db = getDB();
        
        // Flujos operativos
        const operativosStmt = db.prepare(`
            SELECT SUM(monto) as total 
            FROM flujo_efectivo 
            WHERE tipo = 'operativo' AND fecha BETWEEN ? AND ?
        `);
        const flujosOperativos = operativosStmt.get(fechaInicio, fechaFin).total || 0;
        
        // Flujos de inversión
        const inversionStmt = db.prepare(`
            SELECT SUM(monto) as total 
            FROM flujo_efectivo 
            WHERE tipo = 'inversion' AND fecha BETWEEN ? AND ?
        `);
        const flujosInversion = inversionStmt.get(fechaInicio, fechaFin).total || 0;
        
        // Flujos de financiamiento
        const financiamientoStmt = db.prepare(`
            SELECT SUM(monto) as total 
            FROM flujo_efectivo 
            WHERE tipo = 'financiamiento' AND fecha BETWEEN ? AND ?
        `);
        const flujosFinanciamiento = financiamientoStmt.get(fechaInicio, fechaFin).total || 0;
        
        // Efectivo inicial (ventas menos gastos hasta fecha inicio)
        const efectivoInicialVentas = db.prepare(`
            SELECT SUM(total) as total 
            FROM ventas 
            WHERE DATE(fecha_venta) < ? AND metodo_pago = 'Efectivo'
        `).get(fechaInicio).total || 0;
        
        const efectivoInicialGastos = db.prepare(`
            SELECT SUM(monto) as total 
            FROM gastos_operativos 
            WHERE fecha < ? AND metodo_pago = 'Efectivo'
        `).get(fechaInicio).total || 0;
        
        const efectivoInicial = efectivoInicialVentas - efectivoInicialGastos;
        
        // Cambio neto en efectivo
        const cambioNeto = flujosOperativos + flujosInversion + flujosFinanciamiento;
        const efectivoFinal = efectivoInicial + cambioNeto;

        return {
            periodo: { inicio: fechaInicio, fin: fechaFin },
            efectivo_inicial: efectivoInicial,
            flujos: {
                operativos: flujosOperativos,
                inversion: flujosInversion,
                financiamiento: flujosFinanciamiento
            },
            cambio_neto: cambioNeto,
            efectivo_final: efectivoFinal
        };
    }
}

export default AccountingDAO;