import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServerMessage } from '../../types/websocket';
import type { GraphRunState, GraphRunListItem } from '../../types/api';

const mockDispatch = vi.fn();
let mockGraphRuns: GraphRunState[] = [];

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    state: { graphRuns: mockGraphRuns },
    dispatch: mockDispatch,
  }),
}));

let capturedHandler: ((msg: ServerMessage) => void) | null = null;
const mockConnectionState = { value: 'disconnected' as string };

vi.mock('../useWebSocket', () => ({
  useWebSocket: (_id: string, _url: string, handler: (msg: ServerMessage) => void) => {
    capturedHandler = handler;
    return { connectionState: mockConnectionState.value };
  },
}));

vi.mock('../../services', () => ({
  graphRunsApi: { listGraphRuns: vi.fn() },
}));

vi.mock('../../services/websocketService', () => ({
  websocketService: {
    buildResourceUrl: vi.fn((resource: string) => `ws://localhost/api/v2/ws/${resource}`),
    subscribe: vi.fn(),
  },
}));

vi.mock('../../utils/resiliency', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/resiliency')>();
  return { ...actual };
});

import { graphRunsApi } from '../../services';
import { websocketService } from '../../services/websocketService';
import { useGraphRunsPoller } from '../useGraphRunsPoller';

function makeGraphRunListItem(overrides: Partial<GraphRunListItem> = {}): GraphRunListItem {
  return {
    name: 'graphrun-001',
    namespace: 'krkn-operator-system',
    creationTimestamp: '2025-06-15T10:00:00Z',
    phase: 'Running',
    ownerUserId: 'user@example.com',
    targetRequestId: 'tr-001',
    summary: { totalNodes: 3, completedNodes: 1, runningNodes: 1, failedNodes: 0, pendingNodes: 1 },
    ...overrides,
  };
}

function makeGraphRunState(overrides: Partial<GraphRunState> = {}): GraphRunState {
  return {
    name: 'graphrun-001',
    namespace: 'krkn-operator-system',
    creationTimestamp: '2025-06-15T10:00:00Z',
    phase: 'Running',
    ownerUserId: 'user@example.com',
    targetRequestId: 'tr-001',
    summary: { totalNodes: 3, completedNodes: 1, runningNodes: 1, failedNodes: 0, pendingNodes: 1 },
    ...overrides,
  };
}

async function sendWsMessage(msg: ServerMessage) {
  const { act } = await import('@testing-library/react');
  act(() => { capturedHandler?.(msg); });
}

describe('useGraphRunsPoller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandler = null;
    mockGraphRuns = [];
    mockConnectionState.value = 'disconnected';
  });

  it('connects to the graph runs WebSocket endpoint', () => {
    renderHook(() => useGraphRunsPoller());

    expect(websocketService.buildResourceUrl).toHaveBeenCalledWith('graphruns');
    expect(vi.mocked(websocketService.buildResourceUrl).mock.results[0]?.value).toBe('ws://localhost/api/v2/ws/graphruns');
  });

  describe('REST aggregation', () => {
    it('aggregates resiliencyScore from resiliencyScores on REST fetch', async () => {
      const runFromApi = makeGraphRunListItem({
        resiliencyScores: [
          { clusterName: 'cluster-a', calculated: 85, baseline: 80, status: 'pass' },
          { clusterName: 'cluster-b', calculated: 75, baseline: 80, status: 'pass' },
        ],
        resiliencyScoreBaseline: 80,
        resiliencyScore: undefined,
      });

      vi.mocked(graphRunsApi.listGraphRuns).mockResolvedValue([runFromApi]);
      mockConnectionState.value = 'connected';

      renderHook(() => useGraphRunsPoller());

      await vi.waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'LOAD_GRAPH_RUNS_SUCCESS',
            payload: {
              runs: expect.arrayContaining([
                expect.objectContaining({
                  name: 'graphrun-001',
                  resiliencyScore: {
                    calculated: 80,
                    baseline: 80,
                    status: 'pass',
                    message: 'cluster-a: 85, cluster-b: 75',
                  },
                }),
              ]),
            },
          }),
        );
      });
    });

    it('uses existing resiliencyScore when no resiliencyScores on REST fetch', async () => {
      const existingScore = { calculated: 90, baseline: 80, status: 'pass' as const, message: 'ok' };
      const runFromApi = makeGraphRunListItem({
        resiliencyScores: undefined,
        resiliencyScore: existingScore,
      });

      vi.mocked(graphRunsApi.listGraphRuns).mockResolvedValue([runFromApi]);
      mockConnectionState.value = 'connected';

      renderHook(() => useGraphRunsPoller());

      await vi.waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'LOAD_GRAPH_RUNS_SUCCESS',
            payload: {
              runs: expect.arrayContaining([
                expect.objectContaining({
                  name: 'graphrun-001',
                  resiliencyScore: existingScore,
                }),
              ]),
            },
          }),
        );
      });
    });
  });

  describe('WS handler', () => {
    beforeEach(() => {
      mockConnectionState.value = 'connected';
      vi.mocked(graphRunsApi.listGraphRuns).mockResolvedValue([]);
    });

    it('computes resiliencyScore from scores on WS update when data.resiliencyScore is absent', async () => {
      mockGraphRuns = [makeGraphRunState({ name: 'graphrun-001' })];
      renderHook(() => useGraphRunsPoller());

      await sendWsMessage({
        resource: 'graphrun',
        id: 'graphrun-001',
        event: 'updated',
        data: {
          phase: 'Completed',
          resiliencyScores: [
            { clusterName: 'cluster-a', calculated: 90, baseline: 80, status: 'pass' },
            { clusterName: 'cluster-b', calculated: 70, baseline: 80, status: 'pass' },
          ],
          resiliencyScoreBaseline: 80,
        },
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UPDATE_GRAPH_RUN',
          payload: expect.objectContaining({
            run: expect.objectContaining({
              resiliencyScore: {
                calculated: 80,
                baseline: 80,
                status: 'pass',
                message: 'cluster-a: 90, cluster-b: 70',
              },
            }),
          }),
        }),
      );
    });

    it('prefers data.resiliencyScore over aggregation on WS update', async () => {
      mockGraphRuns = [makeGraphRunState({ name: 'graphrun-001' })];
      renderHook(() => useGraphRunsPoller());

      const explicitScore = { calculated: 99, baseline: 80, status: 'pass' as const, message: 'explicit' };

      await sendWsMessage({
        resource: 'graphrun',
        id: 'graphrun-001',
        event: 'updated',
        data: {
          phase: 'Completed',
          resiliencyScore: explicitScore,
          resiliencyScores: [
            { clusterName: 'cluster-a', calculated: 50, baseline: 80, status: 'fail' },
          ],
          resiliencyScoreBaseline: 80,
        },
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UPDATE_GRAPH_RUN',
          payload: expect.objectContaining({
            run: expect.objectContaining({
              resiliencyScore: explicitScore,
            }),
          }),
        }),
      );
    });

    it('falls back to existing resiliencyScore when WS has neither scores nor resiliencyScore', async () => {
      const existingScore = { calculated: 85, baseline: 80, status: 'pass' as const, message: 'existing' };
      mockGraphRuns = [makeGraphRunState({ name: 'graphrun-001', resiliencyScore: existingScore })];
      renderHook(() => useGraphRunsPoller());

      await sendWsMessage({
        resource: 'graphrun',
        id: 'graphrun-001',
        event: 'updated',
        data: {
          phase: 'Completed',
        },
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UPDATE_GRAPH_RUN',
          payload: expect.objectContaining({
            run: expect.objectContaining({
              resiliencyScore: existingScore,
            }),
          }),
        }),
      );
    });

    it('provides default summary when WS created event has no summary and no existing run', async () => {
      mockGraphRuns = [];
      renderHook(() => useGraphRunsPoller());

      await sendWsMessage({
        resource: 'graphrun',
        id: 'graphrun-new',
        event: 'created',
        data: {
          phase: 'Pending',
          namespace: 'krkn-operator-system',
          ownerUserId: 'user@example.com',
          targetRequestId: 'tr-002',
        },
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ADD_GRAPH_RUN',
          payload: expect.objectContaining({
            run: expect.objectContaining({
              name: 'graphrun-new',
              summary: { totalNodes: 0, completedNodes: 0, runningNodes: 0, failedNodes: 0, pendingNodes: 0 },
            }),
          }),
        }),
      );
    });

    it('dispatches DELETE_GRAPH_RUN on deleted event', async () => {
      mockGraphRuns = [makeGraphRunState({ name: 'graphrun-001' })];
      renderHook(() => useGraphRunsPoller());

      await sendWsMessage({
        resource: 'graphrun',
        id: 'graphrun-001',
        event: 'deleted',
        data: {},
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DELETE_GRAPH_RUN',
          payload: { graphRunName: 'graphrun-001' },
        }),
      );
    });
  });
});
