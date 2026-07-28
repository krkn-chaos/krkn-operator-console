import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useScenarioRunDetail } from '../useScenarioRunDetail';
import { operatorApi } from '../../services/operatorApi';
import type { ConnectionState, ServerMessage } from '../../types/websocket';
import type { ScenarioRunStatusResponse } from '../../types/api';

vi.mock('../../services/operatorApi');

const mockConnect = vi.fn((_id: string) => _id);
const mockDisconnect = vi.fn();
const mockSubscribe = vi.fn();
const mockOnMessage = vi.fn();
const mockOffMessage = vi.fn();
const mockOnStateChange = vi.fn();
const mockOffStateChange = vi.fn();
const mockGetState = vi.fn<() => ConnectionState>(() => 'disconnected');
const mockBuildResourceUrl = vi.fn(() => 'ws://localhost/api/v2/ws/runs');

vi.mock('../../services/websocketService', () => ({
  websocketService: {
    connect: (...args: Parameters<typeof mockConnect>) => mockConnect(...args),
    disconnect: (...args: Parameters<typeof mockDisconnect>) => mockDisconnect(...args),
    subscribe: (...args: Parameters<typeof mockSubscribe>) => mockSubscribe(...args),
    unsubscribe: vi.fn(),
    onMessage: (...args: Parameters<typeof mockOnMessage>) => mockOnMessage(...args),
    offMessage: (...args: Parameters<typeof mockOffMessage>) => mockOffMessage(...args),
    onRawMessage: vi.fn(),
    offRawMessage: vi.fn(),
    onStateChange: (...args: Parameters<typeof mockOnStateChange>) => mockOnStateChange(...args),
    offStateChange: (...args: Parameters<typeof mockOffStateChange>) => mockOffStateChange(...args),
    getState: (...args: Parameters<typeof mockGetState>) => mockGetState(...args),
    hasConnection: vi.fn(() => false),
    buildResourceUrl: (...args: Parameters<typeof mockBuildResourceUrl>) => mockBuildResourceUrl(...args),
  },
}));

const mockRunDetail: ScenarioRunStatusResponse = {
  scenarioRunName: 'test-run-abc123',
  phase: 'Running',
  totalTargets: 2,
  successfulJobs: 0,
  failedJobs: 0,
  runningJobs: 2,
  clusterJobs: [
    {
      providerName: 'krkn-operator',
      clusterName: 'cluster-1',
      jobId: 'job-1',
      podName: 'pod-1',
      phase: 'Running',
      startTime: '2026-07-28T10:00:00Z',
    },
  ],
};

describe('useScenarioRunDetail', () => {
  let capturedMessageHandler: ((msg: ServerMessage) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedMessageHandler = null;
    mockGetState.mockReturnValue('disconnected');
    mockOnStateChange.mockImplementation(() => {});
    mockOnMessage.mockImplementation((_id: string, handler: (msg: ServerMessage) => void) => {
      capturedMessageHandler = handler;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return null runDetail initially', () => {
    const { result } = renderHook(() => useScenarioRunDetail('test-run'));
    expect(result.current.runDetail).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should not connect when scenarioRunName is null', () => {
    renderHook(() => useScenarioRunDetail(null));
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('should connect when scenarioRunName is provided', () => {
    renderHook(() => useScenarioRunDetail('test-run'));
    expect(mockConnect).toHaveBeenCalledWith(
      'run-detail-test-run',
      'ws://localhost/api/v2/ws/runs',
      { subscriptionMode: true },
    );
  });

  it('should subscribe when connected', () => {
    mockGetState.mockReturnValue('connected');
    renderHook(() => useScenarioRunDetail('test-run'));

    expect(mockSubscribe).toHaveBeenCalledWith(
      'run-detail-test-run',
      'run-detail',
      ['test-run'],
    );
  });

  it('should update runDetail on WebSocket message', () => {
    mockGetState.mockReturnValue('connected');
    const { result } = renderHook(() => useScenarioRunDetail('test-run-abc123'));

    act(() => {
      capturedMessageHandler?.({
        resource: 'run-detail',
        id: 'test-run-abc123',
        event: 'updated',
        data: mockRunDetail,
      });
    });

    expect(result.current.runDetail).toEqual(mockRunDetail);
  });

  it('should clear runDetail on deleted event', () => {
    mockGetState.mockReturnValue('connected');
    const { result } = renderHook(() => useScenarioRunDetail('test-run-abc123'));

    act(() => {
      capturedMessageHandler?.({
        resource: 'run-detail',
        id: 'test-run-abc123',
        event: 'updated',
        data: mockRunDetail,
      });
    });
    expect(result.current.runDetail).toEqual(mockRunDetail);

    act(() => {
      capturedMessageHandler?.({
        resource: 'run-detail',
        id: 'test-run-abc123',
        event: 'deleted',
        data: {},
      });
    });
    expect(result.current.runDetail).toBeNull();
  });

  it('should clear runDetail when scenarioRunName changes to null', () => {
    mockGetState.mockReturnValue('connected');
    const { result, rerender } = renderHook(
      ({ name }: { name: string | null }) => useScenarioRunDetail(name),
      { initialProps: { name: 'test-run-abc123' as string | null } },
    );

    act(() => {
      capturedMessageHandler?.({
        resource: 'run-detail',
        id: 'test-run-abc123',
        event: 'updated',
        data: mockRunDetail,
      });
    });
    expect(result.current.runDetail).toEqual(mockRunDetail);

    rerender({ name: null });
    expect(result.current.runDetail).toBeNull();
  });

  it('should ignore messages for other resources', () => {
    mockGetState.mockReturnValue('connected');
    const { result } = renderHook(() => useScenarioRunDetail('test-run'));

    act(() => {
      capturedMessageHandler?.({
        resource: 'run',
        id: 'test-run',
        event: 'updated',
        data: mockRunDetail,
      });
    });

    expect(result.current.runDetail).toBeNull();
  });

  it('should refetch via REST', async () => {
    vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValue(mockRunDetail);
    const { result } = renderHook(() => useScenarioRunDetail('test-run-abc123'));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.runDetail).toEqual(mockRunDetail);
    expect(operatorApi.getScenarioRunStatus).toHaveBeenCalledWith('test-run-abc123');
  });

  it('should disconnect on unmount', () => {
    const { unmount } = renderHook(() => useScenarioRunDetail('test-run'));
    unmount();
    expect(mockDisconnect).toHaveBeenCalledWith('run-detail-test-run');
  });
});
