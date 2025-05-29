// src/database/index.js
import { app, ipcMain } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Database imports
import { initDB, prepareTable, migrateDatabase, closeDB, getDB } from './db.js';
import {
    UsuarioDAO, ProductoDAO, CategoriaDAO, ProveedorDAO,
    VentaDAO, GastoDAO, ResumenDAO, CajaDAO, ConfiguracionDAO,
    MovimientoDAO
} from './dao.js';

export {
    closeDB,
    initializeDatabase,
    setupIpcHandlers
};

// Set up directory paths
const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Log app startup info
console.log("🚀 Starting WilPOS database module");
console.log("📂 Database Path:", __dirname);
console.log("🔧 Dev Mode:", isDev);

// =====================================================
// Database Initialization
// =====================================================

async function initializeDatabase() {
    try {
        console.log("🔄 Initializing database...");

        // Set up database path
        const userDataPath = app.getPath('userData');
        const dbPath = join(userDataPath, 'wilpos.db');
        console.log(`📁 Database location: ${dbPath}`);

        // Initialize database connection
        initDB(dbPath);

        // Run migrations and prepare tables
        await migrateDatabase();

        // Prepare all tables
        const tables = [
            'usuarios',
            'categorias',
            'productos',
            'proveedores',
            'clientes',
            'ventas',
            'venta_detalles',
            'resumen_diario',
            'gastos',
            'movimientos_inventario',
            'configuracion',
            'caja_sesiones',
            'caja_transacciones'
        ];

        for (const table of tables) {
            prepareTable(table);
        }

        // Check if any users exist in the database
        const db = getDB();
        const userCount = db.prepare('SELECT COUNT(*) as count FROM usuarios').get().count;

        // If no users exist, create a default admin user
        if (userCount === 0) {
            console.log("🔐 Creating default admin user...");

            // Create default admin user with expanded permissions
            await UsuarioDAO.create({
                nombre: 'Administrador',
                usuario: 'admin',
                clave: 'admin',
                rol: 'admin',
                permisos: {
                    usuarios: { lectura: true, escritura: true },
                    productos: { lectura: true, escritura: true },
                    ventas: { lectura: true, escritura: true },
                    inventario: { lectura: true, escritura: true },
                    facturas: { lectura: true, escritura: true },
                    reportes: { lectura: true, escritura: true },
                    dashboard: { lectura: true, escritura: true },
                    caja: { lectura: true, escritura: true },
                    configuracion: { lectura: true, escritura: true }
                }
            });

            console.log("✅ Default admin user created successfully");
        }

        console.log("✅ Database initialized successfully");
        return { success: true };
    } catch (error) {
        console.error("❌ Database initialization error:", error);
        return { success: false, error: error.message };
    }
}

// =====================================================
// IPC Handlers for Database Operations Only
// =====================================================

function setupIpcHandlers() {
    // Create a generic handler wrapper with consistent error handling
    const createHandler = (operation, handler) => {
        return async (event, ...args) => {
            try {
                return await handler(...args);
            } catch (error) {
                console.error(`Error in ${operation}:`, error);
                return { success: false, error: error.message };
            }
        };
    };

    // Database initialization
    ipcMain.handle('initialize-database', createHandler('initialize-database', initializeDatabase));

    // Authentication handlers
    ipcMain.handle('login', createHandler('login', async (credentials) => {
        const user = await UsuarioDAO.getByUsername(credentials.username);

        if (!user) {
            return { success: false, message: "Usuario no encontrado" };
        }

        // In production, you should use proper password hashing
        // This is a simple example for development purposes
        const isValidPassword = (credentials.username === 'admin' && credentials.password === 'admin') ||
            credentials.password === user.clave;

        if (isValidPassword) {
            return {
                success: true,
                user: {
                    id: user.id,
                    nombre: user.nombre,
                    usuario: user.usuario,
                    rol: user.rol,
                    permisos: typeof user.permisos === 'string' ? JSON.parse(user.permisos) : user.permisos,
                    activo: user.activo,
                    fecha_creacion: user.fecha_creacion
                }
            };
        } else {
            return { success: false, message: "Contraseña incorrecta" };
        }
    }));

    ipcMain.handle('logout', () => ({ success: true }));

    // Usuario handlers
    // Handler for get users
    ipcMain.handle('usuarios:obtener', async () => {
      try {
        // Call your database function to get users
        const users = await UsuarioDAO.getAll();
        return users;
      } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
      }
    });
    
    // Handler for create users
    ipcMain.handle('usuarios:insertar', async (event, userData) => {
      try {
        // Call your database function to add a user
        const result = await UsuarioDAO.create(userData);
        return { success: true, id: result.id };
      } catch (error) {
        console.error('Error creating user:', error);
        return { success: false, error: error.message };
      }
    });
    
    // User update handler
    ipcMain.handle('usuarios:actualizar', async (event, id, userData) => {
      try {
        // Make sure to import UsuarioDAO or access it properly
        if (!UsuarioDAO || typeof UsuarioDAO.update !== 'function') {
          console.error('UsuarioDAO not available or missing update method');
          return { 
            success: false, 
            error: 'Internal server error: User update function not available' 
          };
        }
        
        // Call database function to update user
        const result = await UsuarioDAO.update(id, userData);
        
        if (result) {
          return { 
            success: true, 
            message: 'Usuario actualizado correctamente' 
          };
        } else {
          return { 
            success: false, 
            error: 'No se pudo actualizar el usuario' 
          };
        }
      } catch (error) {
        console.error('Error updating user:', error);
        return { 
          success: false, 
          error: error.message || 'Error desconocido al actualizar usuario' 
        };
      }
    });
    
    // User delete handler
    ipcMain.handle('usuarios:eliminar', async (event, id) => {
      try {
        // Make sure to import UsuarioDAO or access it properly
        if (!UsuarioDAO || typeof UsuarioDAO.delete !== 'function') {
          console.error('UsuarioDAO not available or missing delete method');
          return { 
            success: false, 
            error: 'Internal server error: User delete function not available' 
          };
        }
        
        // Call database function to delete user
        const result = await UsuarioDAO.delete(id);
        
        if (result) {
          return { 
            success: true, 
            message: 'Usuario eliminado correctamente' 
          };
        } else {
          return { 
            success: false, 
            error: 'No se pudo eliminar el usuario' 
          };
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        return { 
          success: false, 
          error: error.message || 'Error desconocido al eliminar usuario' 
        };
      }
    });
    
    ipcMain.handle('usuarios:obtenerPorId', createHandler('usuarios:obtenerPorId', (id) => UsuarioDAO.getById(id)));
    ipcMain.handle('usuarios:activar', createHandler('usuarios:activar', (id, activo) => UsuarioDAO.toggleActive(id, activo)));

    // Categoría handlers
    ipcMain.handle('categorias:obtener', createHandler('categorias:obtener', () => CategoriaDAO.getAll()));
    ipcMain.handle('categorias:obtenerPorId', createHandler('categorias:obtenerPorId', (id) => CategoriaDAO.getById(id)));
    ipcMain.handle('categorias:insertar', createHandler('categorias:insertar', (categoria) => CategoriaDAO.create(categoria)));
    ipcMain.handle('categorias:actualizar', createHandler('categorias:actualizar', (id, data) => CategoriaDAO.update(id, data)));
    ipcMain.handle('categorias:eliminar', createHandler('categorias:eliminar', (id) => CategoriaDAO.delete(id)));

    // Producto handlers
    ipcMain.handle('productos:obtener', createHandler('productos:obtener', () => ProductoDAO.getAll()));
    ipcMain.handle('productos:obtenerPorId', createHandler('productos:obtenerPorId', (id) => ProductoDAO.getById(id)));
    ipcMain.handle('productos:buscar', createHandler('productos:buscar', (termino, opciones) => ProductoDAO.search(termino, opciones)));
    ipcMain.handle('productos:obtenerPorCodigoBarra', createHandler('productos:obtenerPorCodigoBarra', (codigo) => ProductoDAO.getByBarcode(codigo)));
    ipcMain.handle('productos:obtenerBajoStock', createHandler('productos:obtenerBajoStock', (limite) => ProductoDAO.getLowStock(limite)));
    ipcMain.handle('productos:insertar', createHandler('productos:insertar', (producto) => ProductoDAO.create(producto)));
    ipcMain.handle('productos:actualizar', createHandler('productos:actualizar', (id, data) => ProductoDAO.update(id, data)));
    ipcMain.handle('productos:eliminar', createHandler('productos:eliminar', (id) => ProductoDAO.delete(id)));
    ipcMain.handle('productos:actualizarStock', createHandler('productos:actualizarStock', (id, cantidad, motivo, usuarioId) => ProductoDAO.updateStock(id, cantidad, motivo, usuarioId)));

    // Proveedor handlers
    ipcMain.handle('proveedores:obtener', createHandler('proveedores:obtener', () => ProveedorDAO.getAll()));
    ipcMain.handle('proveedores:obtenerPorId', createHandler('proveedores:obtenerPorId', (id) => ProveedorDAO.getById(id)));
    ipcMain.handle('proveedores:insertar', createHandler('proveedores:insertar', (proveedor) => ProveedorDAO.create(proveedor)));
    ipcMain.handle('proveedores:actualizar', createHandler('proveedores:actualizar', (id, data) => ProveedorDAO.update(id, data)));

    // Cliente handlers
    ipcMain.handle('clientes:obtener', createHandler('clientes:obtener', () => {
        const db = getDB();
        return db.prepare('SELECT * FROM clientes WHERE activo = 1 ORDER BY nombre').all();
    }));

    ipcMain.handle('clientes:obtenerPorId', createHandler('clientes:obtenerPorId', (id) => {
        const db = getDB();
        return db.prepare('SELECT * FROM clientes WHERE id = ? AND activo = 1').get(id);
    }));

    ipcMain.handle('clientes:insertar', createHandler('clientes:insertar', (cliente) => {
        const db = getDB();
        try {
            const stmt = db.prepare(`
                INSERT INTO clientes (
                    nombre, 
                    documento, 
                    telefono, 
                    email, 
                    direccion, 
                    notas
                ) VALUES (?, ?, ?, ?, ?, ?)
            `);

            const result = stmt.run(
                cliente.nombre,
                cliente.documento || null,
                cliente.telefono || null,
                cliente.email || null,
                cliente.direccion || null,
                cliente.notas || null
            );

            return { id: result.lastInsertRowid, success: true };
        } catch (error) {
            console.error('Error creating client:', error);
            throw error;
        }
    }));

    ipcMain.handle('clientes:actualizar', createHandler('clientes:actualizar', (id, data) => {
        const db = getDB();
        
        // Build dynamic update query for optional fields
        const updates = [];
        const params = [];

        if ('nombre' in data) {
            updates.push('nombre = ?');
            params.push(data.nombre);
        }

        if ('documento' in data) {
            updates.push('documento = ?');
            params.push(data.documento);
        }

        if ('telefono' in data) {
            updates.push('telefono = ?');
            params.push(data.telefono);
        }

        if ('email' in data) {
            updates.push('email = ?');
            params.push(data.email);
        }

        if ('direccion' in data) {
            updates.push('direccion = ?');
            params.push(data.direccion);
        }

        if ('notas' in data) {
            updates.push('notas = ?');
            params.push(data.notas);
        }

        if ('activo' in data) {
            updates.push('activo = ?');
            params.push(data.activo);
        }

        updates.push('ultima_modificacion = ?');
        params.push(new Date().toISOString());

        params.push(id); // Add ID for WHERE clause

        const query = `
            UPDATE clientes 
            SET ${updates.join(', ')}
            WHERE id = ?
        `;

        try {
            const result = db.prepare(query).run(...params);
            return result.changes > 0;
        } catch (error) {
            console.error('Error updating client:', error);
            throw error;
        }
    }));

    ipcMain.handle('clientes:eliminar', createHandler('clientes:eliminar', (id) => {
        const db = getDB();
        try {
            // Soft delete
            const result = db.prepare('UPDATE clientes SET activo = 0 WHERE id = ?').run(id);
            return result.changes > 0;
        } catch (error) {
            console.error('Error deleting client:', error);
            throw error;
        }
    }));

    // Venta handlers
    ipcMain.handle('ventas:detalles', createHandler('ventas:detalles', (id) => VentaDAO.getDetails(id)));
    ipcMain.handle('ventas:reporte', createHandler('ventas:reporte', (fechaInicio, fechaFin) => VentaDAO.getSalesReport(fechaInicio, fechaFin)));
    ipcMain.handle('ventas:productosTop', createHandler('ventas:productosTop', (fechaInicio, fechaFin, limite) => VentaDAO.getTopProducts(fechaInicio, fechaFin, limite)));

    // Gasto handlers
    ipcMain.handle('gastos:obtener', createHandler('gastos:obtener', () => GastoDAO.getAll()));
    ipcMain.handle('gastos:obtenerPorId', createHandler('gastos:obtenerPorId', (id) => GastoDAO.getById(id)));
    ipcMain.handle('gastos:insertar', createHandler('gastos:insertar', (gasto) => GastoDAO.create(gasto)));
    ipcMain.handle('gastos:obtenerPorFechas', createHandler('gastos:obtenerPorFechas', (fechaInicio, fechaFin) => GastoDAO.getByDateRange(fechaInicio, fechaFin)));

    // Resumen handlers
    ipcMain.handle('resumen:obtenerDiario', createHandler('resumen:obtenerDiario', (fecha) => ResumenDAO.getDailySummary(fecha)));
    ipcMain.handle('resumen:obtenerPorFechas', createHandler('resumen:obtenerPorFechas', (fechaInicio, fechaFin) => ResumenDAO.getByDateRange(fechaInicio, fechaFin)));
    ipcMain.handle('resumen:estadisticas', createHandler('resumen:estadisticas', (dias) => ResumenDAO.getSummaryStats(dias)));

    // Caja handlers
    ipcMain.handle('caja:obtenerSesionAbierta', createHandler('caja:obtenerSesionAbierta', () => CajaDAO.getOpenSession()));
    ipcMain.handle('caja:abrirSesion', createHandler('caja:abrirSesion', (datos) => CajaDAO.openSession(datos)));
    ipcMain.handle('caja:cerrarSesion', createHandler('caja:cerrarSesion', (id, datos) => CajaDAO.closeSession(id, datos)));
    ipcMain.handle('caja:agregarTransaccion', createHandler('caja:agregarTransaccion', (transaccion) => CajaDAO.addTransaction(transaccion)));
    ipcMain.handle('caja:obtenerTransacciones', createHandler('caja:obtenerTransacciones', (sessionId) => CajaDAO.getSessionTransactions(sessionId)));
    ipcMain.handle('caja:obtenerBalance', createHandler('caja:obtenerBalance', (sessionId) => CajaDAO.getSessionBalance(sessionId)));
    ipcMain.handle('caja:sesionesRecientes', createHandler('caja:sesionesRecientes', (limit) => CajaDAO.getRecentSessions(limit)));

    // Configuración handlers
    ipcMain.handle('configuracion:obtener', createHandler('configuracion:obtener', () => ConfiguracionDAO.getSettings()));
    ipcMain.handle('configuracion:actualizar', createHandler('configuracion:actualizar', (settings) => ConfiguracionDAO.updateSettings(settings)));

    // Movimientos de inventario handlers
    ipcMain.handle('movimientos:obtener', createHandler('movimientos:obtener', () => MovimientoDAO.getAll()));
    ipcMain.handle('movimientos:insertar', createHandler('movimientos:insertar', (movimiento) => MovimientoDAO.create(movimiento)));
    ipcMain.handle('movimientos:obtenerPorProducto', createHandler('movimientos:obtenerPorProducto', (productoId) => MovimientoDAO.getByProductId(productoId)));
    ipcMain.handle('movimientos:obtenerPorFechas', createHandler('movimientos:obtenerPorFechas', (fechaInicio, fechaFin) => MovimientoDAO.getByDateRange(fechaInicio, fechaFin)));

    // Manejadores de Ventas
    ipcMain.handle('ventas:obtener', createHandler('ventas:obtener', (filters) => {
        const { startDate, endDate, page, limit, status, paymentMethod } = filters || {};

        // Construir condiciones de filtro
        let whereConditions = [];
        let params = [];

        if (startDate && endDate) {
            whereConditions.push('v.fecha_venta BETWEEN ? AND ?');
            params.push(startDate, endDate);
        }

        if (status) {
            whereConditions.push('v.estado = ?');
            params.push(status === 'completed' ? 'Completada' : (status === 'cancelled' ? 'Anulada' : status));
        }

        if (paymentMethod) {
            whereConditions.push('v.metodo_pago = ?');
            params.push(paymentMethod);
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Construir consulta con JOIN para incluir cliente
        const query = `
        SELECT 
            v.id, 
            v.cliente_id, 
            c.nombre as cliente, 
            v.total, 
            v.descuento, 
            v.impuestos, 
            v.metodo_pago, 
            v.estado, 
            v.fecha_venta, 
            v.monto_recibido,
            v.cambio,
            u.nombre as usuario
        FROM ventas v
        LEFT JOIN clientes c ON v.cliente_id = c.id
        LEFT JOIN usuarios u ON v.usuario_id = u.id
        ${whereClause}
        ORDER BY v.fecha_venta DESC
        `;

        const db = getDB();

        // Contamos el total antes de aplicar paginación
        const countQuery = `
        SELECT COUNT(*) as total
        FROM ventas v
        ${whereClause}
        `;

        const totalCount = db.prepare(countQuery).get(...params).total;

        // Aplicar paginación
        let paginatedQuery = query;
        if (limit) {
            paginatedQuery += ` LIMIT ?`;
            params.push(limit);

            if (page && page > 1) {
                const offset = (page - 1) * limit;
                paginatedQuery += ` OFFSET ?`;
                params.push(offset);
            }
        }

        const sales = db.prepare(paginatedQuery).all(...params);

        return {
            data: sales,
            total: totalCount
        };
    }));

    ipcMain.handle('ventas:obtenerPorId', createHandler('ventas:obtenerPorId', (id) => {
        if (!id) throw new Error('ID de venta requerido');

        const db = getDB();

        // Consultar la venta con JOIN para incluir cliente y usuario
        const query = `
        SELECT 
            v.*, 
            c.nombre as cliente,
            u.nombre as usuario 
        FROM ventas v
        LEFT JOIN clientes c ON v.cliente_id = c.id
        LEFT JOIN usuarios u ON v.usuario_id = u.id
        WHERE v.id = ?
        `;

        const sale = db.prepare(query).get(id);

        if (!sale) {
            throw new Error(`Venta con ID ${id} no encontrada`);
        }

        // Obtener los detalles
        const detallesQuery = `
        SELECT 
            vd.*,
            p.nombre as name
        FROM venta_detalles vd
        JOIN productos p ON vd.producto_id = p.id
        WHERE vd.venta_id = ?
        `;

        const detalles = db.prepare(detallesQuery).all(id);

        // Mapear los detalles al formato esperado en el frontend
        const mappedDetalles = detalles.map(det => ({
            product_id: det.producto_id,
            name: det.name,
            quantity: det.cantidad,
            price: det.precio_unitario,
            price_without_tax: det.precio_unitario / (1 + (det.itebis || 0.18)),
            subtotal: det.subtotal,
            itebis: det.itebis || 0.18,
            is_exempt: det.itebis === 0,
            discount: det.descuento || 0
        }));

        // Combinar todo en un objeto
        return {
            ...sale,
            detalles: mappedDetalles
        };
    }));

    // Manejadores de Ventas
    ipcMain.handle('ventas:insertar', createHandler('ventas:insertar', async (venta, detalles) => {
        // Check if venta is provided
        if (!venta) throw new Error('Datos de venta requeridos');
        
        // Make sure detalles exists in the request or in the venta object
        let detallesArray = detalles;
        if (!detallesArray || detallesArray.length === 0) {
            // Check if detalles might be inside the venta object
            if (venta.detalles && Array.isArray(venta.detalles) && venta.detalles.length > 0) {
                detallesArray = venta.detalles;
            } else {
                throw new Error('La venta debe tener al menos un detalle');
            }
        }

        try {
            console.log("Starting sale creation with data:", JSON.stringify({
                venta_info: { ...venta, detalles: detallesArray.length + " items" }
            }));

            // Validate payment method
            const validPaymentMethod = ['Efectivo', 'Tarjeta', 'Transferencia'].includes(venta.metodo_pago)
                ? venta.metodo_pago
                : 'Efectivo';

            // Create normalized sale object
            const normalizedVenta = {
                ...venta,
                metodo_pago: validPaymentMethod,
                estado: venta.estado || 'Completada',
                descuento: venta.descuento || 0,
                impuestos: venta.impuestos || 0
            };

            // Create sale in database - pass the detallesArray here
            const result = VentaDAO.create(normalizedVenta, detallesArray);

            // If sale was successful and receipt promise exists
            if (result.success && result.receiptPromise) {
                try {
                    // Wait for receipt generation to complete
                    const receiptResult = await result.receiptPromise;

                    // Add receipt info to result
                    result.receipt = {
                        path: receiptResult.filePath,
                        filename: receiptResult.fileName
                    };

                    // Delete the promise from result before returning
                    delete result.receiptPromise;

                    console.log('Sale creation result with receipt:', result);
                } catch (receiptError) {
                    console.error('Error generating receipt:', receiptError);
                    result.receiptError = 'Error generating receipt';
                    delete result.receiptPromise;
                }
            }

            console.log("Sale creation result:", result);

            if (!result) {
                throw new Error('No se recibió respuesta de la base de datos');
            }

            if (!result.success) {
                throw new Error(result.error || 'Error desconocido al crear venta');
            }

            if (!result.id) {
                throw new Error('No se recibió ID de la venta creada');
            }

            // Fetch the complete sale details to return
            const ventaCompleta = VentaDAO.getById(result.id);
            const detallesVenta = VentaDAO.getDetails(result.id);

            if (!ventaCompleta) {
                throw new Error(`No se pudo obtener la venta con ID ${result.id}`);
            }

            // Return the complete sale with details and success indicator
            return {
                ...ventaCompleta,
                detalles: detallesVenta,
                success: true,
                id: result.id,
                warnings: result.warnings || []
            };
        } catch (error) {
            console.error('Error al crear venta:', error);
            // Return structured error for better client-side handling
            return {
                success: false,
                error: error.message || 'Error desconocido al crear venta',
                details: error.toString()
            };
        }
    }));

    // Add cancel sale functionality
    ipcMain.handle('cancelSale', createHandler('cancelSale', (id) => {
        if (!id) throw new Error('ID de venta requerido');

        try {
            const result = VentaDAO.cancelSale(id);

            if (!result.success) {
                throw new Error(result.error || 'Error al anular venta');
            }

            return result;
        } catch (error) {
            console.error('Error al anular venta:', error);
            throw error;
        }
    }));

    // Report handlers
    ipcMain.handle('reportes:ventas', async (_, startDate, endDate) => {
        try {
            return await getSalesReportData(startDate, endDate);
        } catch (error) {
            console.error('IPC Error - reportes:ventas:', error);
            throw new Error(`Failed to get sales report: ${error.message}`);
        }
    });

    ipcMain.handle('reportes:ventasDiarias', async (_, date) => {
        try {
            // For daily report, we use the same date as start and end
            return await getSalesReportData(date, date);
        } catch (error) {
            console.error('IPC Error - reportes:ventasDiarias:', error);
            throw new Error(`Failed to get daily sales report: ${error.message}`);
        }
    });

    ipcMain.handle('reportes:ventasMensuales', async (_, month, year) => {
        try {
            // Calculate start and end dates for the specified month
            const startDate = `${year}-${month.padStart(2, '0')}-01`;
            const lastDay = new Date(year, parseInt(month), 0).getDate();
            const endDate = `${year}-${month.padStart(2, '0')}-${lastDay}`;

            return await getSalesReportData(startDate, endDate);
        } catch (error) {
            console.error('IPC Error - reportes:ventasMensuales:', error);
            throw new Error(`Failed to get monthly sales report: ${error.message}`);
        }
    });

    ipcMain.handle('reportes:topProductos', async (_, startDate, endDate, limit) => {
        try {
            return await getTopProductsData(startDate, endDate, limit);
        } catch (error) {
            console.error('IPC Error - reportes:topProductos:', error);
            throw new Error(`Failed to get top products: ${error.message}`);
        }
    });

    // Database reset handler (for development/testing)
    if (isDev) {
        ipcMain.handle('db:reset', createHandler('db:reset', async () => {
            try {
                // Close current database connection
                closeDB();

                // Delete database file
                const dbPath = join(app.getPath('userData'), 'wilpos.db');
                if (fs.existsSync(dbPath)) {
                    fs.unlinkSync(dbPath);
                    console.log("Database file deleted");
                }

                // Delete WAL and SHM files if they exist
                const walPath = dbPath + '-wal';
                const shmPath = dbPath + '-shm';
                if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
                if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

                // Reinitialize database
                await initializeDatabase();

                return { success: true, timestamp: new Date().toISOString() };
            } catch (error) {
                console.error('Error resetting database:', error);
                throw error;
            }
        }));
    }
}

// Get sales report data for a date range
export async function getSalesReportData(startDate, endDate) {
    try {
      // Get database instance using the existing getDB function
      const db = getDB();
      
      // Convert dates to ensure proper format if needed
      const formattedStartDate = startDate.includes('T') ? startDate.split('T')[0] : startDate;
      const formattedEndDate = endDate.includes('T') ? endDate.split('T')[0] : endDate;
      
      // Query for aggregated daily sales data
      const query = `
        SELECT 
          date(fecha_venta) as fecha,
          COUNT(*) as num_ventas,
          SUM(total) as total_ventas,
          ROUND(AVG(total), 2) as promedio_venta,
          SUM(descuento) as total_descuentos,
          SUM(impuestos) as total_impuestos
        FROM ventas 
        WHERE fecha_venta BETWEEN ? AND ?
          AND estado != 'Anulada'
        GROUP BY date(fecha_venta)
        ORDER BY fecha_venta ASC
      `;
      
      const results = db.prepare(query).all(formattedStartDate, formattedEndDate);
      console.log(`Retrieved ${results.length} days of sales data between ${formattedStartDate} and ${formattedEndDate}`);
      
      // Ensure results are properly formatted
      return results.map(row => ({
        fecha: row.fecha,
        num_ventas: row.num_ventas,
        total_ventas: row.total_ventas || 0,
        promedio_venta: row.promedio_venta || 0,
        total_descuentos: row.total_descuentos || 0,
        total_impuestos: row.total_impuestos || 0
      }));
    } catch (error) {
      console.error('Error getting sales report data:', error);
      throw new Error(`Failed to retrieve sales report: ${error.message}`);
    }
}

// Get top selling products for a date range
export async function getTopProductsData(startDate, endDate, limit = 10) {
    try {
      const db = getDB();
      
      const query = `
        SELECT 
          p.id,
          p.nombre,
          p.codigo_barra,
          SUM(vd.cantidad) as cantidad_vendida,
          SUM(vd.subtotal) as total_vendido
        FROM venta_detalles vd
        JOIN productos p ON vd.producto_id = p.id
        JOIN ventas v ON vd.venta_id = v.id
        WHERE v.fecha_venta BETWEEN ? AND ?
          AND v.estado != 'Anulada'
        GROUP BY p.id
        ORDER BY total_vendido DESC
        LIMIT ?
      `;
      
      const results = db.prepare(query).all(startDate, endDate, limit);
      console.log(`Retrieved ${results.length} top products between ${startDate} and ${endDate}`);
      
      return results;
    } catch (error) {
      console.error('Error getting top products data:', error);
      throw new Error(`Failed to retrieve top products: ${error.message}`);
    }
}

// al final del fichero, exporta la función que monta tu esquema / abre la conexión:
async function initializeDatabase() {
  // aquí abres tu DB, ejecutas schema.sql, migrations, etc.
  const db = abrirConexión(); 
  await ejecutarEsquema(db);
  return true;
}

module.exports = {
  initializeDatabase,
  getSalesReportData,
  getTopProductsData,
  setupIpcHandlers,
  closeDB
};