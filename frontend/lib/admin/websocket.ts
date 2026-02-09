/**
 * WebSocket Client for Real-Time Push Notifications
 *
 * Copyright (C) 2025 Pillar Team
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { getAuthToken } from './api-client';

const WS_BASE_URL =
  process.env.NEXT_PUBLIC_PILLAR_WS_URL ||
  (process.env.NEXT_PUBLIC_PILLAR_API_URL || 'http://localhost:8003').replace(
    /^http/,
    'ws'
  );

export type WebSocketEventType = string;

export interface WebSocketEvent<T = any> {
  type: WebSocketEventType;
  data: T;
}

export type WebSocketEventHandler<T = any> = (event: WebSocketEvent<T>) => void;

/**
 * WebSocket client for receiving real-time push notifications from the backend.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - JWT authentication via query params
 * - Type-safe event handlers
 * - Connection state management
 *
 * Usage:
 * ```typescript
 * const ws = new WebSocketClient(helpCenterConfigId)
 *
 * // Listen for specific events
 * ws.on('walkthrough.status', (event) => {
 *   console.log('Walkthrough update:', event.data)
 * })
 *
 * // Listen for all events
 * ws.on('*', (event) => {
 *   console.log('Event:', event.type, event.data)
 * })
 *
 * // Connect
 * ws.connect()
 *
 * // Disconnect when done
 * ws.disconnect()
 * ```
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private helpCenterConfigId: string;
  private handlers: Map<WebSocketEventType, Set<WebSocketEventHandler>>;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private intentionallyClosed = false;
  private connectionState:
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'reconnecting' = 'disconnected';

  constructor(helpCenterConfigId: string) {
    this.helpCenterConfigId = helpCenterConfigId;
    this.handlers = new Map();
  }

  /**
   * Register an event handler for a specific event type.
   * Use '*' as the event type to listen to all events.
   */
  on<T = any>(
    eventType: WebSocketEventType,
    handler: WebSocketEventHandler<T>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.handlers.delete(eventType);
        }
      }
    };
  }

  /**
   * Remove an event handler.
   */
  off(eventType: WebSocketEventType, handler: WebSocketEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  /**
   * Remove all event handlers for a specific type, or all handlers if no type specified.
   */
  removeAllListeners(eventType?: WebSocketEventType): void {
    if (eventType) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Get current connection state.
   */
  getState(): 'disconnected' | 'connecting' | 'connected' | 'reconnecting' {
    return this.connectionState;
  }

  /**
   * Check if currently connected.
   */
  isConnected(): boolean {
    return (
      this.connectionState === 'connected' &&
      this.ws?.readyState === WebSocket.OPEN
    );
  }

  /**
   * Connect to the WebSocket server.
   */
  connect(): void {
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) {
      console.log('[WebSocket] Already connected or connecting');
      return;
    }

    this.intentionallyClosed = false;
    this.connectionState =
      this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting';

    // Get JWT token
    const token = this.getToken();
    if (!token) {
      console.error('[WebSocket] No authentication token available');
      this.connectionState = 'disconnected';
      return;
    }

    // Build WebSocket URL
    const wsUrl = `${WS_BASE_URL}/ws/hc/${this.helpCenterConfigId}/?token=${encodeURIComponent(token)}`;

    try {
      console.log(
        `[WebSocket] Connecting to help center ${this.helpCenterConfigId}...`
      );
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server.
   */
  disconnect(): void {
    this.intentionallyClosed = true;
    this.connectionState = 'disconnected';

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    console.log('[WebSocket] Disconnected');
  }

  private handleOpen(event: Event): void {
    console.log(
      `[WebSocket] Connected to help center ${this.helpCenterConfigId}`
    );
    this.connectionState = 'connected';
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;

    // Emit connection event
    this.emitEvent({
      type: 'connection.established',
      data: { helpCenterConfigId: this.helpCenterConfigId },
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      this.emitEvent(message);
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  }

  private handleError(event: Event): void {
    console.error('[WebSocket] Error:', event);
  }

  private handleClose(event: CloseEvent): void {
    console.log(
      `[WebSocket] Connection closed (code: ${event.code}, reason: ${event.reason})`
    );
    this.ws = null;

    if (this.intentionallyClosed) {
      this.connectionState = 'disconnected';
      return;
    }

    // Emit disconnection event
    this.emitEvent({
      type: 'connection.closed',
      data: { code: event.code, reason: event.reason },
    });

    // Handle different close codes
    if (event.code === 4001) {
      console.error('[WebSocket] Authentication failed: No token provided');
      this.connectionState = 'disconnected';
    } else if (event.code === 4002) {
      console.error('[WebSocket] Authentication failed: Invalid token');
      this.connectionState = 'disconnected';
    } else if (event.code === 4003) {
      console.error(
        '[WebSocket] Authorization failed: No access to help center'
      );
      this.connectionState = 'disconnected';
    } else {
      // Schedule reconnection for other close codes
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionallyClosed) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      this.connectionState = 'disconnected';
      this.emitEvent({
        type: 'connection.failed',
        data: { reason: 'Max reconnection attempts reached' },
      });
      return;
    }

    this.reconnectAttempts++;
    this.connectionState = 'reconnecting';

    // Exponential backoff
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private emitEvent(event: WebSocketEvent): void {
    // Call specific event handlers
    const specificHandlers = this.handlers.get(event.type);
    if (specificHandlers) {
      specificHandlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error(
            `[WebSocket] Error in event handler for ${event.type}:`,
            error
          );
        }
      });
    }

    // Call wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error('[WebSocket] Error in wildcard event handler:', error);
        }
      });
    }
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    // Use the same token retrieval method as the admin API client
    return getAuthToken() || null;
  }
}

/**
 * Create and connect a WebSocket client for a help center.
 *
 * @param helpCenterConfigId - The help center config UUID to connect to
 * @returns WebSocketClient instance (already connecting)
 */
export function createWebSocket(
  helpCenterConfigId: string
): WebSocketClient {
  const client = new WebSocketClient(helpCenterConfigId);
  client.connect();
  return client;
}




