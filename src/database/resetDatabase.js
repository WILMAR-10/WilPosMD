// resetDatabase.js - Script for development/testing
// Save this file in your project root directory
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB, closeDB, migrateDatabase, prepareTable } from './src/database/db.js';

// Set up directory paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function resetDatabase() {
  try {
    console.log("Starting database reset process...");
    
    // Get user data directory where the database is stored
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'wilpos.db');
    console.log(`Database location: ${dbPath}`);
    
    // Close current database connection if exists
    try {
      closeDB();
      console.log("Database connection closed");
    } catch (error) {
      console.log("No active database connection to close");
    }
    
    // Delete database file and related files
    const filesToDelete = [
      dbPath,
      dbPath + '-wal',
      dbPath + '-shm'
    ];
    
    for (const file of filesToDelete) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`Deleted file: ${file}`);
      }
    }
    
    // Initialize the database with the updated schema
    console.log("Initializing database with updated schema...");
    const db = initDB(dbPath);
    
    // First create all necessary tables in proper order
    const tableOrder = [
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
    
    console.log("Creating tables in order...");
    for (const table of tableOrder) {
      try {
        prepareTable(table);
        console.log(`Created table: ${table}`);
      } catch (error) {
        console.error(`Error creating table ${table}:`, error);
      }
    }

    // Insert a default admin user
    try {
      console.log("Creating default admin user...");
      db.prepare(`
        INSERT INTO usuarios (
          nombre, 
          usuario, 
          clave, 
          rol, 
          permisos
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        'Administrador',
        'admin',
        'admin',
        'admin',
        JSON.stringify({
          usuarios: { lectura: true, escritura: true },
          productos: { lectura: true, escritura: true },
          ventas: { lectura: true, escritura: true },
          inventario: { lectura: true, escritura: true },
          facturas: { lectura: true, escritura: true },
          reportes: { lectura: true, escritura: true },
          dashboard: { lectura: true, escritura: true },
          caja: { lectura: true, escritura: true },
          configuracion: { lectura: true, escritura: true }
        })
      );
      console.log("Default admin user created");
    } catch (error) {
      console.error("Error creating admin user:", error);
    }
    
    // Add a record to the schema_migrations table
    try {
      db.prepare(`CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`).run();
      
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(2);
      console.log("Updated schema_migrations table");
    } catch (error) {
      console.error("Error updating schema_migrations:", error);
    }
    
    // Add default category
    try {
      db.prepare(`
        INSERT INTO categorias (
          nombre, 
          descripcion
        ) VALUES (?, ?)
      `).run('General', 'Categoría general por defecto');
      console.log("Default category created");
    } catch (error) {
      console.error("Error creating default category:", error);
    }
    
    // Add default client
    try {
      db.prepare(`
        INSERT INTO clientes (
          nombre,
          documento,
          telefono,
          activo
        ) VALUES (?, ?, ?, ?)
      `).run(
        'Cliente General',
        '',
        '',
        1
      );
      console.log("Default client created");
    } catch (error) {
      console.error("Error creating default client:", error);
    }
    
    console.log("Database reset complete!");
    
    // Return success
    return { success: true, message: "Database successfully reset", timestamp: new Date().toISOString() };
  } catch (error) {
    console.error("Error during database reset:", error);
    return { success: false, error: error.message };
  } finally {
    // Close the database connection
    try {
      closeDB();
    } catch (error) {
      console.log("Error closing database connection:", error);
    }
  }
}

// Run directly if executed as a script
if (typeof process !== 'undefined' && process.argv[1] === fileURLToPath(import.meta.url)) {
  resetDatabase().then(result => {
    console.log(result);
    process.exit(result.success ? 0 : 1);
  });
}

export { resetDatabase };