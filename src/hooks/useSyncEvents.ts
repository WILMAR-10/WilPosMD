// src/hooks/useSyncEvents.ts
import { useEffect, useRef, useCallback } from 'react';

export interface SyncEvent {
  type: string;
  action: string;
  data: any;
  timestamp: string;
}

export type SyncEventHandler = (event: SyncEvent) => void;

/**
 * Hook personalizado para manejar eventos de sincronización en tiempo real
 * Este hook permite a los componentes reaccionar a cambios de datos desde otras ventanas/pestañas
 */
export function useSyncEvents() {
  const handlersRef = useRef<Map<string, Set<SyncEventHandler>>>(new Map());

  // Registrar listener global una sola vez
  useEffect(() => {
    const handleSyncEvent = (event: CustomEvent<SyncEvent>) => {
      const syncEvent = event.detail;
      const key = `${syncEvent.type}:${syncEvent.action}`;
      
      console.log(`🔄 Received sync event: ${key}`, syncEvent.data);
      
      // Ejecutar handlers específicos
      const specificHandlers = handlersRef.current.get(key);
      if (specificHandlers) {
        specificHandlers.forEach(handler => handler(syncEvent));
      }
      
      // Ejecutar handlers genéricos para el tipo
      const typeHandlers = handlersRef.current.get(syncEvent.type);
      if (typeHandlers) {
        typeHandlers.forEach(handler => handler(syncEvent));
      }
      
      // Ejecutar handlers que escuchan todos los eventos
      const allHandlers = handlersRef.current.get('*');
      if (allHandlers) {
        allHandlers.forEach(handler => handler(syncEvent));
      }
    };

    // Registrar el listener de eventos
    if (window.api?.registerSyncListener) {
      window.api.registerSyncListener();
    }

    // Escuchar eventos personalizados
    window.addEventListener('sync-event', handleSyncEvent as EventListener);

    return () => {
      window.removeEventListener('sync-event', handleSyncEvent as EventListener);
      if (window.api?.unregisterSyncListener) {
        window.api.unregisterSyncListener();
      }
    };
  }, []);

  // Función para suscribirse a eventos específicos
  const subscribe = useCallback((eventKey: string, handler: SyncEventHandler) => {
    if (!handlersRef.current.has(eventKey)) {
      handlersRef.current.set(eventKey, new Set());
    }
    handlersRef.current.get(eventKey)!.add(handler);

    // Retornar función de cleanup
    return () => {
      const handlers = handlersRef.current.get(eventKey);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          handlersRef.current.delete(eventKey);
        }
      }
    };
  }, []);

  // Función para enviar eventos de sincronización
  const broadcast = useCallback((type: string, action: string, data: any) => {
    const syncEvent: SyncEvent = {
      type,
      action,
      data,
      timestamp: new Date().toISOString()
    };

    if (window.api?.broadcastSyncEvent) {
      window.api.broadcastSyncEvent(syncEvent);
    }
    
    console.log(`🚀 Broadcasting sync event: ${type}:${action}`, data);
  }, []);

  return {
    subscribe,
    broadcast
  };
}

/**
 * Hook específico para sincronización de productos
 */
export function useProductSync() {
  const { subscribe, broadcast } = useSyncEvents();

  const subscribeToProducts = useCallback((handler: SyncEventHandler) => {
    return subscribe('product', handler);
  }, [subscribe]);

  const subscribeToInventory = useCallback((handler: SyncEventHandler) => {
    return subscribe('inventory', handler);
  }, [subscribe]);

  const broadcastProductCreated = useCallback((product: any) => {
    broadcast('product', 'created', { product });
  }, [broadcast]);

  const broadcastProductUpdated = useCallback((id: string | number, product: any, changes: any) => {
    broadcast('product', 'updated', { id, product, changes });
  }, [broadcast]);

  const broadcastProductDeleted = useCallback((id: string | number) => {
    broadcast('product', 'deleted', { id });
  }, [broadcast]);

  const broadcastStockUpdated = useCallback((id: string | number, product: any, cantidad: number, motivo: string) => {
    broadcast('inventory', 'stock_updated', { id, product, cantidad, motivo });
  }, [broadcast]);

  return {
    subscribeToProducts,
    subscribeToInventory,
    broadcastProductCreated,
    broadcastProductUpdated,
    broadcastProductDeleted,
    broadcastStockUpdated
  };
}

/**
 * Hook específico para sincronización de ventas
 */
export function useSalesSync() {
  const { subscribe, broadcast } = useSyncEvents();

  const subscribeToSales = useCallback((handler: SyncEventHandler) => {
    return subscribe('sale', handler);
  }, [subscribe]);

  const broadcastSaleCreated = useCallback((id: string | number, sale: any, detalles: any[]) => {
    broadcast('sale', 'created', { id, sale, detalles });
  }, [broadcast]);

  const broadcastSaleCancelled = useCallback((id: string | number) => {
    broadcast('sale', 'cancelled', { id });
  }, [broadcast]);

  return {
    subscribeToSales,
    broadcastSaleCreated,
    broadcastSaleCancelled
  };
}