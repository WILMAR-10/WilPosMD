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
    descuentos:`
        CREATE TABLE IF NOT EXISTS descuentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        tipo TEXT NOT NULL CHECK (tipo IN ('porcentaje', 'monto_fijo')),
        valor DECIMAL(10,2) NOT NULL,
        aplicable_a TEXT NOT NULL CHECK (aplicable_a IN ('producto', 'categoria', 'total')),
        producto_id INTEGER,
        categoria TEXT,
        monto_minimo DECIMAL(10,2) DEFAULT 0,
        fecha_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_fin DATETIME,
        activo INTEGER DEFAULT 1,
        uso_limitado INTEGER DEFAULT 0,
        usos_maximos INTEGER DEFAULT 0,
        usos_actuales INTEGER DEFAULT 0,
        codigo_cupon TEXT UNIQUE,
        automatico INTEGER DEFAULT 0,
        dias_semana TEXT, -- JSON array con días aplicables [1,2,3,4,5,6,0]
        horas_inicio TIME,
        horas_fin TIME,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_creador_id INTEGER,
        FOREIGN KEY (producto_id) REFERENCES productos(id),
        FOREIGN KEY (usuario_creador_id) REFERENCES usuarios(id)
        )
    `,
    ofertas:`
        CREATE TABLE IF NOT EXISTS ofertas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        tipo TEXT NOT NULL CHECK (tipo IN ('2x1', '3x2', 'combo', 'descuento_cantidad')),
        productos_requeridos TEXT NOT NULL, -- JSON array con productos e info: [{"producto_id": 1, "cantidad": 2}]
        productos_gratis TEXT, -- JSON array para ofertas tipo 2x1, 3x2: [{"producto_id": 1, "cantidad": 1}]
        precio_combo DECIMAL(10,2), -- Para ofertas tipo combo
        descuento_porcentaje DECIMAL(5,2), -- Para descuentos por cantidad
        cantidad_minima INTEGER DEFAULT 1,
        fecha_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_fin DATETIME,
        activo INTEGER DEFAULT 1,
        uso_limitado INTEGER DEFAULT 0,
        usos_maximos INTEGER DEFAULT 0,
        usos_actuales INTEGER DEFAULT 0,
        dias_semana TEXT, -- JSON array con días aplicables
        horas_inicio TIME,
        horas_fin TIME,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_creador_id INTEGER,
        FOREIGN KEY (usuario_creador_id) REFERENCES usuarios(id)
        )
    `,
    descuentos_aplicados:`
        CREATE TABLE IF NOT EXISTS descuentos_aplicados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venta_id INTEGER NOT NULL,
        descuento_id INTEGER,
        oferta_id INTEGER,
        tipo TEXT NOT NULL CHECK (tipo IN ('descuento', 'oferta')),
        nombre TEXT NOT NULL,
        valor_aplicado DECIMAL(10,2) NOT NULL,
        fecha_aplicacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (venta_id) REFERENCES ventas(id),
        FOREIGN KEY (descuento_id) REFERENCES descuentos(id),
        FOREIGN KEY (oferta_id) REFERENCES ofertas(id)
        )
    `,
    activos_fijos:`
        CREATE TABLE IF NOT EXISTS activos_fijos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        categoria TEXT NOT NULL CHECK (categoria IN ('equipo', 'mobiliario', 'vehiculo', 'inmueble', 'tecnologia')),
        valor_inicial DECIMAL(10,2) NOT NULL,
        valor_actual DECIMAL(10,2) NOT NULL,
        fecha_adquisicion DATE NOT NULL,
        vida_util_anos INTEGER DEFAULT 5,
        depreciacion_anual DECIMAL(10,2) DEFAULT 0,
        estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'vendido', 'descartado')),
        ubicacion TEXT,
        proveedor TEXT,
        numero_serie TEXT,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `,
    cuentas_por_pagar:`
        CREATE TABLE IF NOT EXISTS cuentas_por_pagar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        proveedor_id INTEGER,
        descripcion TEXT NOT NULL,
        monto_total DECIMAL(10,2) NOT NULL,
        monto_pagado DECIMAL(10,2) DEFAULT 0,
        saldo_pendiente DECIMAL(10,2) NOT NULL,
        fecha_factura DATE NOT NULL,
        fecha_vencimiento DATE NOT NULL,
        estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'vencido')),
        categoria TEXT,
        numero_factura TEXT,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        FOREIGN KEY (proveedor_id) REFERENCES proveedores(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `,
    cuentas_por_cobrar:`
        CREATE TABLE IF NOT EXISTS cuentas_por_cobrar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER NOT NULL,
        venta_id INTEGER,
        descripcion TEXT NOT NULL,
        monto_total DECIMAL(10,2) NOT NULL,
        monto_cobrado DECIMAL(10,2) DEFAULT 0,
        saldo_pendiente DECIMAL(10,2) NOT NULL,
        fecha_venta DATE NOT NULL,
        fecha_vencimiento DATE NOT NULL,
        estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'cobrado', 'vencido')),
        numero_factura TEXT,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        FOREIGN KEY (cliente_id) REFERENCES clientes(id),
        FOREIGN KEY (venta_id) REFERENCES ventas(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `,
    patrimonio:`
        CREATE TABLE IF NOT EXISTS patrimonio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        concepto TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('capital_inicial', 'utilidades_retenidas', 'aporte_socio', 'retiro_socio')),
        monto DECIMAL(10,2) NOT NULL,
        fecha DATE NOT NULL,
        descripcion TEXT,
        socio_nombre TEXT,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `,
    flujo_efectivo:`
        CREATE TABLE IF NOT EXISTS flujo_efectivo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo_actividad TEXT NOT NULL CHECK (tipo_actividad IN ('operativa', 'inversion', 'financiacion')),
        concepto TEXT NOT NULL,
        monto DECIMAL(10,2) NOT NULL,
        tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('entrada', 'salida')),
        fecha DATE NOT NULL,
        descripcion TEXT,
        referencia_id INTEGER, -- Puede referenciar ventas, gastos, etc.
        referencia_tabla TEXT, -- 'ventas', 'gastos', 'activos_fijos', etc.
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `,
    
    // =====================================================
    // TABLAS PARA REPORTES FINANCIEROS COMPLETOS
    // =====================================================
    activos:`
        CREATE TABLE IF NOT EXISTS activos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('fijo', 'corriente', 'intangible')),
        categoria TEXT, -- 'maquinaria', 'inventario', 'efectivo', 'cuentas_por_cobrar'
        valor_inicial DECIMAL(12,2) NOT NULL,
        depreciacion_acumulada DECIMAL(12,2) DEFAULT 0,
        valor_actual DECIMAL(12,2) NOT NULL,
        vida_util_anos INTEGER DEFAULT 0,
        fecha_adquisicion DATE DEFAULT CURRENT_DATE,
        descripcion TEXT,
        activo INTEGER DEFAULT 1,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        ultima_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `,
    
    pasivos:`
        CREATE TABLE IF NOT EXISTS pasivos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('corriente', 'largo_plazo')),
        categoria TEXT, -- 'cuentas_por_pagar', 'prestamos', 'impuestos_por_pagar', 'sueldos_por_pagar'
        monto DECIMAL(12,2) NOT NULL,
        saldo_pendiente DECIMAL(12,2) NOT NULL,
        fecha_vencimiento DATE,
        proveedor_id INTEGER,
        descripcion TEXT,
        estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'vencido')),
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        ultima_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        FOREIGN KEY (proveedor_id) REFERENCES proveedores(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `,
    
    patrimonio:`
        CREATE TABLE IF NOT EXISTS patrimonio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        concepto TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('capital', 'utilidades_retenidas', 'utilidad_ejercicio')),
        monto DECIMAL(12,2) NOT NULL,
        fecha DATE DEFAULT CURRENT_DATE,
        descripcion TEXT,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `,
    
    gastos_operativos:`
        CREATE TABLE IF NOT EXISTS gastos_operativos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descripcion TEXT NOT NULL,
        categoria TEXT NOT NULL, -- 'alquiler', 'servicios', 'sueldos', 'marketing', 'suministros'
        subcategoria TEXT, -- 'electricidad', 'agua', 'internet', etc.
        monto DECIMAL(10,2) NOT NULL,
        fecha DATE DEFAULT CURRENT_DATE,
        metodo_pago TEXT DEFAULT 'Efectivo',
        proveedor_id INTEGER,
        comprobante TEXT, -- Número de factura/recibo
        deducible_impuestos INTEGER DEFAULT 1,
        notas TEXT,
        estado TEXT DEFAULT 'pagado' CHECK (estado IN ('pendiente', 'pagado', 'anulado')),
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        FOREIGN KEY (proveedor_id) REFERENCES proveedores(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `,
    
    flujo_efectivo:`
        CREATE TABLE IF NOT EXISTS flujo_efectivo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL CHECK (tipo IN ('operativo', 'inversion', 'financiamiento')),
        concepto TEXT NOT NULL,
        categoria TEXT NOT NULL, -- 'venta', 'compra', 'gasto', 'inversion', 'prestamo'
        monto DECIMAL(12,2) NOT NULL, -- Positivo para entradas, negativo para salidas
        fecha DATE DEFAULT CURRENT_DATE,
        referencia_id INTEGER, -- ID de la venta, compra, gasto, etc.
        referencia_tipo TEXT, -- 'venta', 'gasto', 'activo', 'pasivo'
        descripcion TEXT,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `,
    
    // =====================================================
    // TABLAS PARA SISTEMA DE DESCUENTOS Y OFERTAS
    // =====================================================
    descuentos:`
        CREATE TABLE IF NOT EXISTS descuentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        tipo TEXT NOT NULL CHECK (tipo IN ('porcentaje', 'monto_fijo', 'buy_x_get_y', 'categoria')),
        valor DECIMAL(10,2) NOT NULL, -- Porcentaje (15.00) o Monto (50.00)
        valor_secundario INTEGER DEFAULT 0, -- Para Buy X Get Y (cantidad gratis)
        categoria_id INTEGER, -- Para descuentos por categoría
        codigo_cupon TEXT UNIQUE, -- Código opcional para cupones
        fecha_inicio DATE,
        fecha_fin DATE,
        cantidad_minima INTEGER DEFAULT 1, -- Cantidad mínima para aplicar
        monto_minimo_compra DECIMAL(10,2) DEFAULT 0, -- Monto mínimo de compra
        limite_uso INTEGER DEFAULT 0, -- 0 = ilimitado
        usos_realizados INTEGER DEFAULT 0,
        activo INTEGER DEFAULT 1,
        solo_primera_compra INTEGER DEFAULT 0,
        combinable INTEGER DEFAULT 1, -- Se puede combinar con otros descuentos
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        ultima_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `,
    
    ofertas_productos:`
        CREATE TABLE IF NOT EXISTS ofertas_productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descuento_id INTEGER NOT NULL,
        producto_id INTEGER,
        categoria_id INTEGER,
        cantidad_requerida INTEGER DEFAULT 1,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (descuento_id) REFERENCES descuentos(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES productos(id),
        FOREIGN KEY (categoria_id) REFERENCES categorias(id),
        CHECK (producto_id IS NOT NULL OR categoria_id IS NOT NULL)
        )
    `,
    
    descuentos_aplicados:`
        CREATE TABLE IF NOT EXISTS descuentos_aplicados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venta_id INTEGER NOT NULL,
        descuento_id INTEGER NOT NULL,
        monto_descuento DECIMAL(10,2) NOT NULL,
        porcentaje_aplicado DECIMAL(5,2),
        productos_afectados TEXT, -- JSON con productos que recibieron el descuento
        codigo_usado TEXT,
        fecha_aplicacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (venta_id) REFERENCES ventas(id),
        FOREIGN KEY (descuento_id) REFERENCES descuentos(id)
        )
    `,
    
    // =====================================================
    // TABLA PARA COMPRAS A PROVEEDORES
    // =====================================================
    compras:`
        CREATE TABLE IF NOT EXISTS compras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        proveedor_id INTEGER NOT NULL,
        numero_factura TEXT,
        numero_ncf TEXT, -- Número de Comprobante Fiscal (Rep. Dominicana)
        subtotal DECIMAL(12,2) NOT NULL,
        itbis DECIMAL(12,2) NOT NULL DEFAULT 0,
        total DECIMAL(12,2) NOT NULL,
        estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'recibida', 'pagada', 'anulada')),
        metodo_pago TEXT,
        fecha_compra DATE DEFAULT CURRENT_DATE,
        fecha_vencimiento DATE,
        fecha_pago DATE,
        notas TEXT,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        FOREIGN KEY (proveedor_id) REFERENCES proveedores(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `,
    
    compra_detalles:`
        CREATE TABLE IF NOT EXISTS compra_detalles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        compra_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        cantidad INTEGER NOT NULL,
        precio_unitario DECIMAL(10,2) NOT NULL,
        costo_final DECIMAL(10,2) NOT NULL, -- Para actualizar costo del producto
        itbis DECIMAL(4,2) DEFAULT 0.18,
        subtotal DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (compra_id) REFERENCES compras(id),
        FOREIGN KEY (producto_id) REFERENCES productos(id)
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
        'caja_transacciones',
        'descuentos',
        'ofertas',
        'descuentos_aplicados',
        'activos_fijos',
        'cuentas_por_pagar',
        'cuentas_por_cobrar',
        'patrimonio',
        'flujo_efectivo'
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
        // Check if columns already exist before adding them
        const tableInfo = db.prepare(`PRAGMA table_info(configuracion)`).all();
        const existingColumns = tableInfo.map(col => col.name);
        
        const columnsToAdd = [
          { name: 'impresora_termica', def: 'TEXT' },
          { name: 'guardar_pdf', def: 'INTEGER DEFAULT 1' },
          { name: 'ruta_pdf', def: 'TEXT' }
        ];
        
        const alterStatements = columnsToAdd
          .filter(col => !existingColumns.includes(col.name))
          .map(col => `ALTER TABLE configuracion ADD COLUMN ${col.name} ${col.def};`)
          .join('\n');
          
        if (alterStatements) {
          db.exec(alterStatements);
        }
        
        db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(3);
        console.log("Migration #3 completed successfully");
      } catch (migrationError) {
        console.error('Error in migration #3:', migrationError);
        // Don't throw error for column already exists
        if (!migrationError.message.includes('duplicate column name')) {
          throw migrationError;
        } else {
          // Column already exists, just mark migration as complete
          try {
            db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(3);
            console.log("Migration #3 completed (columns already exist)");
          } catch (insertError) {
            // Migration already marked complete, ignore
            if (!insertError.message.includes('UNIQUE constraint failed')) {
              throw insertError;
            }
          }
        }
      }
    }

    // Add printer type configuration
    if (currentVersion < 4) {
      db.exec("ALTER TABLE configuracion ADD COLUMN tipo_impresora TEXT DEFAULT 'normal'");
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(4);
    }

    // Add auto_cut and open_cash_drawer columns
    if (currentVersion < 5) {
      try {
        db.exec(`
          ALTER TABLE configuracion ADD COLUMN auto_cut INTEGER DEFAULT 1;
          ALTER TABLE configuracion ADD COLUMN open_cash_drawer INTEGER DEFAULT 0;
        `);
        db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(5);
        console.log("Migration #5 completed successfully: Added auto_cut and open_cash_drawer columns");
      } catch (migrationError) {
        console.error('Error in migration #5:', migrationError);
        throw migrationError;
      }
    }

    // Add discount and offers system tables
    if (currentVersion < 6) {
      try {
        const newTables = ['descuentos', 'ofertas', 'descuentos_aplicados'];
        
        for (const table of newTables) {
          prepareTable(table);
        }
        
        db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(6);
        console.log("Migration #6 completed successfully: Added discount and offers system tables");
      } catch (migrationError) {
        console.error('Error in migration #6:', migrationError);
        throw migrationError;
      }
    }

    // Add financial reporting tables
    if (currentVersion < 7) {
      try {
        const financialTables = [
          'activos_fijos', 
          'cuentas_por_pagar', 
          'cuentas_por_cobrar', 
          'patrimonio', 
          'flujo_efectivo'
        ];
        
        for (const table of financialTables) {
          prepareTable(table);
        }
        
        db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(7);
        console.log("Migration #7 completed successfully: Added financial reporting tables");
      } catch (migrationError) {
        console.error('Error in migration #7:', migrationError);
        throw migrationError;
      }
    }

    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}