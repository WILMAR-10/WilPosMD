// dao.js - Data Access Layer for WilPOS
import { getDB } from './db.js';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import PDFDocument from 'pdfkit';

// Utility functions
const formatDatetime = () => {
    return new Date().toISOString();
};

// Base DAO with common CRUD operations
const BaseDAO = (tableName, softDelete = false) => ({
    getAll: (options = {}) => {
        const { where = '', params = [], limit, offset, orderBy = 'id DESC' } = options;
        const db = getDB();

        let query = `SELECT * FROM ${tableName}`;

        if (softDelete) {
            query += ` WHERE borrado = 0`;
            if (where) query += ` AND (${where})`;
        } else if (where) {
            query += ` WHERE ${where}`;
        }

        if (orderBy) query += ` ORDER BY ${orderBy}`;
        if (limit) query += ` LIMIT ${limit}`;
        if (offset) query += ` OFFSET ${offset}`;

        return db.prepare(query).all(...params);
    },

    getById: (id) => {
        const db = getDB();
        let query = `SELECT * FROM ${tableName} WHERE id = ?`;
        if (softDelete) query += ` AND borrado = 0`;
        return db.prepare(query).get(id);
    },

    count: (options = {}) => {
        const { where = '', params = [] } = options;
        const db = getDB();

        let query = `SELECT COUNT(*) as count FROM ${tableName}`;

        if (softDelete) {
            query += ` WHERE borrado = 0`;
            if (where) query += ` AND (${where})`;
        } else if (where) {
            query += ` WHERE ${where}`;
        }

        return db.prepare(query).get(...params).count;
    },

    delete: (id) => {
        const db = getDB();
        try {
            let query;
            if (softDelete) {
                query = `UPDATE ${tableName} SET borrado = 1 WHERE id = ?`;
            } else {
                query = `DELETE FROM ${tableName} WHERE id = ?`;
            }

            const result = db.prepare(query).run(id);
            return result.changes > 0;
        } catch (error) {
            console.error(`Error deleting from ${tableName}:`, error);
            throw error;
        }
    }
});

// Usuario DAO
export const UsuarioDAO = {
    ...BaseDAO('usuarios'),

    getByUsername: (username) => {
        const db = getDB();
        return db.prepare(`
      SELECT * FROM usuarios 
      WHERE usuario = ? AND activo = 1
    `).get(username);
    },

    create: (usuario) => {
        const db = getDB();
        try {
            const stmt = db.prepare(`
        INSERT INTO usuarios (
          nombre, 
          usuario, 
          clave, 
          rol, 
          permisos, 
          activo
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

            const result = stmt.run(
                usuario.nombre,
                usuario.usuario,
                usuario.clave,
                usuario.rol,
                JSON.stringify(usuario.permisos || {}),
                usuario.activo || 1
            );

            return { id: result.lastInsertRowid, success: true };
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    },

    update: (id, data) => {
        const db = getDB();

        // Build dynamic update query for optional fields
        const updates = [];
        const params = [];

        if ('nombre' in data) {
            updates.push('nombre = ?');
            params.push(data.nombre);
        }

        if ('usuario' in data) {
            updates.push('usuario = ?');
            params.push(data.usuario);
        }

        if ('clave' in data) {
            updates.push('clave = ?');
            params.push(data.clave);
        }

        if ('rol' in data) {
            updates.push('rol = ?');
            params.push(data.rol);
        }

        if ('permisos' in data) {
            updates.push('permisos = ?');
            params.push(JSON.stringify(data.permisos));
        }

        if ('activo' in data) {
            updates.push('activo = ?');
            params.push(data.activo);
        }

        if (updates.length === 0) {
            return false; // Nothing to update
        }

        params.push(id); // Add ID for WHERE clause

        const query = `
      UPDATE usuarios 
      SET ${updates.join(', ')}
      WHERE id = ?
    `;

        try {
            const result = db.prepare(query).run(...params);
            return result.changes > 0;
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    },

    toggleActive: (id, active) => {
        const db = getDB();
        try {
            const stmt = db.prepare(`
        UPDATE usuarios 
        SET activo = ? 
        WHERE id = ?
      `);

            const result = stmt.run(active ? 1 : 0, id);
            return result.changes > 0;
        } catch (error) {
            console.error('Error toggling user active status:', error);
            throw error;
        }
    }
};

// Categorias DAO
export const CategoriaDAO = {
    ...BaseDAO('categorias'),

    create: (categoria) => {
        const db = getDB();
        try {
            const stmt = db.prepare(`
        INSERT INTO categorias (
          nombre, 
          descripcion
        ) VALUES (?, ?)
      `);

            const result = stmt.run(
                categoria.nombre,
                categoria.descripcion || null
            );

            return { id: result.lastInsertRowid, success: true };
        } catch (error) {
            console.error('Error creating category:', error);
            throw error;
        }
    },

    update: (id, data) => {
        const db = getDB();
        const transaction = db.transaction(() => {
            // Get old name if we need to update products
            let oldName = null;
            if ('nombre' in data) {
                const category = db.prepare('SELECT nombre FROM categorias WHERE id = ?').get(id);
                oldName = category?.nombre;
            }

            // Update category
            const updates = [];
            const params = [];

            if ('nombre' in data) {
                updates.push('nombre = ?');
                params.push(data.nombre);
            }

            if ('descripcion' in data) {
                updates.push('descripcion = ?');
                params.push(data.descripcion);
            }

            updates.push('ultima_modificacion = ?');
            params.push(formatDatetime());

            params.push(id); // Add ID for WHERE clause

            const query = `
        UPDATE categorias 
        SET ${updates.join(', ')}
        WHERE id = ?
      `;

            const result = db.prepare(query).run(...params);

            // Update products if category name changed
            if (oldName && 'nombre' in data && oldName !== data.nombre) {
                db.prepare(`
          UPDATE productos 
          SET categoria = ? 
          WHERE categoria = ?
        `).run(data.nombre, oldName);
            }

            return result.changes > 0;
        });

        try {
            return transaction();
        } catch (error) {
            console.error('Error updating category:', error);
            throw error;
        }
    },

    delete: (id) => {
        const db = getDB();
        const transaction = db.transaction(() => {
            // Get category name
            const category = db.prepare('SELECT nombre FROM categorias WHERE id = ?').get(id);

            if (!category) {
                return false;
            }

            // Update products to remove category reference
            db.prepare(`
        UPDATE productos 
        SET categoria = NULL 
        WHERE categoria = ?
      `).run(category.nombre);

            // Delete the category
            const result = db.prepare('DELETE FROM categorias WHERE id = ?').run(id);

            return result.changes > 0;
        });

        try {
            return transaction();
        } catch (error) {
            console.error('Error deleting category:', error);
            throw error;
        }
    }
};

// Productos DAO
export const ProductoDAO = {
    ...BaseDAO('productos', true), // Use soft delete

    create: (producto) => {
        const db = getDB();
        try {
            const stmt = db.prepare(`
        INSERT INTO productos (
          nombre, 
          codigo_barra, 
          categoria, 
          precio_venta, 
          costo, 
          stock,
          stock_minimo,
          imagen, 
          itebis
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

            const result = stmt.run(
                producto.nombre,
                producto.codigo_barra || null,
                producto.categoria || null,
                producto.precio_venta,
                producto.costo || 0,
                producto.stock || 0,
                producto.stock_minimo || 5,
                producto.imagen || null,
                producto.itebis || 0.18
            );

            return { id: result.lastInsertRowid, success: true };
        } catch (error) {
            console.error('Error creating product:', error);
            throw error;
        }
    },

    update: (id, data) => {
        const db = getDB();

        // Build dynamic update query for optional fields
        const updates = [];
        const params = [];

        if ('nombre' in data) {
            updates.push('nombre = ?');
            params.push(data.nombre);
        }

        if ('codigo_barra' in data) {
            updates.push('codigo_barra = ?');
            params.push(data.codigo_barra);
        }

        if ('categoria' in data) {
            updates.push('categoria = ?');
            params.push(data.categoria);
        }

        if ('precio_venta' in data) {
            updates.push('precio_venta = ?');
            params.push(data.precio_venta);
        }

        if ('costo' in data) {
            updates.push('costo = ?');
            params.push(data.costo);
        }

        if ('stock' in data) {
            updates.push('stock = ?');
            params.push(data.stock);
        }

        if ('stock_minimo' in data) {
            updates.push('stock_minimo = ?');
            params.push(data.stock_minimo);
        }

        if ('imagen' in data) {
            updates.push('imagen = ?');
            params.push(data.imagen);
        }

        if ('itebis' in data) {
            updates.push('itebis = ?');
            params.push(data.itebis);
        }

        updates.push('ultima_modificacion = ?');
        params.push(formatDatetime());

        params.push(id); // Add ID for WHERE clause

        const query = `
      UPDATE productos 
      SET ${updates.join(', ')}
      WHERE id = ? AND borrado = 0
    `;

        try {
            const result = db.prepare(query).run(...params);
            return result.changes > 0;
        } catch (error) {
            console.error('Error updating product:', error);
            throw error;
        }
    },

    updateStock: (id, quantity, reason = "", userId = null) => {
        const db = getDB();

        const transaction = db.transaction(() => {
            // Get current stock
            const product = db.prepare(`
        SELECT stock FROM productos 
        WHERE id = ? AND borrado = 0
      `).get(id);

            if (!product) {
                throw new Error(`Product with ID ${id} not found or deleted`);
            }

            // Update stock
            const newStock = product.stock + quantity;

            const updateResult = db.prepare(`
        UPDATE productos 
        SET stock = ?, ultima_modificacion = ? 
        WHERE id = ? AND borrado = 0
      `).run(newStock, formatDatetime(), id);

            // Record movement
            const movType = quantity >= 0 ? 'entrada' : 'salida';

            db.prepare(`
        INSERT INTO movimientos_inventario (
          producto_id, 
          tipo, 
          cantidad, 
          motivo, 
          usuario_id
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
                id,
                movType,
                Math.abs(quantity),
                reason,
                userId
            );

            return updateResult.changes > 0;
        });

        try {
            return transaction();
        } catch (error) {
            console.error('Error updating product stock:', error);
            throw error;
        }
    },

    getByBarcode: (barcode) => {
        const db = getDB();
        return db.prepare(`
      SELECT * FROM productos 
      WHERE codigo_barra = ? AND borrado = 0
    `).get(barcode);
    },

    getLowStock: (limit = 10) => {
        const db = getDB();
        return db.prepare(`
      SELECT * FROM productos 
      WHERE borrado = 0 AND stock <= stock_minimo 
      ORDER BY (stock_minimo - stock) DESC 
      LIMIT ?
    `).all(limit);
    },

    search: (term, options = {}) => {
        const { limit = 20, offset = 0 } = options;
        const db = getDB();

        const searchTerm = `%${term}%`;

        return db.prepare(`
      SELECT * FROM productos 
      WHERE borrado = 0 
      AND (
        nombre LIKE ? OR 
        codigo_barra LIKE ? OR 
        categoria LIKE ?
      )
      ORDER BY nombre
      LIMIT ? OFFSET ?
    `).all(searchTerm, searchTerm, searchTerm, limit, offset);
    }
};

// Proveedores DAO
export const ProveedorDAO = {
    ...BaseDAO('proveedores'),

    create: (proveedor) => {
        const db = getDB();
        try {
            const stmt = db.prepare(`
        INSERT INTO proveedores (
          nombre, 
          contacto, 
          telefono, 
          email, 
          direccion
        ) VALUES (?, ?, ?, ?, ?)
      `);

            const result = stmt.run(
                proveedor.nombre,
                proveedor.contacto || null,
                proveedor.telefono || null,
                proveedor.email || null,
                proveedor.direccion || null
            );

            return { id: result.lastInsertRowid, success: true };
        } catch (error) {
            console.error('Error creating provider:', error);
            throw error;
        }
    },

    update: (id, data) => {
        const db = getDB();

        // Build dynamic update query for optional fields
        const updates = [];
        const params = [];

        if ('nombre' in data) {
            updates.push('nombre = ?');
            params.push(data.nombre);
        }

        if ('contacto' in data) {
            updates.push('contacto = ?');
            params.push(data.contacto);
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

        if ('activo' in data) {
            updates.push('activo = ?');
            params.push(data.activo);
        }

        if (updates.length === 0) {
            return false; // Nothing to update
        }

        params.push(id); // Add ID for WHERE clause

        const query = `
      UPDATE proveedores 
      SET ${updates.join(', ')}
      WHERE id = ?
    `;

        try {
            const result = db.prepare(query).run(...params);
            return result.changes > 0;
        } catch (error) {
            console.error('Error updating provider:', error);
            throw error;
        }
    }
};

// Ventas DAO
export const VentaDAO = {
    ...BaseDAO('ventas'),

    create: (venta, detalles) => {
        const db = getDB();

        const transaction = db.transaction(() => {
            console.log("Iniciando transacción de venta");

            try {
                // Check if cliente_id exists
                if (venta.cliente_id) {
                    const clienteExists = db.prepare('SELECT id FROM clientes WHERE id = ?').get(venta.cliente_id);
                    if (!clienteExists) {
                        console.warn(`Cliente con ID ${venta.cliente_id} no existe, usando cliente genérico`);
                        venta.cliente_id = 1; // Default to generic customer
                    }
                } else {
                    venta.cliente_id = 1; // Ensure default client
                }

                // IMPORTANT FIX: Check if generic client exists, create if not
                const genericClientExists = db.prepare('SELECT id FROM clientes WHERE id = 1').get();
                if (!genericClientExists) {
                    console.log("Creating generic client with ID 1");
                    const insertGenericClient = db.prepare(`
                        INSERT INTO clientes (id, nombre, telefono, email, direccion)
                        VALUES (1, 'Cliente Genérico', 'N/A', 'N/A', 'N/A')
                    `);
                    insertGenericClient.run();
                }

                // Insert sale with validated data
                const insertVentaStmt = db.prepare(`
                    INSERT INTO ventas (
                        cliente_id, 
                        total, 
                        descuento, 
                        impuestos, 
                        metodo_pago, 
                        estado, 
                        notas, 
                        usuario_id,
                        monto_recibido,
                        cambio
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                console.log("Datos a insertar en venta:", {
                    cliente_id: venta.cliente_id || 1,
                    total: venta.total || 0,
                    descuento: venta.descuento || 0,
                    impuestos: venta.impuestos || 0,
                    metodo_pago: venta.metodo_pago || 'Efectivo',
                    estado: venta.estado || 'Completada',
                    notas: venta.notas || null,
                    usuario_id: venta.usuario_id || null,
                    monto_recibido: venta.monto_recibido || venta.total || 0,
                    cambio: venta.cambio || 0
                });

                const ventaResult = insertVentaStmt.run(
                    venta.cliente_id || 1,
                    venta.total || 0,
                    venta.descuento || 0,
                    venta.impuestos || 0,
                    venta.metodo_pago || 'Efectivo',
                    venta.estado || 'Completada',
                    venta.notas || null,
                    venta.usuario_id || null,
                    venta.monto_recibido || venta.total || 0,
                    venta.cambio || 0
                );

                const ventaId = ventaResult.lastInsertRowid;
                console.log("ID de venta creada:", ventaId);

                if (!ventaId) {
                    throw new Error('Failed to insert sale - no ID returned');
                }

                // Insert sale details
                const insertDetalleStmt = db.prepare(`
                    INSERT INTO venta_detalles (
                        venta_id, 
                        producto_id, 
                        cantidad, 
                        precio_unitario, 
                        descuento, 
                        itebis, 
                        subtotal
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `);

                // Process each product in the sale with error resistance
                let hasProcessedAnyProduct = false;
                let errors = [];

                for (const detalle of detalles) {
                    try {
                        // Check if producto_id exists
                        const productoExists = db.prepare('SELECT id FROM productos WHERE id = ? AND borrado = 0').get(detalle.producto_id);
                        if (!productoExists) {
                            const errorMsg = `Producto con ID ${detalle.producto_id} no existe o fue eliminado`;
                            errors.push(errorMsg);
                            console.warn(errorMsg);
                            continue; // Skip to next product
                        }

                        // Validate amount is > 0
                        const cantidad = Math.max(1, parseInt(detalle.cantidad) || 1);

                        // Ensure required fields have valid values
                        const detalleToInsert = {
                            venta_id: ventaId,
                            producto_id: detalle.producto_id,
                            cantidad: cantidad,
                            precio_unitario: detalle.precio_unitario || 0,
                            descuento: detalle.descuento || 0,
                            itebis: detalle.itebis || 0.18,
                            subtotal: detalle.subtotal || 0
                        };

                        console.log(`Insertando detalle para producto ID ${detalleToInsert.producto_id}, cantidad: ${detalleToInsert.cantidad}`);

                        // Insert detail with the validated amount
                        insertDetalleStmt.run(
                            detalleToInsert.venta_id,
                            detalleToInsert.producto_id,
                            detalleToInsert.cantidad,
                            detalleToInsert.precio_unitario,
                            detalleToInsert.descuento,
                            detalleToInsert.itebis,
                            detalleToInsert.subtotal
                        );

                        hasProcessedAnyProduct = true;

                        // Update product stock
                        try {
                            const product = db.prepare(`
                                SELECT id, stock, nombre FROM productos 
                                WHERE id = ? AND borrado = 0
                            `).get(detalle.producto_id);

                            if (product) {
                                // Update product stock
                                const newStock = Math.max(0, product.stock - cantidad);
                                db.prepare(`
                                    UPDATE productos 
                                    SET stock = ?, ultima_modificacion = ? 
                                    WHERE id = ? AND borrado = 0
                                `).run(
                                    newStock,
                                    new Date().toISOString(),
                                    detalle.producto_id
                                );
                                
                                // Log inventory movement
                                db.prepare(`
                                    INSERT INTO movimientos_inventario (
                                        producto_id, 
                                        tipo, 
                                        cantidad, 
                                        motivo, 
                                        usuario_id
                                    ) VALUES (?, ?, ?, ?, ?)
                                `).run(
                                    detalle.producto_id,
                                    'salida',
                                    cantidad,
                                    `Venta #${ventaId}`,
                                    venta.usuario_id
                                );
                            }
                        } catch (stockError) {
                            console.error(`Error updating stock for product ${detalle.producto_id}:`, stockError);
                            errors.push(`Error al actualizar stock: ${stockError.message}`);
                        }
                    } catch (detailError) {
                        console.error(`Error processing detail:`, detailError);
                        errors.push(`Error al procesar detalle: ${detailError.message}`);
                        // Continue with next detail
                    }
                }

                // If no products were successfully processed, throw an error
                if (!hasProcessedAnyProduct) {
                    throw new Error('No se pudo procesar ningún producto. Errores: ' + errors.join(', '));
                }

                // Return sale ID and mark success
                const result = {
                    id: ventaId,
                    success: true
                };

                // If there were any errors with individual products, add warnings
                if (errors.length > 0) {
                    result.warnings = errors;
                }

                return result;
            } catch (error) {
                console.error('Error creating sale in transaction:', error);
                throw error; // Re-throw to trigger transaction rollback
            }
        });

        try {
            // Execute transaction and get result
            const result = transaction();
            console.log("Transaction result:", result);
            
            // If successful, generate receipt
            if (result.success) {
                // Store the promise for PDF generation
                result.receiptPromise = VentaDAO.generateReceipt(result.id);
            }
            
            return result;
        } catch (error) {
            console.error('Error in sale transaction:', error);
            // Return a properly structured error response
            return {
                success: false,
                error: error.message || 'Error desconocido al crear venta',
                details: error.toString()
            };
        }
    },

    generateReceipt: async (ventaId) => {
        const db = getDB();
        
        try {
            // Get sale data
            const venta = db.prepare(`
                SELECT v.*, c.nombre as cliente_nombre, u.nombre as usuario_nombre 
                FROM ventas v
                LEFT JOIN clientes c ON v.cliente_id = c.id
                LEFT JOIN usuarios u ON v.usuario_id = u.id
                WHERE v.id = ?
            `).get(ventaId);
            
            if (!venta) {
                return { success: false, error: 'Venta no encontrada' };
            }
            
            // Get sale details
            const detalles = db.prepare(`
                SELECT vd.*, p.nombre as producto_nombre, p.codigo_barra
                FROM venta_detalles vd
                JOIN productos p ON vd.producto_id = p.id
                WHERE vd.venta_id = ?
            `).all(ventaId);
            
            // Get business settings
            const settings = ConfiguracionDAO.getSettings();
            
            // Create directory for receipts if it doesn't exist
            const receiptsDir = path.join(app.getPath('userData'), 'facturas');
            if (!fs.existsSync(receiptsDir)) {
                fs.mkdirSync(receiptsDir, { recursive: true });
            }
            
            // Define file path
            const filename = `factura_${ventaId}_${new Date().getTime()}.pdf`;
            const filePath = path.join(receiptsDir, filename);
            
            // Generate PDF
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            
            // Pipe to file
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);
            
            // Add header
            doc.fontSize(20).text(settings.nombre_negocio || 'WilPOS', { align: 'center' });
            doc.fontSize(12).text(settings.direccion || '', { align: 'center' });
            doc.text(settings.telefono || '', { align: 'center' });
            if (settings.rnc) doc.text(`RNC: ${settings.rnc}`, { align: 'center' });
            
            doc.moveDown();
            doc.fontSize(16).text('FACTURA', { align: 'center' });
            doc.moveDown();
            
            // Sale info
            doc.fontSize(12).text(`Factura No: ${ventaId}`);
            doc.text(`Fecha: ${new Date(venta.fecha_venta).toLocaleString()}`);
            doc.text(`Cliente: ${venta.cliente_nombre || 'Cliente Genérico'}`);
            doc.text(`Atendido por: ${venta.usuario_nombre || 'N/A'}`);
            doc.moveDown();
            
            // Draw table header
            const tableTop = doc.y;
            const tableHeaders = ['Producto', 'Cant.', 'Precio', 'Descuento', 'Subtotal'];
            const columnWidth = 100;
            
            // Draw header
            let yPos = tableTop;
            doc.font('Helvetica-Bold');
            tableHeaders.forEach((header, i) => {
                doc.text(header, 50 + (i * columnWidth), yPos, { width: columnWidth, align: 'left' });
            });
            doc.moveDown();
            yPos = doc.y;
            
            // Draw horizontal line
            doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
            
            // Draw items
            doc.font('Helvetica');
            detalles.forEach(item => {
                yPos += 20;
                
                doc.text(item.producto_nombre, 50, yPos, { width: columnWidth, align: 'left' });
                doc.text(item.cantidad.toString(), 50 + columnWidth, yPos, { width: columnWidth, align: 'left' });
                doc.text(`${settings.moneda || 'RD$'} ${item.precio_unitario.toFixed(2)}`, 50 + (2 * columnWidth), yPos, { width: columnWidth, align: 'left' });
                doc.text(`${settings.moneda || 'RD$'} ${item.descuento.toFixed(2)}`, 50 + (3 * columnWidth), yPos, { width: columnWidth, align: 'left' });
                doc.text(`${settings.moneda || 'RD$'} ${item.subtotal.toFixed(2)}`, 50 + (4 * columnWidth), yPos, { width: columnWidth, align: 'left' });
            });
            
            // Draw totals
            yPos += 30;
            doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
            yPos += 10;
            
            doc.text(`Subtotal: ${settings.moneda || 'RD$'} ${(venta.total - venta.impuestos).toFixed(2)}`, 350, yPos);
            yPos += 20;
            doc.text(`Impuestos: ${settings.moneda || 'RD$'} ${venta.impuestos.toFixed(2)}`, 350, yPos);
            yPos += 20;
            doc.text(`Descuento: ${settings.moneda || 'RD$'} ${venta.descuento.toFixed(2)}`, 350, yPos);
            yPos += 20;
            doc.font('Helvetica-Bold');
            doc.text(`TOTAL: ${settings.moneda || 'RD$'} ${venta.total.toFixed(2)}`, 350, yPos);
            
            // Payment info
            yPos += 40;
            doc.font('Helvetica');
            doc.text(`Método de pago: ${venta.metodo_pago}`, 50, yPos);
            if (venta.metodo_pago === 'Efectivo') {
                yPos += 20;
                doc.text(`Monto recibido: ${settings.moneda || 'RD$'} ${venta.monto_recibido.toFixed(2)}`, 50, yPos);
                yPos += 20;
                doc.text(`Cambio: ${settings.moneda || 'RD$'} ${venta.cambio.toFixed(2)}`, 50, yPos);
            }
            
            // Footer
            doc.moveDown(2);
            doc.fontSize(10).text(settings.mensaje_recibo || 'Gracias por su compra', { align: 'center' });
            
            // Finalize PDF
            doc.end();
            
            // Wait for stream to finish
            return new Promise((resolve, reject) => {
                stream.on('finish', () => {
                    resolve({
                        success: true,
                        filePath,
                        fileName: filename
                    });
                });
                stream.on('error', (err) => {
                    reject({
                        success: false,
                        error: 'Error generando PDF',
                        details: err.toString()
                    });
                });
            });
        } catch (error) {
            console.error('Error generating receipt:', error);
            return {
                success: false,
                error: 'Error generando recibo',
                details: error.toString()
            };
        }
    },

    getDetails: (ventaId) => {
        const db = getDB();
        try {
            return db.prepare(`
          SELECT vd.*, p.nombre as producto_nombre, p.codigo_barra
          FROM venta_detalles vd
          JOIN productos p ON vd.producto_id = p.id
          WHERE vd.venta_id = ?
          ORDER BY vd.id
        `).all(ventaId);
        } catch (error) {
            console.error(`Error fetching sale details for ID ${ventaId}:`, error);
            return [];
        }
    },

    getSalesReport: (startDate, endDate) => {
        const db = getDB();
        try {
            return db.prepare(`
          SELECT 
            strftime('%Y-%m-%d', fecha_venta) as fecha,
            COUNT(*) as num_ventas,
            SUM(total) as total_ventas,
            AVG(total) as promedio_venta,
            SUM(descuento) as total_descuentos,
            SUM(impuestos) as total_impuestos
          FROM ventas
          WHERE fecha_venta BETWEEN ? AND ?
          AND estado != 'Anulada'
          GROUP BY strftime('%Y-%m-%d', fecha_venta)
          ORDER BY fecha DESC
        `).all(startDate, endDate);
        } catch (error) {
            console.error('Error generating sales report:', error);
            return [];
        }
    },

    getTopProducts: (startDate, endDate, limit = 10) => {
        const db = getDB();
        try {
            return db.prepare(`
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
          ORDER BY cantidad_vendida DESC
          LIMIT ?
        `).all(startDate, endDate, limit);
        } catch (error) {
            console.error('Error getting top products:', error);
            return [];
        }
    },

    // Function to cancel a sale and restore inventory
    cancelSale: (id) => {
        const db = getDB();

        const transaction = db.transaction(() => {
            try {
                // Check if sale exists and is not already canceled
                const sale = db.prepare(`
            SELECT id, estado FROM ventas WHERE id = ?
          `).get(id);

                if (!sale) {
                    throw new Error(`Venta con ID ${id} no encontrada`);
                }

                if (sale.estado === 'Anulada') {
                    throw new Error(`La venta con ID ${id} ya está anulada`);
                }

                // Update sale status
                const updateSaleResult = db.prepare(`
            UPDATE ventas SET estado = 'Anulada' WHERE id = ?
          `).run(id);

                if (updateSaleResult.changes === 0) {
                    throw new Error(`No se pudo anular la venta con ID ${id}`);
                }

                // Get sale details
                const detalles = db.prepare(`
            SELECT producto_id, cantidad FROM venta_detalles WHERE venta_id = ?
          `).all(id);

                if (!detalles || detalles.length === 0) {
                    console.warn(`No se encontraron detalles para la venta con ID ${id}`);
                    return { success: true, id, warning: 'No se encontraron detalles para restaurar el inventario' };
                }

                // Restore inventory for each product
                const updateStockStmt = db.prepare(`
            UPDATE productos 
            SET stock = stock + ?, ultima_modificacion = ?
            WHERE id = ? AND borrado = 0
          `);

                // Log inventory movement
                const logMovementStmt = db.prepare(`
            INSERT INTO movimientos_inventario (
              producto_id, 
              tipo, 
              cantidad, 
              motivo, 
              usuario_id
            ) VALUES (?, ?, ?, ?, ?)
          `);

                // Process each product in the canceled sale
                let errors = [];

                for (const detalle of detalles) {
                    try {
                        // Try to restore stock
                        const stockResult = updateStockStmt.run(
                            detalle.cantidad,
                            formatDatetime(),
                            detalle.producto_id
                        );

                        if (stockResult.changes === 0) {
                            console.warn(`No se pudo restaurar stock para producto ID ${detalle.producto_id}`);
                            errors.push(`No se pudo restaurar stock para producto ID ${detalle.producto_id}`);
                            continue; // Try next product
                        }

                        // Log inventory movement
                        logMovementStmt.run(
                            detalle.producto_id,
                            'entrada',
                            detalle.cantidad,
                            `Anulación venta #${id}`,
                            null // Si no hay usuario, se puede registrar null
                        );
                    } catch (productError) {
                        console.error(`Error restoring product ${detalle.producto_id}:`, productError);
                        errors.push(`Error con producto ${detalle.producto_id}: ${productError.message}`);
                        // Continue with next product
                    }
                }

                const result = { success: true, id };

                if (errors.length > 0) {
                    result.warnings = errors;
                }

                return result;
            } catch (error) {
                console.error('Error in cancel sale transaction:', error);
                throw error; // Rethrow to trigger rollback
            }
        });

        try {
            return transaction();
        } catch (error) {
            console.error('Error al anular venta:', error);
            return {
                success: false,
                error: error.message || 'Error desconocido al anular venta',
                details: error.toString()
            };
        }
    }
};

// Gastos DAO
export const GastoDAO = {
    ...BaseDAO('gastos'),

    create: (gasto) => {
        const db = getDB();

        const transaction = db.transaction(() => {
            // Insert expense
            const insertGastoStmt = db.prepare(`
        INSERT INTO gastos (
          descripcion, 
          categoria, 
          monto, 
          fecha, 
          usuario_id
        ) VALUES (?, ?, ?, ?, ?)
      `);

            const result = insertGastoStmt.run(
                gasto.descripcion,
                gasto.categoria || null,
                gasto.monto,
                gasto.fecha || formatDatetime(),
                gasto.usuario_id
            );

            // Update daily summary
            const today = new Date().toISOString().split('T')[0];

            const updateSummaryStmt = db.prepare(`
        UPDATE resumen_diario 
        SET total_gastos = total_gastos + ?
        WHERE fecha = ?
      `);

            // Try to update existing summary
            const updateResult = updateSummaryStmt.run(gasto.monto, today);

            // If no summary exists for today, create it
            if (updateResult.changes === 0) {
                db.prepare(`
          INSERT INTO resumen_diario (
            fecha, 
            total_gastos, 
            usuario_id
          ) VALUES (?, ?, ?)
        `).run(
                    today,
                    gasto.monto,
                    gasto.usuario_id
                );
            }

            return { id: result.lastInsertRowid, success: true };
        });

        try {
            return transaction();
        } catch (error) {
            console.error('Error creating expense:', error);
            throw error;
        }
    },

    getByDateRange: (startDate, endDate) => {
        const db = getDB();
        return db.prepare(`
      SELECT g.*, u.nombre as usuario_nombre
      FROM gastos g
      LEFT JOIN usuarios u ON g.usuario_id = u.id
      WHERE g.fecha BETWEEN ? AND ?
      ORDER BY g.fecha DESC
    `).all(startDate, endDate);
    }
};

// Resumen Diario DAO
export const ResumenDAO = {
    ...BaseDAO('resumen_diario'),

    getDailySummary: (fecha) => {
        const db = getDB();
        return db.prepare(`
      SELECT * FROM resumen_diario 
      WHERE fecha = ?
    `).get(fecha);
    },

    getByDateRange: (startDate, endDate) => {
        const db = getDB();
        return db.prepare(`
      SELECT * FROM resumen_diario 
      WHERE fecha BETWEEN ? AND ?
      ORDER BY fecha DESC
    `).all(startDate, endDate);
    },

    getSummaryStats: (days = 30) => {
        const db = getDB();

        const result = db.prepare(`
      SELECT 
        SUM(total_ventas) as ventas_total,
        SUM(total_gastos) as gastos_total,
        SUM(productos_vendidos) as productos_total,
        SUM(transacciones) as transacciones_total,
        AVG(total_ventas) as ventas_promedio,
        MAX(total_ventas) as ventas_max,
        SUM(efectivo) as efectivo_total,
        SUM(tarjeta) as tarjeta_total,
        SUM(otros_metodos) as otros_total
      FROM resumen_diario 
      WHERE fecha >= date('now', ?)
    `).get(`-${days} days`);

        return result;
    }
};

// Caja DAO
export const CajaDAO = {
    ...BaseDAO('caja_sesiones'),

    getOpenSession: () => {
        const db = getDB();
        return db.prepare(`
        SELECT * FROM caja_sesiones 
        WHERE estado = 'abierta'
        ORDER BY fecha_apertura DESC
        LIMIT 1
      `).get();
    },

    openSession: (datos) => {
        const db = getDB();

        const transaction = db.transaction(() => {
            // Check if there's already an open session
            const openSession = db.prepare(`
          SELECT id FROM caja_sesiones 
          WHERE estado = 'abierta'
        `).get();

            if (openSession) {
                throw new Error('Ya existe una sesión de caja abierta');
            }

            // Create new session
            const result = db.prepare(`
          INSERT INTO caja_sesiones (
            monto_inicial, 
            notas_apertura, 
            usuario_id
          ) VALUES (?, ?, ?)
        `).run(
                datos.monto_inicial,
                datos.notas_apertura || null,
                datos.usuario_id
            );

            const sessionId = result.lastInsertRowid;

            // Register initial amount as a transaction
            db.prepare(`
          INSERT INTO caja_transacciones (
            sesion_id, 
            tipo, 
            monto, 
            concepto, 
            usuario_id
          ) VALUES (?, ?, ?, ?, ?)
        `).run(
                sessionId,
                'ingreso',
                datos.monto_inicial,
                'Monto inicial',
                datos.usuario_id
            );

            return { id: sessionId, success: true };
        });

        try {
            return transaction();
        } catch (error) {
            console.error('Error opening cash session:', error);
            throw error;
        }
    },

    closeSession: (sessionId, datos) => {
        const db = getDB();

        const transaction = db.transaction(() => {
            // Update session
            const updateResult = db.prepare(`
          UPDATE caja_sesiones 
          SET 
            monto_final = ?,
            fecha_cierre = ?,
            notas_cierre = ?,
            estado = 'cerrada'
          WHERE id = ? AND estado = 'abierta'
        `).run(
                datos.monto_final,
                formatDatetime(),
                datos.notas_cierre || null,
                sessionId
            );

            if (updateResult.changes === 0) {
                throw new Error('No se encontró una sesión de caja abierta con ese ID');
            }

            return true;
        });

        try {
            return transaction();
        } catch (error) {
            console.error('Error closing cash session:', error);
            throw error;
        }
    },

    addTransaction: (transaction) => {
        const db = getDB();

        const transaction_db = db.transaction(() => {
            // Check if there's an open session
            const session = db.prepare(`
          SELECT id FROM caja_sesiones 
          WHERE estado = 'abierta'
        `).get();

            if (!session) {
                throw new Error('No hay sesión de caja abierta');
            }

            // Add transaction
            const result = db.prepare(`
          INSERT INTO caja_transacciones (
            sesion_id, 
            tipo, 
            monto, 
            concepto, 
            referencia,
            usuario_id
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
                session.id,
                transaction.tipo,
                transaction.monto,
                transaction.concepto,
                transaction.referencia || null,
                transaction.usuario_id
            );

            return { id: result.lastInsertRowid, success: true };
        });

        try {
            return transaction_db();
        } catch (error) {
            console.error('Error adding cash transaction:', error);
            throw error;
        }
    },

    getSessionTransactions: (sessionId) => {
        const db = getDB();
        return db.prepare(`
        SELECT ct.*, u.nombre as usuario_nombre
        FROM caja_transacciones ct
        LEFT JOIN usuarios u ON ct.usuario_id = u.id
        WHERE ct.sesion_id = ?
        ORDER BY ct.fecha DESC
      `).all(sessionId);
    },

    getSessionBalance: (sessionId) => {
        const db = getDB();

        const result = db.prepare(`
        SELECT 
          cs.monto_inicial,
          COALESCE(SUM(CASE WHEN ct.tipo = 'ingreso' THEN ct.monto ELSE 0 END), 0) as total_ingresos,
          COALESCE(SUM(CASE WHEN ct.tipo = 'egreso' THEN ct.monto ELSE 0 END), 0) as total_egresos,
          (cs.monto_inicial + 
            COALESCE(SUM(CASE WHEN ct.tipo = 'ingreso' THEN ct.monto ELSE 0 END), 0) - 
            COALESCE(SUM(CASE WHEN ct.tipo = 'egreso' THEN ct.monto ELSE 0 END), 0)) as balance_esperado
        FROM caja_sesiones cs
        LEFT JOIN caja_transacciones ct ON cs.id = ct.sesion_id
        WHERE cs.id = ?
        GROUP BY cs.id
      `).get(sessionId);

        return result;
    },

    getRecentSessions: (limit = 10) => {
        const db = getDB();
        return db.prepare(`
        SELECT 
          cs.*,
          u.nombre as usuario_nombre,
          COALESCE(SUM(CASE WHEN ct.tipo = 'ingreso' THEN ct.monto ELSE 0 END), 0) as total_ingresos,
          COALESCE(SUM(CASE WHEN ct.tipo = 'egreso' THEN ct.monto ELSE 0 END), 0) as total_egresos
        FROM caja_sesiones cs
        LEFT JOIN caja_transacciones ct ON cs.id = ct.sesion_id
        LEFT JOIN usuarios u ON cs.usuario_id = u.id
        GROUP BY cs.id
        ORDER BY cs.fecha_apertura DESC
        LIMIT ?
      `).all(limit);
    }
};

// Configuracion DAO
export const ConfiguracionDAO = {
    ...BaseDAO('configuracion'),

    getSettings: () => {
        const db = getDB();
        return db.prepare(`SELECT * FROM configuracion LIMIT 1`).get() || {};
    },

    updateSettings: (settings) => {
        const db = getDB();

        try {
            // Check if there are already settings
            const existing = db.prepare(`SELECT id FROM configuracion LIMIT 1`).get();

            // Extended fields list with new printer settings
            const fields = [
                'nombre_negocio', 'direccion', 'telefono', 'email', 'rnc',
                'sitio_web', 'logo', 'mensaje_recibo', 'moneda', 'formato_fecha',
                'impuesto_nombre', 'impuesto_porcentaje', 'tema',
                'impresora_termica', 'guardar_pdf', 'ruta_pdf', 'tipo_impresora'
            ];

            if (existing) {
                // Build dynamic update query for optional fields
                const updates = [];
                const params = [];

                // Add any field that exists in the settings object
                for (const field of fields) {
                    if (field in settings) {
                        updates.push(`${field} = ?`);
                        params.push(settings[field]);
                    }
                }

                if (updates.length === 0) {
                    return false; // Nothing to update
                }

                // Add updated timestamp
                updates.push('ultima_modificacion = ?');
                params.push(new Date().toISOString());

                // Add ID for WHERE clause
                params.push(existing.id);

                const query = `
                    UPDATE configuracion 
                    SET ${updates.join(', ')}
                    WHERE id = ?
                `;

                const result = db.prepare(query).run(...params);
                return result.changes > 0;
            } else {
                // Insert new settings
                const stmt = db.prepare(`
                    INSERT INTO configuracion (
                        nombre_negocio, direccion, telefono, email, rnc,
                        sitio_web, logo, mensaje_recibo, moneda, formato_fecha,
                        impuesto_nombre, impuesto_porcentaje, tema,
                        impresora_termica, guardar_pdf, ruta_pdf, tipo_impresora
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                const result = stmt.run(
                    settings.nombre_negocio || 'WilPOS',
                    settings.direccion || null,
                    settings.telefono || null,
                    settings.email || null,
                    settings.rnc || null,
                    settings.sitio_web || null,
                    settings.logo || null,
                    settings.mensaje_recibo || 'Gracias por su compra',
                    settings.moneda || 'RD$',
                    settings.formato_fecha || 'DD/MM/YYYY',
                    settings.impuesto_nombre || 'ITEBIS',
                    settings.impuesto_porcentaje || 0.18,
                    settings.tema || 'claro',
                    settings.impresora_termica || null,
                    settings.guardar_pdf ? 1 : 0,
                    settings.ruta_pdf || null,
                    settings.tipo_impresora || null
                );

                return { id: result.lastInsertRowid, success: true };
            }
        } catch (error) {
            console.error('Error updating settings:', error);
            throw error;
        }
    }
};

// MovimientoDAO needs to be added too if it doesn't exist
export const MovimientoDAO = {
    ...BaseDAO('movimientos_inventario'),

    create: (movimiento) => {
        const db = getDB();
        try {
            const stmt = db.prepare(`
          INSERT INTO movimientos_inventario (
            producto_id, 
            tipo, 
            cantidad, 
            motivo, 
            notas,
            usuario_id
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);

            const result = stmt.run(
                movimiento.producto_id,
                movimiento.tipo,
                movimiento.cantidad,
                movimiento.motivo || null,
                movimiento.notas || null,
                movimiento.usuario_id
            );

            return { id: result.lastInsertRowid, success: true };
        } catch (error) {
            console.error('Error creating inventory movement:', error);
            throw error;
        }
    },

    getByProductId: (productoId) => {
        const db = getDB();
        return db.prepare(`
        SELECT m.*, p.nombre as producto_nombre, u.nombre as usuario_nombre
        FROM movimientos_inventario m
        JOIN productos p ON m.producto_id = p.id
        LEFT JOIN usuarios u ON m.usuario_id = u.id
        WHERE m.producto_id = ?
        ORDER BY m.fecha DESC
      `).all(productoId);
    },

    getByDateRange: (startDate, endDate) => {
        const db = getDB();
        return db.prepare(`
        SELECT m.*, p.nombre as producto_nombre, u.nombre as usuario_nombre
        FROM movimientos_inventario m
        JOIN productos p ON m.producto_id = p.id
        LEFT JOIN usuarios u ON m.usuario_id = u.id
        WHERE m.fecha BETWEEN ? AND ?
        ORDER BY m.fecha DESC
      `).all(startDate, endDate);
    },

    getAll: (limit = 100) => {
        const db = getDB();
        return db.prepare(`
        SELECT m.*, p.nombre as producto_nombre, u.nombre as usuario_nombre
        FROM movimientos_inventario m
        JOIN productos p ON m.producto_id = p.id
        LEFT JOIN usuarios u ON m.usuario_id = u.id
        ORDER BY m.fecha DESC
        LIMIT ?
      `).all(limit);
    }
};