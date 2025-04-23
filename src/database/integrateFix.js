// integrateFix.js - Script to integrate the fix for missing columns
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Set up directory paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function integrateFix() {
  try {
    console.log("Starting integration of database schema fix...");
    
    // Path to the db.js file
    const dbJsPath = path.join(__dirname, 'db.js');
    
    // Read the db.js file
    if (!fs.existsSync(dbJsPath)) {
      throw new Error(`File not found: ${dbJsPath}`);
    }
    
    let dbJsContent = fs.readFileSync(dbJsPath, 'utf8');
    
    // First, backup the original file
    const backupPath = dbJsPath + '.backup.' + Date.now();
    fs.writeFileSync(backupPath, dbJsContent);
    console.log(`Created backup at: ${backupPath}`);
    
    // Check if the file already has the needed columns
    if (dbJsContent.includes('monto_recibido') && dbJsContent.includes('cambio')) {
      console.log("The file already contains the required columns.");
      return { success: true, message: "No changes required", alreadyFixed: true };
    }
    
    // Find and update the ventas table schema
    const ventasTableRegex = /ventas:`\s*CREATE TABLE IF NOT EXISTS ventas[\s\S]*?\)/;
    const ventasMatch = dbJsContent.match(ventasTableRegex);
    
    if (!ventasMatch) {
      throw new Error("Couldn't find ventas table schema in db.js");
    }
    
    // Check if the schema already contains the usuario_id line (to insert after it)
    const originalSchema = ventasMatch[0];
    const updatedSchema = originalSchema.replace(
      /usuario_id INTEGER,?/,
      `usuario_id INTEGER,
        monto_recibido DECIMAL(10,2) DEFAULT 0,
        cambio DECIMAL(10,2) DEFAULT 0,`
    );
    
    // Replace the schema in the file
    dbJsContent = dbJsContent.replace(originalSchema, updatedSchema);
    
    // Update the migration function
    const migrationFunctionRegex = /export function migrateDatabase\(\) {[\s\S]*?}/;
    const migrationMatch = dbJsContent.match(migrationFunctionRegex);
    
    if (!migrationMatch) {
      throw new Error("Couldn't find migrateDatabase function in db.js");
    }
    
    const originalMigration = migrationMatch[0];
    const updatedMigration = originalMigration.replace(
      /if \(currentVersion < 1\) {[\s\S]*?}/,
      `if (currentVersion < 1) {
        // Create all tables in proper order
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
        
        for (const table of tableOrder) {
          prepareTable(table);
        }
        
        db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(1);
      }
      
      // Add migration for ventas table update
      if (currentVersion < 2) {
        try {
          // Check if columns already exist to avoid errors
          const columns = db.prepare("PRAGMA table_info(ventas)").all();
          const columnNames = columns.map(col => col.name);
          
          if (!columnNames.includes('monto_recibido')) {
            db.exec("ALTER TABLE ventas ADD COLUMN monto_recibido DECIMAL(10,2) DEFAULT 0");
            console.log("Added monto_recibido column to ventas table");
          }
          
          if (!columnNames.includes('cambio')) {
            db.exec("ALTER TABLE ventas ADD COLUMN cambio DECIMAL(10,2) DEFAULT 0");
            console.log("Added cambio column to ventas table");
          }
          
          db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(2);
        } catch (migrationError) {
          console.error('Error in migration #2:', migrationError);
          throw migrationError;
        }
      }`
    );
    
    // Replace the migration function in the file
    dbJsContent = dbJsContent.replace(originalMigration, updatedMigration);
    
    // Write the updated content back to the file
    fs.writeFileSync(dbJsPath, dbJsContent);
    console.log(`Updated ${dbJsPath} with missing columns`);
    
    // Now update the index.js file to fix the handlers
    const indexJsPath = path.join(__dirname, 'index.js');
    
    if (!fs.existsSync(indexJsPath)) {
      throw new Error(`File not found: ${indexJsPath}`);
    }
    
    // Backup index.js
    const indexBackupPath = indexJsPath + '.backup.' + Date.now();
    const indexJsContent = fs.readFileSync(indexJsPath, 'utf8');
    fs.writeFileSync(indexBackupPath, indexJsContent);
    console.log(`Created backup at: ${indexBackupPath}`);
    
    // Update the ventas:insertar handler to handle the new fields
    let updatedIndexContent = indexJsContent;
    
    // Find the VentaDAO.create call inside ventas:insertar handler
    const createHandler = /ipcMain\.handle\('ventas:insertar'[\s\S]*?VentaDAO\.create\([^)]+\)/;
    const createMatch = updatedIndexContent.match(createHandler);
    
    if (createMatch) {
      const originalCreate = createMatch[0];
      // Make sure the handler normalizes the venta object with monto_recibido and cambio
      const updatedCreate = originalCreate.replace(
        /const normalizedVenta = {[^}]*}/,
        `const normalizedVenta = {
            ...venta,
            metodo_pago: validPaymentMethod,
            estado: venta.estado || 'Completada',
            descuento: venta.descuento || 0,
            impuestos: venta.impuestos || 0,
            monto_recibido: venta.monto_recibido || 0,
            cambio: venta.cambio || 0
        }`
      );
      
      updatedIndexContent = updatedIndexContent.replace(originalCreate, updatedCreate);
    } else {
      console.log("Could not find ventas:insertar handler to update. You may need to update it manually.");
    }
    
    // Update the ventas:obtener handler to ensure it selects the new fields
    const getHandler = /ipcMain\.handle\('ventas:obtener'[\s\S]*?SELECT[^;]*FROM\s+ventas/;
    const getMatch = updatedIndexContent.match(getHandler);
    
    if (getMatch) {
      const originalGet = getMatch[0];
      // Make sure the query includes monto_recibido and cambio
      if (!originalGet.includes('monto_recibido') || !originalGet.includes('cambio')) {
        const updatedGet = originalGet.replace(
          /SELECT\s+([^;]*?)FROM\s+ventas/,
          `SELECT 
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
        FROM ventas v`
        );
        
        updatedIndexContent = updatedIndexContent.replace(originalGet, updatedGet);
      }
    }
    
    fs.writeFileSync(indexJsPath, updatedIndexContent);
    console.log(`Updated ${indexJsPath} with handler fixes`);
    
    console.log("Integration complete! Please restart the application.");
    return { success: true, message: "Schema and handlers updated successfully" };
  } catch (error) {
    console.error("Error during integration:", error);
    return { success: false, error: error.message };
  }
}

// Run the integration script
integrateFix().then(result => {
  console.log(result);
  process.exit(result.success ? 0 : 1);
});