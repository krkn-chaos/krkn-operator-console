import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServerMessage } from '../../types/websocket';
import type { UnifiedJobsResponse } from '../../types/api';

vi.mock('../../services/operatorApi');

let capturedHandler: ((msg: ServerMessage) => void) | null = null;
const mockConnectionState = { value: 'disconnected' as string };
const mockSubscribe = vi.fn();

vi.mock('../useWebSocket', () => ({
  useWebSocket: (_id: string, _url: string, handler: (msg: ServerMessage) => void) => {
    capturedHandler = handler;
    return { connectionState: mockConnectionState.value, subscribe: mockSubscribe, unsubscribe: vi.fn() };
  },
}));

vi.mock('../../services/websocketService', () => ({
  websocketService: {
    buildResourceUrl: vi.fn(() => 'ws://localhost/api/v2/ws/runs'),
    subscribe: vi.fn(),
  },
}));

import { operatorApi } from '../../services/operatorApi';
import { websocketService } from '../../services/websocketService';
import { useJobs } from '../useJobs';

const mockJobsResponse: UnifiedJobsResponse = {
  jobs: [
    { type: 'scenarioRun', name: 'run-001', createdAt: '2026-08-01T10:00:00Z' },
    { type: 'graphRun', name: 'graph-001', createdAt: '2026-08-01T09:00:00Z' },
  ],
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
};

function sendWsMessage(msg: ServerMessage) {
  act(() => { capturedHandler?.(msg); });
}

describe('useJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandler = null;
    mockConnectionState.value = 'connected';
    vi.mocked(operatorApi.listUnifiedJobs).mockResolvedValue(mockJobsResponse);
  });

  it('fetches initial jobs on connect', async () => {
    renderHook(() => useJobs());

    await waitFor(() => {
      expect(operatorApi.listUnifiedJobs).toHaveBeenCalledWith(1, 20);
    });
  });

  it('subscribes to WS with page and limit', async () => {
    renderHook(() => useJobs());

    await waitFor(() => {
      expect(websocketService.subscribe).toHaveBeenCalledWith('jobs', 'jobs', undefined, 1, 20);
    });
  });

  it('exposes jobs and pagination from REST response', async () => {
    const { result } = renderHook(() => useJobs());

    await waitFor(() => {
      expect(result.current.jobs).toHaveLength(2);
    });

    expect(result.current.jobs[0].name).toBe('run-001');
    expect(result.current.pagination.total).toBe(2);
    expect(result.current.pagination.totalPages).toBe(1);
  });

  it('updates jobs on WS snapshot event', async () => {
    const { result } = renderHook(() => useJobs());

    await waitFor(() => {
      expect(result.current.jobs).toHaveLength(2);
    });

    sendWsMessage({
      resource: 'jobs',
      id: '',
      event: 'snapshot',
      data: {
        jobs: [
          {
            type: 'scenarioRun', name: 'run-002', createdAt: '2026-08-02T10:00:00Z',
            scenarioRun: { scenarioRunName: 'run-002', phase: 'Running', totalTargets: 1, successfulJobs: 0, failedJobs: 0, runningJobs: 1, clusterJobs: [] },
          },
        ],
      },
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.jobs[0].name).toBe('run-002');
    expect(result.current.pagination.total).toBe(1);
  });

  it('falls back to REST fetch when snapshot has incomplete payloads', async () => {
    const { result } = renderHook(() => useJobs());

    await waitFor(() => {
      expect(result.current.jobs).toHaveLength(2);
    });

    vi.mocked(operatorApi.listUnifiedJobs).mockClear();

    sendWsMessage({
      resource: 'jobs',
      id: '',
      event: 'snapshot',
      data: {
        jobs: [
          { type: 'scenarioRun', name: 'run-incomplete', createdAt: '2026-08-02T10:00:00Z' },
        ],
      },
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    expect(result.current.pagination.total).toBe(1);

    await waitFor(() => {
      expect(operatorApi.listUnifiedJobs).toHaveBeenCalledWith(1, 20);
    });
  });

  it('re-fetches on WS created event', async () => {
    const { result } = renderHook(() => useJobs());

    await waitFor(() => {
      expect(result.current.jobs).toHaveLength(2);
    });

    vi.mocked(operatorApi.listUnifiedJobs).mockClear();

    sendWsMessage({
      resource: 'jobs',
      id: 'run-003',
      event: 'created',
      data: {},
    });

    await waitFor(() => {
      expect(operatorApi.listUnifiedJobs).toHaveBeenCalledWith(1, 20);
    });
  });

  it('re-fetches on WS deleted event', async () => {
    const { result } = renderHook(() => useJobs());

    await waitFor(() => {
      expect(result.current.jobs).toHaveLength(2);
    });

    vi.mocked(operatorApi.listUnifiedJobs).mockClear();

    sendWsMessage({
      resource: 'jobs',
      id: 'run-001',
      event: 'deleted',
      data: {},
    });

    await waitFor(() => {
      expect(operatorApi.listUnifiedJobs).toHaveBeenCalled();
    });
  });

  it('ignores messages for other resources', async () => {
    const { result } = renderHook(() => useJobs());

    await waitFor(() => {
      expect(result.current.jobs).toHaveLength(2);
    });

    vi.mocked(operatorApi.listUnifiedJobs).mockClear();

    sendWsMessage({
      resource: 'run',
      id: 'run-001',
      event: 'updated',
      data: {},
    });

    expect(operatorApi.listUnifiedJobs).not.toHaveBeenCalled();
  });

  it('re-subscribes when page changes', async () => {
    const { result } = renderHook(() => useJobs());

    await waitFor(() => {
      expect(result.current.jobs).toHaveLength(2);
    });

    vi.mocked(websocketService.subscribe).mockClear();
    vi.mocked(operatorApi.listUnifiedJobs).mockClear();

    act(() => { result.current.setPage(2); });

    await waitFor(() => {
      expect(websocketService.subscribe).toHaveBeenCalledWith('jobs', 'jobs', undefined, 2, 20);
      expect(operatorApi.listUnifiedJobs).toHaveBeenCalledWith(2, 20);
    });
  });

  it('re-subscribes when limit changes', async () => {
    const { result } = renderHook(() => useJobs());

    await waitFor(() => {
      expect(result.current.jobs).toHaveLength(2);
    });

    vi.mocked(websocketService.subscribe).mockClear();
    vi.mocked(operatorApi.listUnifiedJobs).mockClear();

    act(() => { result.current.setLimit(50); });

    await waitFor(() => {
      expect(websocketService.subscribe).toHaveBeenCalledWith('jobs', 'jobs', undefined, 1, 50);
      expect(operatorApi.listUnifiedJobs).toHaveBeenCalledWith(1, 50);
    });
  });

  it('does not fetch when disconnected', () => {
    mockConnectionState.value = 'disconnected';
    renderHook(() => useJobs());

    expect(operatorApi.listUnifiedJobs).not.toHaveBeenCalled();
  });

  it('sets isLoading during fetch', async () => {
    let resolvePromise: (v: UnifiedJobsResponse) => void;
    vi.mocked(operatorApi.listUnifiedJobs).mockImplementation(
      () => new Promise(r => { resolvePromise = r; })
    );

    const { result } = renderHook(() => useJobs());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    await act(async () => {
      resolvePromise!(mockJobsResponse);
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});
