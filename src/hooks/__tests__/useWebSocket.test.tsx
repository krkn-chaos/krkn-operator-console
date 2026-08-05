import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ConnectionState } from '../../types/websocket';

// Mock websocketService
const mockConnect = vi.fn((_id: string) => _id);
const mockDisconnect = vi.fn();
const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();
const mockOnMessage = vi.fn();
const mockOffMessage = vi.fn();
const mockOnRawMessage = vi.fn();
const mockOffRawMessage = vi.fn();
const mockOnStateChange = vi.fn();
const mockOffStateChange = vi.fn();
const mockGetState = vi.fn<() => ConnectionState>(() => 'disconnected');

vi.mock('../../services/websocketService', () => ({
  websocketService: {
    connect: (...args: Parameters<typeof mockConnect>) => mockConnect(...args),
    disconnect: (...args: Parameters<typeof mockDisconnect>) => mockDisconnect(...args),
    subscribe: (...args: Parameters<typeof mockSubscribe>) => mockSubscribe(...args),
    unsubscribe: (...args: Parameters<typeof mockUnsubscribe>) => mockUnsubscribe(...args),
    onMessage: (...args: Parameters<typeof mockOnMessage>) => mockOnMessage(...args),
    offMessage: (...args: Parameters<typeof mockOffMessage>) => mockOffMessage(...args),
    onRawMessage: (...args: Parameters<typeof mockOnRawMessage>) => mockOnRawMessage(...args),
    offRawMessage: (...args: Parameters<typeof mockOffRawMessage>) => mockOffRawMessage(...args),
    onStateChange: (...args: Parameters<typeof mockOnStateChange>) => mockOnStateChange(...args),
    offStateChange: (...args: Parameters<typeof mockOffStateChange>) => mockOffStateChange(...args),
    getState: (...args: Parameters<typeof mockGetState>) => mockGetState(...args),
  },
}));

import { useWebSocket } from '../useWebSocket';

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetState.mockReturnValue('disconnected');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should connect on mount and disconnect on unmount', () => {
    const { unmount } = renderHook(() =>
      useWebSocket('test-conn', 'ws://localhost/test')
    );

    expect(mockConnect).toHaveBeenCalledWith('test-conn', 'ws://localhost/test', { subscriptionMode: true });
    expect(mockOnStateChange).toHaveBeenCalledWith('test-conn', expect.any(Function));

    unmount();

    expect(mockOffStateChange).toHaveBeenCalledWith('test-conn', expect.any(Function));
    expect(mockDisconnect).toHaveBeenCalledWith('test-conn');
  });

  it('should not connect when disabled', () => {
    renderHook(() =>
      useWebSocket('test-disabled', 'ws://localhost/test', undefined, { disabled: true })
    );

    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('should register message handler in subscription mode', () => {
    const handler = vi.fn();

    renderHook(() =>
      useWebSocket('test-handler', 'ws://localhost/test', handler)
    );

    expect(mockOnMessage).toHaveBeenCalledWith('test-handler', expect.any(Function));
    expect(mockOnRawMessage).not.toHaveBeenCalled();
  });

  it('should register raw message handler in stream mode', () => {
    const handler = vi.fn();

    renderHook(() =>
      useWebSocket('test-stream', 'ws://localhost/test', handler, { subscriptionMode: false })
    );

    expect(mockOnRawMessage).toHaveBeenCalledWith('test-stream', expect.any(Function));
    expect(mockOnMessage).not.toHaveBeenCalled();
  });

  it('should expose connectionState from service', () => {
    mockGetState.mockReturnValue('connected');

    const { result } = renderHook(() =>
      useWebSocket('test-state', 'ws://localhost/test')
    );

    expect(result.current.connectionState).toBe('connected');
  });

  it('should update connectionState reactively via stateChange handler', () => {
    let capturedHandler: ((state: ConnectionState) => void) | null = null;
    mockOnStateChange.mockImplementation((_id: string, handler: (state: ConnectionState) => void) => {
      capturedHandler = handler;
    });

    const { result } = renderHook(() =>
      useWebSocket('test-reactive', 'ws://localhost/test')
    );

    expect(result.current.connectionState).toBe('disconnected');

    act(() => {
      capturedHandler?.('connected');
    });

    expect(result.current.connectionState).toBe('connected');
  });

  it('should provide stable subscribe/unsubscribe callbacks', () => {
    const { result } = renderHook(() =>
      useWebSocket('test-callbacks', 'ws://localhost/test')
    );

    act(() => {
      result.current.subscribe('run', ['run-1']);
    });

    expect(mockSubscribe).toHaveBeenCalledWith('test-callbacks', 'run', ['run-1'], undefined, undefined);

    act(() => {
      result.current.unsubscribe('run', ['run-1']);
    });

    expect(mockUnsubscribe).toHaveBeenCalledWith('test-callbacks', 'run', ['run-1']);
  });

  it('should forward pagination params to subscribe', () => {
    const { result } = renderHook(() =>
      useWebSocket('test-pagination', 'ws://localhost/test')
    );

    act(() => {
      result.current.subscribe('jobs', undefined, 2, 20);
    });

    expect(mockSubscribe).toHaveBeenCalledWith('test-pagination', 'jobs', undefined, 2, 20);
  });

  it('should clean up handlers on unmount in subscription mode', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useWebSocket('test-cleanup', 'ws://localhost/test', handler)
    );

    unmount();

    expect(mockOffMessage).toHaveBeenCalledWith('test-cleanup', expect.any(Function));
    expect(mockOffStateChange).toHaveBeenCalledWith('test-cleanup', expect.any(Function));
    expect(mockDisconnect).toHaveBeenCalledWith('test-cleanup');
  });

  it('should clean up handlers on unmount in stream mode', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useWebSocket('test-cleanup-raw', 'ws://localhost/test', handler, { subscriptionMode: false })
    );

    unmount();

    expect(mockOffRawMessage).toHaveBeenCalledWith('test-cleanup-raw', expect.any(Function));
    expect(mockDisconnect).toHaveBeenCalledWith('test-cleanup-raw');
  });
});
