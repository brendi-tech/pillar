/**
 * Hook for listening to WebSocket events dispatched by WebSocketProvider.
 *
 * Components can use this to automatically refetch data when WebSocket events arrive.
 *
 * @example
 * ```tsx
 * function WalkthroughSection() {
 *   const [walkthroughs, setWalkthroughs] = useState([]);
 *
 *   // Refetch when walkthrough events arrive
 *   useWebSocketEvent('websocket:walkthrough.updated', () => {
 *     fetchWalkthroughs();
 *   });
 *
 *   // ... rest of component
 * }
 * ```
 */

import { useEffect } from 'react';

/**
 * Listen to a WebSocket custom event and call a handler when it fires.
 *
 * @param eventName - The custom event name (e.g., 'websocket:walkthrough.updated')
 * @param handler - Function to call when the event fires
 */
export function useWebSocketEvent(
  eventName: string,
  handler: (event: CustomEvent) => void
): void {
  useEffect(() => {
    const eventHandler = (event: Event) => {
      handler(event as CustomEvent);
    };

    window.addEventListener(eventName, eventHandler);

    return () => {
      window.removeEventListener(eventName, eventHandler);
    };
  }, [eventName, handler]);
}




