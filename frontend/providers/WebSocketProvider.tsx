'use client';

import { useEffect, useRef } from 'react';
import { useProduct } from './ProductProvider';
import { WebSocketClient } from '@/lib/admin/websocket';
import { handleWebSocketEvent } from '@/lib/admin/websocket-events';

/**
 * WebSocket provider that connects to the backend for real-time updates.
 *
 * Automatically connects when a help center is selected and disconnects
 * when the help center changes or the component unmounts.
 *
 * Dispatches CustomEvents that components can listen to for data updates.
 */
export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { currentProductId } = useProduct();
  const wsClientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    // Don't connect if no help center is selected
    if (!currentProductId) {
      console.log('[WebSocketProvider] No product selected, skipping connection');
      return;
    }

    console.log(
      '[WebSocketProvider] Connecting WebSocket for help center:',
      currentProductId
    );

    // Create WebSocket client
    const wsClient = new WebSocketClient(currentProductId);

    // Listen to all events
    const unsubscribe = wsClient.on('*', (event) => {
      console.log('[WebSocketProvider] Event received:', event.type, event.data);
      handleWebSocketEvent(event);
    });

    // Connect
    wsClient.connect();

    // Store reference for cleanup
    wsClientRef.current = wsClient;

    // Cleanup on unmount or when help center changes
    return () => {
      console.log(
        '[WebSocketProvider] Disconnecting WebSocket for help center:',
        currentProductId
      );
      unsubscribe();
      wsClient.disconnect();
      wsClientRef.current = null;
    };
  }, [currentProductId]);

  return <>{children}</>;
}

