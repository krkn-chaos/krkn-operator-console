/**
 * Centralized WebSocket service for krkn-operator-console.
 *
 * Manages all WebSocket connections (log streaming & subscription-based updates).
 * Auth, reconnection, and StrictMode dedup are handled here so consumers
 * only deal with connect/subscribe/onMessage.
 */

import { authService } from './authService';
import { config } from '../config';
import type {
  ConnectionState,
  ClientMessage,
  ServerMessage,
  MessageHandler,
  RawMessageHandler,
  ConnectionStateHandler,
  Subscription,
  WebSocketConnectionOptions,
  ManagedConnection,
} from '../types/websocket';

const DEFAULT_OPTIONS: Required<WebSocketConnectionOptions> = {
  maxReconnectAttempts: 10,
  baseReconnectDelay: 2000,
  maxReconnectDelay: 30000,
  subscriptionMode: true,
};

class WebSocketService {
  private connections = new Map<string, ManagedConnection>();

  /**
   * Build a full WebSocket URL from a path.
   * Detects ws:/wss: from current page protocol.
   */
  buildUrl(path: string): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}${path}`;
  }

  /**
   * Build WebSocket URL for a v2 resource endpoint.
   * @param resource - e.g. 'runs', 'graphruns', 'dashboard/active-runs'
   */
  buildResourceUrl(resource: string): string {
    return this.buildUrl(`${config.wsBaseUrl}/${resource}`);
  }

  /**
   * Build WebSocket URL for job log streaming.
   * v2 endpoint is under /ws/ for semantic consistency with other v2 WebSocket endpoints.
   */
  buildJobLogsUrl(scenarioRunName: string, jobId: string, follow = true): string {
    const path = `/api/v2/ws/scenarios/run/${encodeURIComponent(scenarioRunName)}/jobs/${encodeURIComponent(jobId)}/logs`;
    const query = follow ? '?follow=true' : '';
    return this.buildUrl(`${path}${query}`);
  }

  /**
   * Open a WebSocket connection (or increment refCount if already open).
   *
   * @param connectionId - Unique key for this connection (e.g. 'runs', or `logs-${jobId}`)
   * @param url - Full WebSocket URL
   * @param options - Connection options
   * @returns connectionId (same as input, for chaining)
   */
  connect(connectionId: string, url: string, options?: WebSocketConnectionOptions): string {
    const existing = this.connections.get(connectionId);
    if (existing && !existing.isCleanedUp && existing.ws &&
        (existing.ws.readyState === WebSocket.CONNECTING || existing.ws.readyState === WebSocket.OPEN)) {
      existing.refCount++;
      return connectionId;
    }

    const mergedOptions: Required<WebSocketConnectionOptions> = { ...DEFAULT_OPTIONS, ...options };

    const conn: ManagedConnection = {
      ws: null!,  // set in createWebSocket
      url,
      options: mergedOptions,
      state: 'disconnected',
      refCount: 1,
      reconnectAttempts: 0,
      reconnectTimeout: null,
      subscriptions: [],
      messageHandlers: new Set(),
      rawMessageHandlers: new Set(),
      stateHandlers: new Set(),
      isCleanedUp: false,
    };

    this.connections.set(connectionId, conn);
    this.createWebSocket(connectionId, conn);
    return connectionId;
  }

  /**
   * Decrement refCount; close WebSocket when it reaches 0.
   */
  disconnect(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    conn.refCount--;
    if (conn.refCount <= 0) {
      conn.isCleanedUp = true;
      if (conn.reconnectTimeout !== null) {
        clearTimeout(conn.reconnectTimeout);
        conn.reconnectTimeout = null;
      }
      if (conn.ws && (conn.ws.readyState === WebSocket.CONNECTING || conn.ws.readyState === WebSocket.OPEN)) {
        conn.ws.close(1000, 'Client disconnect');
      }
      this.connections.delete(connectionId);
    }
  }

  /**
   * Send a subscribe message over a subscription-mode connection.
   * Subscriptions are persisted and re-sent on reconnect.
   */
  subscribe(connectionId: string, resource: string, ids?: string[]): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    const sub: Subscription = { resource, ids };
    const alreadySubscribed = conn.subscriptions.some(
      s => s.resource === resource && JSON.stringify(s.ids) === JSON.stringify(ids)
    );
    if (!alreadySubscribed) {
      conn.subscriptions.push(sub);
    }

    if (conn.ws?.readyState === WebSocket.OPEN) {
      this.sendClientMessage(conn, { action: 'subscribe', resource, ids });
    }
  }

  /**
   * Send an unsubscribe message and remove from persistent subscriptions.
   */
  unsubscribe(connectionId: string, resource: string, ids?: string[]): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    conn.subscriptions = conn.subscriptions.filter(
      s => !(s.resource === resource && JSON.stringify(s.ids) === JSON.stringify(ids))
    );

    if (conn.ws?.readyState === WebSocket.OPEN) {
      this.sendClientMessage(conn, { action: 'unsubscribe', resource, ids });
    }
  }

  /**
   * Register a handler for parsed ServerMessage events (subscription mode).
   */
  onMessage<T = unknown>(connectionId: string, handler: MessageHandler<T>): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;
    conn.messageHandlers.add(handler as MessageHandler);
  }

  /**
   * Remove a parsed message handler.
   */
  offMessage<T = unknown>(connectionId: string, handler: MessageHandler<T>): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;
    conn.messageHandlers.delete(handler as MessageHandler);
  }

  /**
   * Register a handler for raw string messages (stream mode, e.g. logs).
   */
  onRawMessage(connectionId: string, handler: RawMessageHandler): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;
    conn.rawMessageHandlers.add(handler);
  }

  /**
   * Remove a raw message handler.
   */
  offRawMessage(connectionId: string, handler: RawMessageHandler): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;
    conn.rawMessageHandlers.delete(handler);
  }

  /**
   * Register a handler for connection state changes.
   */
  onStateChange(connectionId: string, handler: ConnectionStateHandler): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;
    conn.stateHandlers.add(handler);
  }

  /**
   * Remove a state change handler.
   */
  offStateChange(connectionId: string, handler: ConnectionStateHandler): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;
    conn.stateHandlers.delete(handler);
  }

  /**
   * Get the current connection state.
   */
  getState(connectionId: string): ConnectionState {
    return this.connections.get(connectionId)?.state ?? 'disconnected';
  }

  /**
   * Check if a connection exists and is not cleaned up.
   */
  hasConnection(connectionId: string): boolean {
    const conn = this.connections.get(connectionId);
    return !!conn && !conn.isCleanedUp;
  }

  // --- Private ---

  private createWebSocket(connectionId: string, conn: ManagedConnection): void {
    if (conn.isCleanedUp) return;

    const token = authService.getToken();
    if (!token) {
      this.setState(conn, 'error');
      return;
    }

    this.setState(conn, conn.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    try {
      const wsProtocol = `access_token.${token}`;
      const ws = new WebSocket(conn.url, wsProtocol);
      conn.ws = ws;

      ws.onopen = () => {
        if (conn.isCleanedUp) return;
        conn.reconnectAttempts = 0;
        this.setState(conn, 'connected');
        this.resubscribeAll(conn);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (conn.isCleanedUp) return;
        const data = event.data as string;

        // Emit to raw handlers (stream mode consumers like LogViewer)
        for (const handler of conn.rawMessageHandlers) {
          handler(data);
        }

        // Try to parse as ServerMessage for subscription-mode consumers
        if (conn.options.subscriptionMode && conn.messageHandlers.size > 0) {
          try {
            const parsed: ServerMessage = JSON.parse(data);
            if (parsed.resource && parsed.event) {
              for (const handler of conn.messageHandlers) {
                handler(parsed);
              }
            }
          } catch {
            // Not JSON — ignore for subscription handlers
          }
        }
      };

      ws.onerror = () => {
        // Handled in onclose
      };

      ws.onclose = (event: CloseEvent) => {
        if (conn.isCleanedUp) return;

        // Auth failure — don't reconnect
        if (event.code === 1002 || event.code === 1008) {
          this.setState(conn, 'error');
          return;
        }

        // Normal closure
        if (event.code === 1000) {
          this.setState(conn, 'disconnected');
          return;
        }

        // Abnormal closure — attempt reconnect
        this.scheduleReconnect(connectionId, conn);
      };
    } catch {
      this.scheduleReconnect(connectionId, conn);
    }
  }

  private scheduleReconnect(connectionId: string, conn: ManagedConnection): void {
    if (conn.isCleanedUp) return;

    conn.reconnectAttempts++;
    if (conn.reconnectAttempts >= conn.options.maxReconnectAttempts) {
      this.setState(conn, 'error');
      return;
    }

    this.setState(conn, 'reconnecting');

    // Exponential backoff: baseDelay * 1.5^(attempts-1), capped
    const delay = Math.min(
      conn.options.baseReconnectDelay * Math.pow(1.5, conn.reconnectAttempts - 1),
      conn.options.maxReconnectDelay,
    );

    conn.reconnectTimeout = window.setTimeout(() => {
      conn.reconnectTimeout = null;
      this.createWebSocket(connectionId, conn);
    }, delay);
  }

  private resubscribeAll(conn: ManagedConnection): void {
    if (!conn.options.subscriptionMode) return;
    for (const sub of conn.subscriptions) {
      this.sendClientMessage(conn, { action: 'subscribe', resource: sub.resource, ids: sub.ids });
    }
  }

  private sendClientMessage(conn: ManagedConnection, message: ClientMessage): void {
    if (conn.ws?.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(message));
    }
  }

  private setState(conn: ManagedConnection, state: ConnectionState): void {
    if (conn.state === state) return;
    conn.state = state;
    for (const handler of conn.stateHandlers) {
      handler(state);
    }
  }
}

export const websocketService = new WebSocketService();
