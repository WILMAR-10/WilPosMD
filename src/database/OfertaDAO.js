// src/database/OfertaDAO.js
import { getDB } from './db.js';

export default class OfertaDAO {
  static getAll() {
    try {
      const db = getDB();
      return db.prepare(`
        SELECT * FROM ofertas
        ORDER BY fecha_creacion DESC
      `).all();
    } catch (error) {
      console.error('Error getting all ofertas:', error);
      throw error;
    }
  }

  static getActiveOffers() {
    try {
      const db = getDB();
      const now = new Date().toISOString();
      const currentTime = new Date().toTimeString().slice(0, 8);
      
      return db.prepare(`
        SELECT * FROM ofertas
        WHERE activo = 1 
        AND (fecha_fin IS NULL OR fecha_fin > ?)
        AND (uso_limitado = 0 OR usos_actuales < usos_maximos)
        AND (horas_inicio IS NULL OR horas_fin IS NULL OR 
             (? BETWEEN horas_inicio AND horas_fin))
        ORDER BY fecha_creacion DESC
      `).all(now, currentTime);
    } catch (error) {
      console.error('Error getting active offers:', error);
      throw error;
    }
  }

  static getById(id) {
    try {
      const db = getDB();
      return db.prepare('SELECT * FROM ofertas WHERE id = ?').get(id);
    } catch (error) {
      console.error('Error getting oferta by id:', error);
      throw error;
    }
  }

  static create(oferta) {
    try {
      const db = getDB();
      const stmt = db.prepare(`
        INSERT INTO ofertas (
          nombre, descripcion, tipo, productos_requeridos, productos_gratis,
          precio_combo, descuento_porcentaje, cantidad_minima, fecha_inicio,
          fecha_fin, activo, uso_limitado, usos_maximos, dias_semana,
          horas_inicio, horas_fin, usuario_creador_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        oferta.nombre,
        oferta.descripcion || null,
        oferta.tipo,
        JSON.stringify(oferta.productos_requeridos || []),
        JSON.stringify(oferta.productos_gratis || []),
        oferta.precio_combo || null,
        oferta.descuento_porcentaje || null,
        oferta.cantidad_minima || 1,
        oferta.fecha_inicio || new Date().toISOString(),
        oferta.fecha_fin || null,
        oferta.activo !== undefined ? oferta.activo : 1,
        oferta.uso_limitado || 0,
        oferta.usos_maximos || 0,
        JSON.stringify(oferta.dias_semana || []),
        oferta.horas_inicio || null,
        oferta.horas_fin || null,
        oferta.usuario_creador_id || null
      );
      
      return { id: result.lastInsertRowid, ...oferta };
    } catch (error) {
      console.error('Error creating oferta:', error);
      throw error;
    }
  }

  static update(id, oferta) {
    try {
      const db = getDB();
      const stmt = db.prepare(`
        UPDATE ofertas SET
          nombre = ?, descripcion = ?, tipo = ?, productos_requeridos = ?,
          productos_gratis = ?, precio_combo = ?, descuento_porcentaje = ?,
          cantidad_minima = ?, fecha_inicio = ?, fecha_fin = ?, activo = ?,
          uso_limitado = ?, usos_maximos = ?, dias_semana = ?,
          horas_inicio = ?, horas_fin = ?
        WHERE id = ?
      `);
      
      const result = stmt.run(
        oferta.nombre,
        oferta.descripcion || null,
        oferta.tipo,
        JSON.stringify(oferta.productos_requeridos || []),
        JSON.stringify(oferta.productos_gratis || []),
        oferta.precio_combo || null,
        oferta.descuento_porcentaje || null,
        oferta.cantidad_minima || 1,
        oferta.fecha_inicio,
        oferta.fecha_fin || null,
        oferta.activo !== undefined ? oferta.activo : 1,
        oferta.uso_limitado || 0,
        oferta.usos_maximos || 0,
        JSON.stringify(oferta.dias_semana || []),
        oferta.horas_inicio || null,
        oferta.horas_fin || null,
        id
      );
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating oferta:', error);
      throw error;
    }
  }

  static delete(id) {
    try {
      const db = getDB();
      const result = db.prepare('DELETE FROM ofertas WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting oferta:', error);
      throw error;
    }
  }

  static toggleActive(id) {
    try {
      const db = getDB();
      const current = db.prepare('SELECT activo FROM ofertas WHERE id = ?').get(id);
      if (!current) return false;
      
      const newStatus = current.activo === 1 ? 0 : 1;
      const result = db.prepare('UPDATE ofertas SET activo = ? WHERE id = ?').run(newStatus, id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error toggling oferta status:', error);
      throw error;
    }
  }

  static incrementUsage(id) {
    try {
      const db = getDB();
      const result = db.prepare(`
        UPDATE ofertas 
        SET usos_actuales = usos_actuales + 1 
        WHERE id = ?
      `).run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error incrementing offer usage:', error);
      throw error;
    }
  }

  static getApplicableOffers(productos) {
    try {
      const offers = this.getActiveOffers();
      const applicable = [];
      
      for (const offer of offers) {
        const productosRequeridos = JSON.parse(offer.productos_requeridos || '[]');
        
        if (this.canApplyOffer(offer, productos, productosRequeridos)) {
          applicable.push({
            ...offer,
            productos_requeridos: productosRequeridos,
            productos_gratis: JSON.parse(offer.productos_gratis || '[]'),
            dias_semana: JSON.parse(offer.dias_semana || '[]')
          });
        }
      }
      
      return applicable;
    } catch (error) {
      console.error('Error getting applicable offers:', error);
      throw error;
    }
  }

  static canApplyOffer(offer, productosCarrito, productosRequeridos) {
    try {
      switch (offer.tipo) {
        case '2x1':
        case '3x2':
          // Verificar si hay suficientes productos requeridos
          for (const requerido of productosRequeridos) {
            const productoEnCarrito = productosCarrito.find(p => p.id === requerido.producto_id);
            if (!productoEnCarrito || productoEnCarrito.cantidad < requerido.cantidad) {
              return false;
            }
          }
          return true;
          
        case 'combo':
          // Verificar que todos los productos del combo estén en el carrito
          for (const requerido of productosRequeridos) {
            const productoEnCarrito = productosCarrito.find(p => p.id === requerido.producto_id);
            if (!productoEnCarrito || productoEnCarrito.cantidad < requerido.cantidad) {
              return false;
            }
          }
          return true;
          
        case 'descuento_cantidad':
          // Verificar cantidad mínima de productos específicos
          const totalCantidad = productosRequeridos.reduce((sum, requerido) => {
            const productoEnCarrito = productosCarrito.find(p => p.id === requerido.producto_id);
            return sum + (productoEnCarrito?.cantidad || 0);
          }, 0);
          
          return totalCantidad >= offer.cantidad_minima;
          
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking if offer can be applied:', error);
      return false;
    }
  }

  static calculateOfferDiscount(offer, productos) {
    try {
      const productosRequeridos = JSON.parse(offer.productos_requeridos || '[]');
      const productosGratis = JSON.parse(offer.productos_gratis || '[]');
      
      switch (offer.tipo) {
        case '2x1':
        case '3x2':
          // Calcular descuento basado en productos gratis
          let descuentoGratis = 0;
          for (const gratis of productosGratis) {
            const producto = productos.find(p => p.id === gratis.producto_id);
            if (producto) {
              descuentoGratis += producto.precio_venta * gratis.cantidad;
            }
          }
          return descuentoGratis;
          
        case 'combo':
          // Calcular diferencia entre precio normal y precio combo
          const precioNormal = productosRequeridos.reduce((sum, req) => {
            const producto = productos.find(p => p.id === req.producto_id);
            return sum + (producto ? producto.precio_venta * req.cantidad : 0);
          }, 0);
          
          return Math.max(0, precioNormal - offer.precio_combo);
          
        case 'descuento_cantidad':
          // Aplicar porcentaje de descuento
          const totalAplicable = productosRequeridos.reduce((sum, req) => {
            const producto = productos.find(p => p.id === req.producto_id);
            const productoCarrito = productos.find(p => p.id === req.producto_id);
            const cantidad = Math.min(req.cantidad, productoCarrito?.cantidad || 0);
            return sum + (producto ? producto.precio_venta * cantidad : 0);
          }, 0);
          
          return totalAplicable * (offer.descuento_porcentaje / 100);
          
        default:
          return 0;
      }
    } catch (error) {
      console.error('Error calculating offer discount:', error);
      return 0;
    }
  }
}