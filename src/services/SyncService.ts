// src/services/SyncService.ts
import { useEffect } from 'react';

// Define sync event types
export type SyncEventType = 
  'product:update' | 
  'product:delete' | 
  'sale:create' | 
  'inventory:update' |
  'category:update' |
  'settings:update';

// Define sync event structure
export interface SyncEvent {
  type: SyncEventType;
  data?: any;
  timestamp: number;
}

// Custom hook to subscribe to sync events
export function useSyncListener(
  eventType: SyncEventType | SyncEventType[], 
  callback: (event: SyncEvent) => void
) {
  useEffect(() => {
    const handleSyncEvent = (event: CustomEvent<SyncEvent>) => {
      const syncEvent = event.detail;
      
      // Check if we should handle this event type
      const eventTypes = Array.isArray(eventType) ? eventType : [eventType];
      if (eventTypes.includes(syncEvent.type)) {
        callback(syncEvent);
      }
    };

    // Add listener for sync events
    window.addEventListener('sync-event', handleSyncEvent as EventListener);
    
    // Register to receive events from main process
    if (window.api?.registerSyncListener) {
      window.api.registerSyncListener();
    }
    
    return () => {
      window.removeEventListener('sync-event', handleSyncEvent as EventListener);
      if (window.api?.unregisterSyncListener) {
        window.api.unregisterSyncListener();
      }
    };
  }, [eventType, callback]);
}

// Function to trigger sync events across windows
export function broadcastSyncEvent(type: SyncEventType, data?: any) {
  const syncEvent: SyncEvent = {
    type,
    data,
    timestamp: Date.now()
  };

  // Send event to local window
  const event = new CustomEvent('sync-event', { detail: syncEvent });
  window.dispatchEvent(event);
  
  // Send event to other windows via IPC if possible
  if (window.api?.broadcastSyncEvent) {
    window.api.broadcastSyncEvent(syncEvent);
  }
}