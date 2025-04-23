// This script ensures that the database schema is correctly set up with appropriate tables and foreign keys

import { app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB, closeDB } from './src/database/db.js';

// Set up directory paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function verifyDatabase() {
  try {
    console.log("Starting database verification...");
    
    // Get user data directory where the database is stored
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'wilpos.db');
    console.log(`Database location: ${dbPath}`);
    
    // Initialize database connection
    const db = initDB(dbPath);
    
    // Verify tables exist
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
    
    const missingTables = [];
    for (const table of tables) {
      try {
        const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
        if (!exists) {
          missingTables.push(table);
        } else {
          console.log(`Table ${table} exists`);
        }
      } catch (error) {
        console.error(`Error checking table ${table}:`, error);
        missingTables.push(table);
      }
    }
    
    if (missingTables.length > 0) {
      console.error(`Missing tables: ${missingTables.join(', ')}`);
    } else {
      console.log("All required tables exist");
    }
    
    // Verify default client exists
    const defaultClient = db.prepare('SELECT id FROM clientes WHERE id = 1').get();
    if (!defaultClient) {
      console.log("Creating default client...");
      db.prepare(`
        INSERT INTO clientes (
          id,
          nombre,
          documento,
          telefono,
          activo
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        1,
        'Cliente General',
        '',
        '',
        1
      );
      console.log("Default client created");
    } else {
      console.log("Default client exists");
    }
    
    // Examine and correct foreign key constraints
    const ventaDetallesFKCheck = db.prepare(`
      PRAGMA foreign_key_list('venta_detalles')
    `).all();
    
    console.log("Foreign key constraints for venta_detalles:", ventaDetallesFKCheck);
    
    // Ensure foreign keys are enabled
    db.pragma('foreign_keys = ON');
    
    // Verify the column types match between foreign keys and primary keys
    const ventaColumns = db.prepare(`PRAGMA table_info(ventas)`).all();
    const ventaDetallesColumns = db.prepare(`PRAGMA table_info(venta_detalles)`).all();
    const productosColumns = db.prepare(`PRAGMA table_info(productos)`).all();
    
    console.log("Ventas table schema:", ventaColumns);
    console.log("Venta_detalles table schema:", ventaDetallesColumns);
    console.log("Productos table schema:", productosColumns);
    
    // Check if all products referenced in venta_detalles exist
    const orphanedDetails = db.prepare(`
      SELECT vd.id, vd.producto_id
      FROM venta_detalles vd
      LEFT JOIN productos p ON vd.producto_id = p.id
      WHERE p.id IS NULL
    `).all();
    
    if (orphanedDetails.length > 0) {
      console.error(`Found ${orphanedDetails.length} venta_detalles with non-existent productos`);
      console.log(orphanedDetails);
      
      // Fix: Delete orphaned sale details
      const stmt = db.prepare(`DELETE FROM venta_detalles WHERE id = ?`);
      for (const detail of orphanedDetails) {
        console.log(`Removing orphaned venta_detalle with id ${detail.id}`);
        stmt.run(detail.id);
      }
    } else {
      console.log("No orphaned venta_detalles found");
    }
    
    // Create sample products if none exist
    const productCount = db.prepare(`SELECT COUNT(*) as count FROM productos`).get().count;
    if (productCount === 0) {
      console.log("Creating sample products...");
      
      // Create a category first if none exist
      const categoryCount = db.prepare(`SELECT COUNT(*) as count FROM categorias`).get().count;
      if (categoryCount === 0) {
        db.prepare(`
          INSERT INTO categorias (nombre, descripcion) 
          VALUES (?, ?)
        `).run('General', 'Categoría general');
      }
      
      // Add sample products
      const insertProductStmt = db.prepare(`
        INSERT INTO productos (
          nombre, 
          codigo_barra, 
          categoria, 
          precio_venta, 
          costo, 
          stock,
          stock_minimo,
          itebis
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      insertProductStmt.run('Producto 1', '1001', 'General', 590, 300, 10, 5, 0.18);
      insertProductStmt.run('Producto 2', '1002', 'General', 295, 150, 20, 5, 0.18);
      
      console.log("Sample products created");
    }
    
    // Verify schema_migrations
    try {
      db.prepare(`CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`).run();
      
      const currentVersion = db.prepare(`SELECT MAX(version) as version FROM schema_migrations`).get().version || 0;
      console.log(`Current schema version: ${currentVersion}`);
      
      if (currentVersion < 2) {
        console.log("Updating schema to version 2...");
        
        // Check and add missing columns to ventas table
        const ventasColumns = db.prepare(`PRAGMA table_info(ventas)`).all();
        const columnNames = ventasColumns.map(col => col.name);
        
        if (!columnNames.includes('monto_recibido')) {
          db.exec(`ALTER TABLE ventas ADD COLUMN monto_recibido DECIMAL(10,2) DEFAULT 0`);
          console.log("Added monto_recibido column to ventas table");
        }
        
        if (!columnNames.includes('cambio')) {
          db.exec(`ALTER TABLE ventas ADD COLUMN cambio DECIMAL(10,2) DEFAULT 0`);
          console.log("Added cambio column to ventas table");
        }
        
        // Update schema version
        db.prepare(`INSERT INTO schema_migrations (version) VALUES (?)`).run(2);
        console.log("Schema updated to version 2");
      }
    } catch (error) {
      console.error("Error verifying schema_migrations:", error);
    }
    
    return { success: true, message: "Database verification completed" };
  } catch (error) {
    console.error("Error during database verification:", error);
    return { success: false, error: error.message };
  } finally {
    // Close the database connection
    closeDB();
  }
}

// Run the verification if executed directly
if (typeof process !== 'undefined' && process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyDatabase().then(result => {
    console.log(result);
    process.exit(result.success ? 0 : 1);
  });
}

export { verifyDatabase };