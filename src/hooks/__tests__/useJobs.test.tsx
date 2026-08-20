import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServerMessage } from '../../types/websocket';

let capturedHandler: ((msg: ServerMessage) => void) | null = null;
const mockConnectionState = { value: 'disconnected' as string };

vi.mock('../useWebSocket', () => ({
  useWebSocket: (_id: string, _url: string, handler: (msg: ServerMessage) => void) => {
    capturedHandler = handler;
    return { connectionState: mockConnectionState.value };
  },
}));

vi.mock('../../services/websocketService', () => ({
  websocketService: {
    buildResourceUrl: vi.fn(() => 'ws://localhost/api/v2/ws/runs'),
    subscribe: vi.fn(),
  },
}));

import { websocketService } from '../../services/websocketService';
import { useJobs } from '../useJobs';

function sendWsSnapshot(
  jobs: unknown[],
  pagination = { page: 1, limit: 20, total: jobs.length, totalPages: 1 },
  stats?: { totalJobs: number; succeededJobs: number; failedJobs: number },
) {
  act(() => {
    capturedHandler?.({
      resource: 'jobs',
      id: '',
      event: 'snapshot',
      data: { jobs },
      pagination,
      stats,
    });
  });
}

const scenarioJob = {
  type: 'scenarioRun', name: 'run-001', createdAt: '2026-08-01T10:00:00Z',
  scenarioRun: { scenarioRunName: 'run-001', scenarioName: 'cpu-hog', phase: 'Succeeded', totalTargets: 1, successfulJobs: 1, failedJobs: 0, runningJobs: 0, clusterJobs: [{ providerName: 'p1', clusterName: 'c1', jobId: 'j1', podName: 'pod1', phase: 'Succeeded' }] },
};

const graphJob = {
  type: 'graphRun', name: 'graph-001', createdAt: '2026-08-01T09:00:00Z',
  graphRun: { name: 'graph-001', phase: 'Completed', summary: { totalNodes: 2, completedNodes: 2, runningNodes: 0, failedNodes: 0, pendingNodes: 0 }, resiliencyScoreEnabled: true, resiliencyScoreBaseline: 80 },
};

describe('useJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandler = null;
    mockConnectionState.value = 'connected';
  });

  it('subscribes to WS with page and limit on connect', () => {
    renderHook(() => useJobs());

    expect(websocketService.subscribe).toHaveBeenCalledWith('jobs', 'jobs', undefined, 1, 20);
  });

  it('does not subscribe when disconnected', () => {
    mockConnectionState.value = 'disconnected';
    renderHook(() => useJobs());

    expect(websocketService.subscribe).not.toHaveBeenCalled();
  });

  it('starts with isLoading true', () => {
    const { result } = renderHook(() => useJobs());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.jobs).toHaveLength(0);
  });

  it('populates jobs from WS snapshot', () => {
    const { result } = renderHook(() => useJobs());

    sendWsSnapshot([scenarioJob, graphJob]);

    expect(result.current.isLoading).toBe(false);
    expect(result.current.jobs).toHaveLength(2);
    expect(result.current.jobs[0].name).toBe('run-001');
    expect(result.current.jobs[0].scenarioRun!.clusterJobs).toHaveLength(1);
    expect(result.current.jobs[1].name).toBe('graph-001');
    expect(result.current.pagination.total).toBe(2);
  });

  it('replaces jobs on subsequent WS snapshots', () => {
    const { result } = renderHook(() => useJobs());

    sendWsSnapshot([scenarioJob, graphJob]);
    expect(result.current.jobs).toHaveLength(2);

    sendWsSnapshot([scenarioJob]);
    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.pagination.total).toBe(1);
  });

  it('ignores messages for other resources', () => {
    const { result } = renderHook(() => useJobs());

    sendWsSnapshot([scenarioJob]);
    expect(result.current.jobs).toHaveLength(1);

    act(() => {
      capturedHandler?.({ resource: 'run', id: 'run-001', event: 'updated', data: {} });
    });

    expect(result.current.jobs).toHaveLength(1);
  });

  it('re-subscribes when page changes', () => {
    const { result } = renderHook(() => useJobs());

    sendWsSnapshot([scenarioJob]);
    vi.mocked(websocketService.subscribe).mockClear();

    act(() => { result.current.setPage(2); });

    expect(websocketService.subscribe).toHaveBeenCalledWith('jobs', 'jobs', undefined, 2, 20);
  });

  it('re-subscribes when limit changes', () => {
    const { result } = renderHook(() => useJobs());

    sendWsSnapshot([scenarioJob]);
    vi.mocked(websocketService.subscribe).mockClear();

    act(() => { result.current.setLimit(50); });

    expect(websocketService.subscribe).toHaveBeenCalledWith('jobs', 'jobs', undefined, 1, 50);
  });

  it('sets isLoading true on re-subscribe', () => {
    const { result } = renderHook(() => useJobs());

    sendWsSnapshot([scenarioJob]);
    expect(result.current.isLoading).toBe(false);

    act(() => { result.current.setPage(2); });
    expect(result.current.isLoading).toBe(true);
  });

  it('populates stats from WS snapshot', () => {
    const { result } = renderHook(() => useJobs());

    const stats = { totalJobs: 5, succeededJobs: 3, failedJobs: 1 };
    sendWsSnapshot([scenarioJob], undefined, stats);

    expect(result.current.stats).toEqual(stats);
    expect(result.current.hasReceivedStats).toBe(true);
  });

  it('starts with hasReceivedStats false', () => {
    const { result } = renderHook(() => useJobs());

    expect(result.current.hasReceivedStats).toBe(false);
    expect(result.current.stats).toEqual({ totalJobs: 0, succeededJobs: 0, failedJobs: 0 });
  });

  it('keeps previous stats when snapshot arrives without stats', () => {
    const { result } = renderHook(() => useJobs());

    const stats = { totalJobs: 10, succeededJobs: 8, failedJobs: 2 };
    sendWsSnapshot([scenarioJob, graphJob], undefined, stats);
    expect(result.current.stats).toEqual(stats);
    expect(result.current.hasReceivedStats).toBe(true);

    sendWsSnapshot([scenarioJob]);
    expect(result.current.stats).toEqual(stats);
    expect(result.current.hasReceivedStats).toBe(true);
  });
});
