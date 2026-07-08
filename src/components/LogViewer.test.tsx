import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogViewer } from './LogViewer';
import { authService } from '../services/authService';

vi.mock('../services/authService', () => ({
  authService: { getToken: vi.fn(() => 'test-token') },
}));

// Controllable WebSocket stub — jsdom has no WebSocket that connects to a server.
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((e: { code: number; reason?: string }) => void) | null = null;

  constructor(public url: string, public protocol?: string) {
    MockWebSocket.instances.push(this);
    this.readyState = MockWebSocket.OPEN;
    queueMicrotask(() => this.onopen?.());
  }

  send() {}
  close(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }
  emit(data: string) {
    this.onmessage?.({ data });
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
  vi.clearAllMocks();
  (authService.getToken as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
});

describe('LogViewer terminal phase handling', () => {
  // A run that fails and exhausts retries ends in job phase "MaxRetriesExceeded"
  // (not "Failed"), so the log viewer must treat it as a completed/terminal job:
  // fetch static logs once with follow=false and NOT open a follow stream.
  it('fetches static logs (follow=false) for a MaxRetriesExceeded job', async () => {
    render(
      <LogViewer
        scenarioRunName="run-1"
        jobId="job-1"
        clusterName="cluster-a"
        podName="pod-xyz"
        status="MaxRetriesExceeded"
      />
    );

    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
    expect(MockWebSocket.instances[0].url).toContain('follow=false');
  });

  it('fetches static logs (follow=false) for a Cancelled job', async () => {
    render(
      <LogViewer
        scenarioRunName="run-2"
        jobId="job-2"
        clusterName="cluster-a"
        podName="pod-abc"
        status="Cancelled"
      />
    );

    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
    expect(MockWebSocket.instances[0].url).toContain('follow=false');
  });
});
