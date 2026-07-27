import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReactNode } from 'react';
import { useActiveRunsPoller } from './useActiveRunsPoller';
import { operatorApi } from '../services/operatorApi';
import { AppProvider } from '../context/AppContext';
import type { ActiveRunsResponse } from '../types/api';
import type { ConnectionState, ServerMessage } from '../types/websocket';

vi.mock('../services/operatorApi');

const mockConnect = vi.fn((_id: string) => _id);
const mockDisconnect = vi.fn();
const mockSubscribe = vi.fn();
const mockOnMessage = vi.fn();
const mockOffMessage = vi.fn();
const mockOnStateChange = vi.fn();
const mockOffStateChange = vi.fn();
const mockGetState = vi.fn<() => ConnectionState>(() => 'disconnected');
const mockBuildResourceUrl = vi.fn(() => 'ws://localhost/api/v2/ws/dashboard/active-runs');

vi.mock('../services/websocketService', () => ({
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

function AppProviderWrapper({ children }: { children: ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

describe('useActiveRunsPoller', () => {
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

  it('should start in loading state', () => {
    vi.mocked(operatorApi.getActiveRuns).mockResolvedValue({
      totalActiveRuns: 0, totalClusters: 0, clusterRuns: {},
    });

    const { result } = renderHook(() => useActiveRunsPoller(), {
      wrapper: AppProviderWrapper,
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.activeRuns).toBe(null);
  });

  it('should fetch initial data when connected', async () => {
    const mockData: ActiveRunsResponse = {
      totalActiveRuns: 2,
      totalClusters: 3,
      clusterRuns: { 'cluster1': ['run1'] },
    };
    vi.mocked(operatorApi.getActiveRuns).mockResolvedValue(mockData);
    mockGetState.mockReturnValue('connected');

    const { result } = renderHook(() => useActiveRunsPoller(), {
      wrapper: AppProviderWrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeRuns).toEqual(mockData);
    expect(operatorApi.getActiveRuns).toHaveBeenCalledTimes(1);
  });

  it('should update data when receiving WebSocket message', async () => {
    vi.mocked(operatorApi.getActiveRuns).mockResolvedValue({
      totalActiveRuns: 0, totalClusters: 0, clusterRuns: {},
    });
    mockGetState.mockReturnValue('connected');

    const { result } = renderHook(() => useActiveRunsPoller(), {
      wrapper: AppProviderWrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const updatedData: ActiveRunsResponse = {
      totalActiveRuns: 3,
      totalClusters: 2,
      clusterRuns: { 'cluster1': ['run1', 'run2', 'run3'] },
    };

    act(() => {
      capturedMessageHandler?.({
        resource: 'dashboard',
        id: 'active-runs',
        event: 'updated',
        data: updatedData,
      });
    });

    expect(result.current.activeRuns).toEqual(updatedData);
  });

  it('should connect to WebSocket', () => {
    vi.mocked(operatorApi.getActiveRuns).mockResolvedValue({
      totalActiveRuns: 0, totalClusters: 0, clusterRuns: {},
    });

    renderHook(() => useActiveRunsPoller(), {
      wrapper: AppProviderWrapper,
    });

    expect(mockConnect).toHaveBeenCalledWith(
      'dashboard-active-runs',
      'ws://localhost/api/v2/ws/dashboard/active-runs',
      { subscriptionMode: true }
    );
  });

  it('should cleanup on unmount', () => {
    vi.mocked(operatorApi.getActiveRuns).mockResolvedValue({
      totalActiveRuns: 0, totalClusters: 0, clusterRuns: {},
    });

    const { unmount } = renderHook(() => useActiveRunsPoller(), {
      wrapper: AppProviderWrapper,
    });

    unmount();
    expect(mockDisconnect).toHaveBeenCalledWith('dashboard-active-runs');
  });
});
