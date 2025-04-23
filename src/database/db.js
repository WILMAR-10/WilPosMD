// src/database/db.js
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let db = null;

export function getDB() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function initDB(dbPath) {
  if (db) return db;
  
  try {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    console.log('Database initialized at', dbPath);
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
}

// Tablas y esquemas
const tableSchemas = {
    usuarios:`
        CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        usuario TEXT NOT NULL UNIQUE,
        clave TEXT NOT NULL,
        rol TEXT NOT NULL CHECK (rol IN ('admin', 'cajero', 'empleado')),
        permisos TEXT,  -- JSON con permisos por módulo
        activo INTEGER DEFAULT 1,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `,
    categorias:`
        CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        descripcion TEXT,
        activo INTEGER DEFAULT 1,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        ultima_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `,
    productos:`
        CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        codigo_barra TEXT UNIQUE,
        categoria TEXT,
        precio_venta DECIMAL(10,2) NOT NULL,
        costo DECIMAL(10,2) NOT NULL DEFAULT 0,
        stock INTEGER DEFAULT 0,
        stock_minimo INTEGER DEFAULT 5,
        imagen TEXT,
        itebis DECIMAL(4,2) DEFAULT 0.18,  -- Impuesto en República Dominicana
        borrado INTEGER DEFAULT 0,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        ultima_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `,
    proveedores:`
        CREATE TABLE IF NOT EXISTS proveedores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        contacto TEXT,
        telefono TEXT,
        email TEXT,
        direccion TEXT,
        activo INTEGER DEFAULT 1,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `,
    clientes:`
        CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        documento TEXT,  -- Cédula o RNC
        telefono TEXT,
        email TEXT,
        direccion TEXT,
        notas TEXT,
        activo INTEGER DEFAULT 1,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        ultima_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
     `,
    ventas:`
      CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER DEFAULT 1,  -- Cliente genérico por defecto
      total DECIMAL(10,2) NOT NULL,
      descuento DECIMAL(10,2) DEFAULT 0,
      impuestos DECIMAL(10,2) DEFAULT 0,
      metodo_pago TEXT DEFAULT 'Efectivo',
      estado TEXT DEFAULT 'Completada',
      notas TEXT,
      fecha_venta DATETIME DEFAULT CURRENT_TIMESTAMP,
      usuario_id INTEGER,
      monto_recibido DECIMAL(10,2) DEFAULT 0,
      cambio DECIMAL(10,2) DEFAULT 0,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )
    `,
    venta_detalles:`
        CREATE TABLE IF NOT EXISTS venta_detalles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venta_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        cantidad INTEGER NOT NULL,
        precio_unitario DECIMAL(10,2) NOT NULL,
        descuento DECIMAL(10,2) DEFAULT 0,
        itebis DECIMAL(4,2) DEFAULT 0.18,
        subtotal DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (venta_id) REFERENCES ventas(id),
        FOREIGN KEY (producto_id) REFERENCES productos(id)
        )
    `,
    resumen_diario:`
        CREATE TABLE IF NOT EXISTS resumen_diario (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha DATE DEFAULT CURRENT_DATE,
        total_ventas DECIMAL(10,2) DEFAULT 0,
        total_gastos DECIMAL(10,2) DEFAULT 0,
        productos_vendidos INTEGER DEFAULT 0,
        transacciones INTEGER DEFAULT 0,
        efectivo DECIMAL(10,2) DEFAULT 0,
        tarjeta DECIMAL(10,2) DEFAULT 0,
        otros_metodos DECIMAL(10,2) DEFAULT 0,
        usuario_id INTEGER,
        notas TEXT,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `,
    gastos:`
        CREATE TABLE IF NOT EXISTS gastos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descripcion TEXT NOT NULL,
        categoria TEXT,
        monto DECIMAL(10,2) NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `,
    movimientos_inventario:`
        CREATE TABLE IF NOT EXISTS movimientos_inventario (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
        cantidad INTEGER NOT NULL,
        motivo TEXT,
        notas TEXT,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        FOREIGN KEY (producto_id) REFERENCES productos(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `,
    configuracion:`
        CREATE TABLE IF NOT EXISTS configuracion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_negocio TEXT DEFAULT 'WilPOS',
        direccion TEXT,
        telefono TEXT,
        email TEXT,
        rnc TEXT,  -- Registro Nacional del Contribuyente (Rep. Dominicana)
        sitio_web TEXT,
        logo BLOB,
        mensaje_recibo TEXT DEFAULT 'Gracias por su compra',
        moneda TEXT DEFAULT 'RD$',
        formato_fecha TEXT DEFAULT 'DD/MM/YYYY',
        impuesto_nombre TEXT DEFAULT 'ITEBIS',
        impuesto_porcentaje DECIMAL(4,2) DEFAULT 0.18,
        tema TEXT DEFAULT 'claro',
        impresora_termica TEXT,
        guardar_pdf INTEGER DEFAULT 1,
        ruta_pdf TEXT,
        ultima_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `,
    caja_sesiones:`
        CREATE TABLE IF NOT EXISTS caja_sesiones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        monto_inicial DECIMAL(10,2) NOT NULL,
        monto_final DECIMAL(10,2),
        fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_cierre DATETIME,
        notas_apertura TEXT,
        notas_cierre TEXT,
        estado TEXT DEFAULT 'abierta',
        usuario_id INTEGER,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `,
    caja_transacciones:`
        CREATE TABLE IF NOT EXISTS caja_transacciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sesion_id INTEGER NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
        monto DECIMAL(10,2) NOT NULL,
        concepto TEXT NOT NULL,
        referencia TEXT,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        FOREIGN KEY (sesion_id) REFERENCES caja_sesiones(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `,
};

export function prepareTable(tableName) {
    if (!tableSchemas[tableName]) {
      throw new Error(`No schema defined for table: ${tableName}`);
    }
    
    try {
      db.exec(tableSchemas[tableName]);
      console.log(`${tableName} table prepared successfully`);
    } catch (error) {
      console.error(`Error preparing ${tableName} table:`, error);
      throw error;
    }
}

export function initializeDatabase() {
  try {
    // Make sure all tables are created
    migrateDatabase();
    
    // Check if any clients exist in the database
    const clientCount = db.prepare('SELECT COUNT(*) as count FROM clientes').get().count;

    // If no clients exist, create a default client
    if (clientCount === 0) {
      console.log("🔄 Creating default client...");
      
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
      
      console.log("✅ Default client created successfully");
    }
    
    return true;
  } catch (error) {
    console.error("❌ Error initializing database:", error);
    throw error;
  }
}

export function migrateDatabase() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const currentVersion = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get()?.version || 0;
    
    // First create all tables in proper order
    if (currentVersion < 1) {
      // Create all tables in proper order
      const tableOrder = [
        'usuarios',
        'categorias', 
        'productos',
        'proveedores',
        'clientes',
        'ventas',          // Create ventas table first
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
    
    // Then, add any column alterations as a separate migration
    if (currentVersion < 2) {
      try {
        // Make sure the ventas table exists before trying to alter it
        db.exec("CREATE TABLE IF NOT EXISTS ventas (id INTEGER PRIMARY KEY AUTOINCREMENT)");
        
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
        console.log("Migration #2 completed successfully");
      } catch (migrationError) {
        console.error('Error in migration #2:', migrationError);
        throw migrationError; // Stop if migration fails instead of continuing
      }
    }
    
    // Add thermal printer and PDF configuration options
    if (currentVersion < 3) {
      try {
        db.exec(`
          ALTER TABLE configuracion ADD COLUMN impresora_termica   TEXT;
          ALTER TABLE configuracion ADD COLUMN guardar_pdf         INTEGER DEFAULT 1;
          ALTER TABLE configuracion ADD COLUMN ruta_pdf            TEXT;
        `);
        db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(3);
        console.log("Migration #3 completed successfully");
      } catch (migrationError) {
        console.error('Error in migration #3:', migrationError);
        throw migrationError;
      }
    }

    // Add printer type configuration
    if (currentVersion < 4) {
      db.exec("ALTER TABLE configuracion ADD COLUMN tipo_impresora TEXT DEFAULT 'normal'");
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(4);
    }

    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}