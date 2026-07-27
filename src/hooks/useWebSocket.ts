import { useState, useEffect, useRef, useCallback } from 'react';
import { websocketService } from '../services/websocketService';
import type {
  ConnectionState,
  MessageHandler,
  RawMessageHandler,
} from '../types/websocket';

interface UseWebSocketOptions {
  /** Disable auto-connect (default: false) */
  disabled?: boolean;
  /** Use raw message handler instead of parsed ServerMessage (for stream mode like logs) */
  subscriptionMode?: boolean;
}

interface UseWebSocketReturn {
  connectionState: ConnectionState;
  subscribe: (resource: string, ids?: string[]) => void;
  unsubscribe: (resource: string, ids?: string[]) => void;
}

/**
 * React hook wrapping WebSocketService for component lifecycle management.
 *
 * @param connectionId - Unique connection identifier
 * @param url - Full WebSocket URL
 * @param onMessage - Callback for parsed ServerMessage events (subscription mode)
 * @param options - Hook options
 */
export function useWebSocket(
  connectionId: string,
  url: string,
  onMessage?: MessageHandler | RawMessageHandler,
  options?: UseWebSocketOptions,
): UseWebSocketReturn {
  const { disabled = false, subscriptionMode = true } = options ?? {};
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Stable wrapper that delegates to the latest onMessage ref
  const stableMessageHandler = useRef<MessageHandler | RawMessageHandler | null>(null);

  useEffect(() => {
    if (disabled) return;

    websocketService.connect(connectionId, url, { subscriptionMode });
    websocketService.onStateChange(connectionId, setConnectionState);

    // Set initial state
    setConnectionState(websocketService.getState(connectionId));

    // Register message handler
    if (onMessageRef.current) {
      if (subscriptionMode) {
        const handler: MessageHandler = (msg) => {
          (onMessageRef.current as MessageHandler)?.(msg);
        };
        stableMessageHandler.current = handler;
        websocketService.onMessage(connectionId, handler);
      } else {
        const handler: RawMessageHandler = (data) => {
          (onMessageRef.current as RawMessageHandler)?.(data);
        };
        stableMessageHandler.current = handler;
        websocketService.onRawMessage(connectionId, handler);
      }
    }

    return () => {
      websocketService.offStateChange(connectionId, setConnectionState);
      if (stableMessageHandler.current) {
        if (subscriptionMode) {
          websocketService.offMessage(connectionId, stableMessageHandler.current as MessageHandler);
        } else {
          websocketService.offRawMessage(connectionId, stableMessageHandler.current as RawMessageHandler);
        }
        stableMessageHandler.current = null;
      }
      websocketService.disconnect(connectionId);
    };
  }, [connectionId, url, disabled, subscriptionMode]);

  const subscribe = useCallback(
    (resource: string, ids?: string[]) => websocketService.subscribe(connectionId, resource, ids),
    [connectionId],
  );

  const unsubscribe = useCallback(
    (resource: string, ids?: string[]) => websocketService.unsubscribe(connectionId, resource, ids),
    [connectionId],
  );

  return { connectionState, subscribe, unsubscribe };
}
