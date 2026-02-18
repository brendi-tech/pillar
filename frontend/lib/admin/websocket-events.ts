/**
 * WebSocket event handlers for notifying components of real-time updates.
 *
 * Uses CustomEvent to dispatch events that components can listen to.
 * Components can use useEffect to listen for these events and refetch data.
 */

import { WebSocketEvent } from './websocket';

/**
 * Handle WebSocket events and dispatch custom events for components to listen to.
 *
 * Components can listen for these events using:
 * ```typescript
 * useEffect(() => {
 *   const handler = () => {
 *     // Refetch data or update state
 *     fetchSources();
 *   };
 *   window.addEventListener('websocket:source.updated', handler);
 *   return () => window.removeEventListener('websocket:source.updated', handler);
 * }, []);
 * ```
 *
 * @param event - WebSocket event received from backend
 */
export function handleWebSocketEvent(event: WebSocketEvent): void {
  switch (event.type) {
    case 'source.sync_status':
      // Dispatch event for source sync updates
      window.dispatchEvent(
        new CustomEvent('websocket:source.updated', {
          detail: event.data,
        })
      );
      if (event.data?.source_id) {
        window.dispatchEvent(
          new CustomEvent(`websocket:source.${event.data.source_id}.updated`, {
            detail: event.data,
          })
        );
      }
      break;

    case 'knowledge_item.created':
      console.log('[WebSocket] Knowledge item created:', event.data);
      window.dispatchEvent(
        new CustomEvent('websocket:knowledge_item.created', {
          detail: event.data,
        })
      );
      break;

    case 'knowledge_item.processed':
      console.log('[WebSocket] Knowledge item processed:', event.data);
      window.dispatchEvent(
        new CustomEvent('websocket:knowledge_item.processed', {
          detail: event.data,
        })
      );
      if (event.data?.id) {
        window.dispatchEvent(
          new CustomEvent(`websocket:knowledge_item.${event.data.id}.processed`, {
            detail: event.data,
          })
        );
      }
      break;

    case 'source.sync_completed':
      console.log('[WebSocket] Source sync completed:', event.data);
      window.dispatchEvent(
        new CustomEvent('websocket:source.sync_completed', {
          detail: event.data,
        })
      );
      // Also dispatch general source updated event
      if (event.data?.source_id) {
        window.dispatchEvent(
          new CustomEvent(`websocket:source.${event.data.source_id}.updated`, {
            detail: event.data,
          })
        );
      }
      break;

    case 'source.sync_failed':
      console.log('[WebSocket] Source sync failed:', event.data);
      window.dispatchEvent(
        new CustomEvent('websocket:source.sync_failed', {
          detail: event.data,
        })
      );
      if (event.data?.source_id) {
        window.dispatchEvent(
          new CustomEvent(`websocket:source.${event.data.source_id}.updated`, {
            detail: event.data,
          })
        );
      }
      break;

    case 'actions.sync_completed':
      console.log('[WebSocket] Actions sync completed:', event.data);
      window.dispatchEvent(
        new CustomEvent('websocket:actions.sync_completed', {
          detail: event.data,
        })
      );
      break;

    case 'connection.established':
      console.log('[WebSocket] Connection established:', event.data);
      break;

    case 'connection.closed':
      console.log('[WebSocket] Connection closed:', event.data);
      break;

    case 'connection.failed':
      console.error('[WebSocket] Connection failed:', event.data);
      break;

    default:
      // Unknown event type - log for debugging but don't break
      console.log('[WebSocket] Unhandled event type:', event.type, event.data);
  }
}
