// src/hooks/useOptimizedSync.ts
import { useCallback, useRef, useEffect } from 'react';
import { useSyncEvents, SyncEvent } from './useSyncEvents';

/**
 * Hook optimizado para sincronización con actualizaciones granulares
 * Evita re-renders completos y permite actualizaciones más suaves
 */
export function useOptimizedSync() {
  const { subscribe } = useSyncEvents();
  const updateQueueRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastUpdateRef = useRef<Map<string, number>>(new Map());
  
  // Debouncer para evitar múltiples actualizaciones
  const debounce = useCallback((key: string, callback: () => void, delay: number = 300) => {
    // Limpiar timeout anterior si existe
    const existingTimeout = updateQueueRef.current.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Establecer nuevo timeout
    const newTimeout = setTimeout(() => {
      callback();
      updateQueueRef.current.delete(key);
      lastUpdateRef.current.set(key, Date.now());
    }, delay);
    
    updateQueueRef.current.set(key, newTimeout);
  }, []);

  // Verificar si una actualización es muy reciente
  const isRecentUpdate = useCallback((key: string, threshold: number = 1000) => {
    const lastUpdate = lastUpdateRef.current.get(key);
    return lastUpdate ? (Date.now() - lastUpdate) < threshold : false;
  }, []);

  // Cleanup de timeouts
  useEffect(() => {
    return () => {
      updateQueueRef.current.forEach(timeout => clearTimeout(timeout));
      updateQueueRef.current.clear();
    };
  }, []);

  return {
    debounce,
    isRecentUpdate,
    subscribe
  };
}

/**
 * Hook para productos con actualizaciones optimizadas y estado granular
 */
export function useOptimizedProductSync(
  products: any[],
  setProducts: (updater: (prev: any[]) => any[]) => void
) {
  const { debounce, isRecentUpdate, subscribe } = useOptimizedSync();

  useEffect(() => {
    const unsubscribe = subscribe('product', (event: SyncEvent) => {
      const productKey = `product-${event.data.id}`;
      
      // Solo procesar si NO es una actualización reciente local
      if (isRecentUpdate(productKey, 3000)) {
        console.log('⏭️ Skipping recent local update for product:', event.data.id);
        return;
      }

      // Los eventos vienen como product:updated, product:created, etc
      const action = event.type?.split(':')[1] || 'updated';
      
      console.log('🔄 Processing remote product sync:', action, event.data.id);
      
      switch (action) {
        case 'created':
          if (event.data.product) {
            debounce(productKey, () => {
              setProducts(prev => {
                const existingProductIndex = prev.findIndex(product => product.id === event.data.id);
                const newProductData = event.data.product;
                
                // Validar que los datos no estén corruptos
                if (!newProductData.nombre || newProductData.nombre.trim() === '') {
                  console.warn('🚫 Skipping corrupt product data:', newProductData);
                  return prev;
                }
                
                if (existingProductIndex === -1) {
                  // Producto nuevo - agregar al array
                  console.log('➕ Adding new product to cash register:', newProductData.nombre);
                  return [
                    ...prev,
                    {
                      ...newProductData,
                      _isUpdated: true,
                      _isNew: true,
                      _updateTimestamp: Date.now()
                    }
                  ];
                } else {
                  console.log('⚠️ Product already exists, updating instead:', newProductData.nombre);
                  // Si ya existe, actualizar
                  return prev.map(product => {
                    if (product.id === event.data.id) {
                      return { 
                        ...product, 
                        ...newProductData,
                        _isUpdated: true,
                        _updateTimestamp: Date.now()
                      };
                    }
                    return product;
                  });
                }
              });

              // Limpiar flags después de animación
              setTimeout(() => {
                setProducts(current => current.map(p => 
                  p.id === event.data.id 
                    ? { ...p, _isUpdated: false, _isNew: false }
                    : p
                ));
              }, 2500); // Un poco más de tiempo para productos nuevos
            }, 200);
          }
          break;

        case 'updated':
          if (event.data.product) {
            debounce(productKey, () => {
              setProducts(prev => prev.map(product => {
                if (product.id === event.data.id) {
                  // Solo actualizar con datos válidos del evento
                  const updatedData = event.data.product;
                  
                  // Validar que los datos no estén corruptos
                  if (!updatedData.nombre || updatedData.nombre.trim() === '') {
                    console.warn('🚫 Skipping corrupt product data:', updatedData);
                    return product; // Mantener datos originales
                  }
                  
                  return { 
                    ...product, 
                    ...updatedData,
                    _isUpdated: true,
                    _updateTimestamp: Date.now()
                  };
                }
                return product;
              }));

              // Limpiar flags después de animación
              setTimeout(() => {
                setProducts(current => current.map(p => 
                  p.id === event.data.id 
                    ? { ...p, _isUpdated: false }
                    : p
                ));
              }, 2000);
            }, 200);
          }
          break;

        case 'deleted':
          debounce(productKey, () => {
            setProducts(prev => prev.filter(product => product.id !== event.data.id));
          }, 100);
          break;
      }
    });

    return unsubscribe;
  }, [subscribe, setProducts, debounce, isRecentUpdate]);

  return { debounce };
}

/**
 * Hook para inventario con actualizaciones de stock optimizadas y granulares
 */
export function useOptimizedInventorySync(
  setProducts: (updater: (prev: any[]) => any[]) => void
) {
  const { debounce, isRecentUpdate, subscribe } = useOptimizedSync();

  useEffect(() => {
    // Listener para eventos de inventario directo
    const unsubscribeInventory = subscribe('inventory', (event: SyncEvent) => {
      if (event.data.action !== 'stock_updated') return;

      const stockKey = `stock-${event.data.data.id}`;
      
      // Evitar actualizaciones muy frecuentes
      if (isRecentUpdate(stockKey, 500)) {
        return;
      }

      console.log('🔄 Optimized stock update:', event.data);

      debounce(stockKey, () => {
        setProducts(prev => prev.map(product => {
          if (product.id === event.data.data.id) {
            const oldStock = Number(product.stock) || 0;
            const newStock = event.data.data.product?.stock ?? product.stock;
            const stockChange = newStock - oldStock;
            
            return { 
              ...product, 
              stock: newStock,
              _stockUpdated: true,
              _stockChange: stockChange,
              _stockAnimation: stockChange > 0 ? 'increase' : stockChange < 0 ? 'decrease' : 'neutral',
              _updateTimestamp: Date.now()
            };
          }
          return product;
        }));

        // Remover flags de animación después de un momento
        setTimeout(() => {
          setProducts(prev => prev.map(product => 
            product.id === event.data.data.id
              ? { 
                  ...product, 
                  _stockUpdated: false, 
                  _stockChange: undefined,
                  _stockAnimation: undefined 
                }
              : product
          ));
        }, 2500);
      }, 200);
    });

    // Listener para eventos de venta (que afectan el stock)
    const unsubscribeSale = subscribe('sale', (event: SyncEvent) => {
      if (event.action !== 'create') return;

      console.log('🔄 Sale sync - updating stock:', event.data);

      // Actualizar stock para cada producto vendido
      if (event.data.products && Array.isArray(event.data.products)) {
        event.data.products.forEach((saleItem: {id: number, quantity: number}) => {
          const stockKey = `stock-${saleItem.id}`;
          
          debounce(stockKey, () => {
            setProducts(prev => prev.map(product => {
              if (product.id === saleItem.id) {
                const oldStock = Number(product.stock) || 0;
                const newStock = Math.max(0, oldStock - saleItem.quantity);
                const stockChange = newStock - oldStock;
                
                return { 
                  ...product, 
                  stock: newStock,
                  _stockUpdated: true,
                  _stockChange: stockChange,
                  _stockAnimation: 'decrease',
                  _updateTimestamp: Date.now()
                };
              }
              return product;
            }));

            // Remover flags de animación después de un momento
            setTimeout(() => {
              setProducts(prev => prev.map(product => 
                product.id === saleItem.id
                  ? { 
                      ...product, 
                      _stockUpdated: false, 
                      _stockChange: undefined,
                      _stockAnimation: undefined 
                    }
                  : product
              ));
            }, 2500);
          }, 300);
        });
      }
    });

    return () => {
      unsubscribeInventory();
      unsubscribeSale();
    };
  }, [subscribe, setProducts, debounce, isRecentUpdate]);
}

/**
 * Hook para carrito con actualizaciones inteligentes
 */
export function useOptimizedCartSync(
  cart: any[],
  setCart: (updater: (prev: any[]) => any[]) => void,
  showAlert: (alert: { type: string; message: string }) => void
) {
  const { subscribe } = useOptimizedSync();

  useEffect(() => {
    const unsubscribe = subscribe('product', (event: SyncEvent) => {
      if (event.action === 'deleted') {
        // Verificar si el producto eliminado está en el carrito
        const isInCart = cart.some(item => item.product_id === event.data.id);
        
        if (isInCart) {
          // Remover silenciosamente del carrito sin mostrar alert
          setCart(prev => prev.filter(item => item.product_id !== event.data.id));
        }
      }
      
      if (event.action === 'updated' && event.data.product) {
        // Actualizar precios en el carrito si cambiaron
        setCart(prev => prev.map(item => 
          item.product_id === event.data.id
            ? {
                ...item,
                name: event.data.product.nombre,
                price: event.data.product.precio_venta,
                // Recalcular subtotal
                subtotal: item.quantity * event.data.product.precio_venta
              }
            : item
        ));
      }
    });

    return unsubscribe;
  }, [subscribe, cart, setCart, showAlert]);
}