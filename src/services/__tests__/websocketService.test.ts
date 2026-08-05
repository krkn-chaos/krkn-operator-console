import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock authService before importing websocketService
vi.mock('../authService', () => ({
  authService: {
    getToken: vi.fn(() => 'mock-jwt-token'),
  },
}));

vi.mock('../../config', () => ({
  config: {
    wsBaseUrl: '/api/v2/ws',
  },
}));

// Mock WebSocket
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  url: string;
  protocol: string | string[];
  readyState = MockWebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  binaryType: BinaryType = 'blob';
  bufferedAmount = 0;
  extensions = '';
  sent: string[] = [];

  constructor(url: string, protocol?: string | string[]) {
    this.url = url;
    this.protocol = protocol ?? '';
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code ?? 1000, reason }));
    }
  }

  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return false; }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: string) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  simulateClose(code = 1006, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code, reason }));
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }

  static instances: MockWebSocket[] = [];
  static clear() {
    MockWebSocket.instances = [];
  }
  static get latest(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}

// Install mock
const originalWebSocket = globalThis.WebSocket;
beforeEach(() => {
  MockWebSocket.clear();
  (globalThis as unknown as Record<string, unknown>).WebSocket = MockWebSocket as unknown as typeof WebSocket;
});
afterEach(() => {
  (globalThis as unknown as Record<string, unknown>).WebSocket = originalWebSocket;
  vi.restoreAllMocks();
});

// Import after mocks are set up
import { websocketService } from '../websocketService';
import { authService } from '../authService';
import type { ConnectionState, ServerMessage } from '../../types/websocket';

describe('WebSocketService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(authService.getToken).mockReturnValue('mock-jwt-token');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('connect', () => {
    it('should create a WebSocket with auth subprotocol', () => {
      websocketService.connect('test-1', 'ws://localhost/test');

      const ws = MockWebSocket.latest!;
      expect(ws).toBeDefined();
      expect(ws.url).toBe('ws://localhost/test');
      expect(ws.protocol).toBe('access_token.mock-jwt-token');

      websocketService.disconnect('test-1');
    });

    it('should increment refCount for existing open connection', () => {
      websocketService.connect('test-ref', 'ws://localhost/test');
      MockWebSocket.latest!.simulateOpen();

      const countBefore = MockWebSocket.instances.length;
      websocketService.connect('test-ref', 'ws://localhost/test');
      expect(MockWebSocket.instances.length).toBe(countBefore);

      // Need two disconnects to fully close
      websocketService.disconnect('test-ref');
      expect(websocketService.hasConnection('test-ref')).toBe(true);
      websocketService.disconnect('test-ref');
      expect(websocketService.hasConnection('test-ref')).toBe(false);
    });

    it('should emit error state when no auth token', () => {
      vi.mocked(authService.getToken).mockReturnValue(null);
      const stateHandler = vi.fn();

      websocketService.connect('test-noauth', 'ws://localhost/test');
      websocketService.onStateChange('test-noauth', stateHandler);

      // State was already set before we registered the handler,
      // so check getState directly
      expect(websocketService.getState('test-noauth')).toBe('error');

      websocketService.disconnect('test-noauth');
    });
  });

  describe('connection state', () => {
    it('should transition through connecting → connected on open', () => {
      const states: ConnectionState[] = [];
      websocketService.connect('test-states', 'ws://localhost/test');
      websocketService.onStateChange('test-states', (s) => states.push(s));

      MockWebSocket.latest!.simulateOpen();
      expect(states).toContain('connected');
      expect(websocketService.getState('test-states')).toBe('connected');

      websocketService.disconnect('test-states');
    });

    it('should set disconnected on normal close (1000)', () => {
      websocketService.connect('test-close', 'ws://localhost/test');
      MockWebSocket.latest!.simulateOpen();

      const states: ConnectionState[] = [];
      websocketService.onStateChange('test-close', (s) => states.push(s));

      MockWebSocket.latest!.simulateClose(1000);
      expect(states).toContain('disconnected');

      websocketService.disconnect('test-close');
    });

    it('should set error on auth failure (1008)', () => {
      websocketService.connect('test-authfail', 'ws://localhost/test');
      MockWebSocket.latest!.simulateOpen();

      const states: ConnectionState[] = [];
      websocketService.onStateChange('test-authfail', (s) => states.push(s));

      MockWebSocket.latest!.simulateClose(1008);
      expect(states).toContain('error');

      websocketService.disconnect('test-authfail');
    });

    it('should not reconnect on auth failure codes (1002, 1008)', () => {
      websocketService.connect('test-noretry', 'ws://localhost/test');
      MockWebSocket.latest!.simulateOpen();
      const countBefore = MockWebSocket.instances.length;

      MockWebSocket.latest!.simulateClose(1002);
      vi.advanceTimersByTime(5000);

      // No new WebSocket instance should have been created
      expect(MockWebSocket.instances.length).toBe(countBefore);

      websocketService.disconnect('test-noretry');
    });
  });

  describe('reconnect', () => {
    it('should reconnect with exponential backoff on abnormal close', () => {
      websocketService.connect('test-reconnect', 'ws://localhost/test', {
        maxReconnectAttempts: 3,
        baseReconnectDelay: 1000,
      });
      MockWebSocket.latest!.simulateOpen();
      const initialCount = MockWebSocket.instances.length;

      // Abnormal close (code 1006)
      MockWebSocket.latest!.simulateClose(1006);
      expect(websocketService.getState('test-reconnect')).toBe('reconnecting');

      // First retry after ~1000ms (1000 * 1.5^0)
      vi.advanceTimersByTime(1000);
      expect(MockWebSocket.instances.length).toBe(initialCount + 1);

      // Second abnormal close
      MockWebSocket.latest!.simulateClose(1006);

      // Second retry after ~1500ms (1000 * 1.5^1)
      vi.advanceTimersByTime(1500);
      expect(MockWebSocket.instances.length).toBe(initialCount + 2);

      websocketService.disconnect('test-reconnect');
    });

    it('should stop reconnecting after max attempts and set error state', () => {
      websocketService.connect('test-maxretry', 'ws://localhost/test', {
        maxReconnectAttempts: 2,
        baseReconnectDelay: 100,
      });
      MockWebSocket.latest!.simulateOpen();

      // Close 1
      MockWebSocket.latest!.simulateClose(1006);
      vi.advanceTimersByTime(100);

      // Close 2 → should hit max
      MockWebSocket.latest!.simulateClose(1006);
      vi.advanceTimersByTime(200);

      expect(websocketService.getState('test-maxretry')).toBe('error');

      websocketService.disconnect('test-maxretry');
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('should send subscribe message when connected', () => {
      websocketService.connect('test-sub', 'ws://localhost/test');
      const ws = MockWebSocket.latest!;
      ws.simulateOpen();

      websocketService.subscribe('test-sub', 'run', ['run-1', 'run-2']);

      expect(ws.sent).toHaveLength(1);
      expect(JSON.parse(ws.sent[0])).toEqual({
        action: 'subscribe',
        resource: 'run',
        ids: ['run-1', 'run-2'],
      });

      websocketService.disconnect('test-sub');
    });

    it('should send unsubscribe message', () => {
      websocketService.connect('test-unsub', 'ws://localhost/test');
      const ws = MockWebSocket.latest!;
      ws.simulateOpen();

      websocketService.subscribe('test-unsub', 'run', ['run-1']);
      websocketService.unsubscribe('test-unsub', 'run', ['run-1']);

      expect(ws.sent).toHaveLength(2);
      expect(JSON.parse(ws.sent[1])).toEqual({
        action: 'unsubscribe',
        resource: 'run',
        ids: ['run-1'],
      });

      websocketService.disconnect('test-unsub');
    });

    it('should send subscribe message with pagination params', () => {
      websocketService.connect('test-sub-page', 'ws://localhost/test');
      const ws = MockWebSocket.latest!;
      ws.simulateOpen();

      websocketService.subscribe('test-sub-page', 'jobs', undefined, 1, 20);

      expect(ws.sent).toHaveLength(1);
      expect(JSON.parse(ws.sent[0])).toEqual({
        action: 'subscribe',
        resource: 'jobs',
        page: 1,
        limit: 20,
      });

      websocketService.disconnect('test-sub-page');
    });

    it('should update existing subscription when page changes', () => {
      websocketService.connect('test-sub-update', 'ws://localhost/test');
      const ws = MockWebSocket.latest!;
      ws.simulateOpen();

      websocketService.subscribe('test-sub-update', 'jobs', undefined, 1, 20);
      websocketService.subscribe('test-sub-update', 'jobs', undefined, 2, 20);

      expect(ws.sent).toHaveLength(2);
      expect(JSON.parse(ws.sent[1])).toEqual({
        action: 'subscribe',
        resource: 'jobs',
        page: 2,
        limit: 20,
      });

      websocketService.disconnect('test-sub-update');
    });

    it('should re-subscribe with pagination after reconnect', () => {
      websocketService.connect('test-resub-page', 'ws://localhost/test', {
        baseReconnectDelay: 100,
      });
      const ws1 = MockWebSocket.latest!;
      ws1.simulateOpen();

      websocketService.subscribe('test-resub-page', 'jobs', undefined, 3, 10);

      ws1.simulateClose(1006);
      vi.advanceTimersByTime(100);

      const ws2 = MockWebSocket.latest!;
      ws2.simulateOpen();

      expect(ws2.sent).toHaveLength(1);
      expect(JSON.parse(ws2.sent[0])).toEqual({
        action: 'subscribe',
        resource: 'jobs',
        page: 3,
        limit: 10,
      });

      websocketService.disconnect('test-resub-page');
    });

    it('should re-subscribe after reconnect', () => {
      websocketService.connect('test-resub', 'ws://localhost/test', {
        baseReconnectDelay: 100,
      });
      const ws1 = MockWebSocket.latest!;
      ws1.simulateOpen();

      websocketService.subscribe('test-resub', 'run', ['run-1']);
      expect(ws1.sent).toHaveLength(1);

      // Abnormal close → reconnect
      ws1.simulateClose(1006);
      vi.advanceTimersByTime(100);

      const ws2 = MockWebSocket.latest!;
      ws2.simulateOpen();

      // Should have re-sent the subscribe
      expect(ws2.sent).toHaveLength(1);
      expect(JSON.parse(ws2.sent[0])).toEqual({
        action: 'subscribe',
        resource: 'run',
        ids: ['run-1'],
      });

      websocketService.disconnect('test-resub');
    });
  });

  describe('message handlers', () => {
    it('should emit parsed ServerMessage to message handlers', () => {
      const handler = vi.fn();
      websocketService.connect('test-msg', 'ws://localhost/test');
      const ws = MockWebSocket.latest!;
      ws.simulateOpen();

      websocketService.onMessage('test-msg', handler);

      const serverMsg: ServerMessage = {
        resource: 'run',
        id: 'run-123',
        event: 'updated',
        data: { phase: 'Running' },
      };
      ws.simulateMessage(JSON.stringify(serverMsg));

      expect(handler).toHaveBeenCalledWith(serverMsg);

      websocketService.disconnect('test-msg');
    });

    it('should emit raw messages to raw handlers (stream mode)', () => {
      const rawHandler = vi.fn();
      websocketService.connect('test-raw', 'ws://localhost/test', { subscriptionMode: false });
      const ws = MockWebSocket.latest!;
      ws.simulateOpen();

      websocketService.onRawMessage('test-raw', rawHandler);

      ws.simulateMessage('plain log line');
      expect(rawHandler).toHaveBeenCalledWith('plain log line');

      websocketService.disconnect('test-raw');
    });

    it('should remove handlers with offMessage', () => {
      const handler = vi.fn();
      websocketService.connect('test-off', 'ws://localhost/test');
      const ws = MockWebSocket.latest!;
      ws.simulateOpen();

      websocketService.onMessage('test-off', handler);
      websocketService.offMessage('test-off', handler);

      ws.simulateMessage(JSON.stringify({ resource: 'run', id: '1', event: 'updated', data: {} }));
      expect(handler).not.toHaveBeenCalled();

      websocketService.disconnect('test-off');
    });
  });

  describe('disconnect', () => {
    it('should close WebSocket gracefully with code 1000', () => {
      websocketService.connect('test-dc', 'ws://localhost/test');
      const ws = MockWebSocket.latest!;
      ws.simulateOpen();

      websocketService.disconnect('test-dc');

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    });

    it('should clean up connection from internal map', () => {
      websocketService.connect('test-cleanup', 'ws://localhost/test');
      MockWebSocket.latest!.simulateOpen();

      websocketService.disconnect('test-cleanup');

      expect(websocketService.hasConnection('test-cleanup')).toBe(false);
      expect(websocketService.getState('test-cleanup')).toBe('disconnected');
    });
  });

  describe('URL builders', () => {
    it('should build resource URL with config base path', () => {
      // buildResourceUrl uses config.wsBaseUrl which is mocked to '/api/v2/ws'
      const url = websocketService.buildResourceUrl('runs');
      expect(url).toContain('/api/v2/ws/runs');
    });

    it('should build job logs URL with encoded params', () => {
      const url = websocketService.buildJobLogsUrl('my-run', 'job-123', true);
      expect(url).toContain('/api/v2/ws/scenarios/run/my-run/jobs/job-123/logs');
      expect(url).toContain('follow=true');
    });

    it('should build job logs URL without follow param when false', () => {
      const url = websocketService.buildJobLogsUrl('my-run', 'job-123', false);
      expect(url).not.toContain('follow');
    });
  });
});
