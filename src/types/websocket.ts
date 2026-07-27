/**
 * WebSocket types for krkn-operator-console v2 API
 *
 * Supports two connection patterns:
 * - Stream: unidirectional server→client (e.g., log streaming)
 * - Subscription: bidirectional subscribe/unsubscribe + server push (e.g., runs, graphruns)
 */

// Connection state
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

// Client → Server messages (subscription pattern only)
export interface SubscribeMessage {
  action: 'subscribe';
  resource: string;
  ids?: string[];
}

export interface UnsubscribeMessage {
  action: 'unsubscribe';
  resource: string;
  ids?: string[];
}

export type ClientMessage = SubscribeMessage | UnsubscribeMessage;

// Server → Client messages (subscription pattern)
export type ServerEventType = 'updated' | 'created' | 'deleted';

export interface ServerMessage<T = unknown> {
  resource: string;
  id: string;
  event: ServerEventType;
  data: T;
}

// Event handlers
export type MessageHandler<T = unknown> = (message: ServerMessage<T>) => void;
export type RawMessageHandler = (data: string) => void;
export type ConnectionStateHandler = (state: ConnectionState) => void;

// Subscription tracking (persisted across reconnects)
export interface Subscription {
  resource: string;
  ids?: string[];
}

// Connection configuration
export interface WebSocketConnectionOptions {
  /** Max reconnect attempts before giving up (default: 10) */
  maxReconnectAttempts?: number;
  /** Base delay in ms for exponential backoff (default: 2000) */
  baseReconnectDelay?: number;
  /** Max delay cap in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Whether this connection uses the subscription protocol (default: true) */
  subscriptionMode?: boolean;
}

// Internal connection state tracked by the service
export interface ManagedConnection {
  ws: WebSocket;
  url: string;
  options: Required<WebSocketConnectionOptions>;
  state: ConnectionState;
  refCount: number;
  reconnectAttempts: number;
  reconnectTimeout: number | null;
  subscriptions: Subscription[];
  messageHandlers: Set<MessageHandler>;
  rawMessageHandlers: Set<RawMessageHandler>;
  stateHandlers: Set<ConnectionStateHandler>;
  isCleanedUp: boolean;
}
