import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReactNode } from 'react';
import { useActiveRunsPoller } from './useActiveRunsPoller';
import { operatorApi } from '../services/operatorApi';
import { AppProvider } from '../context/AppContext';
import type { ActiveRunsResponse } from '../types/api';

vi.mock('../services/operatorApi');

// Wrapper component to provide AppContext
function AppProviderWrapper({ children }: { children: ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

describe('useActiveRunsPoller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should fetch active runs on mount', async () => {
    const mockData: ActiveRunsResponse = {
      totalActiveRuns: 2,
      totalClusters: 2,
      clusterRuns: {
        'cluster1': ['run1'],
        'cluster2': ['run2'],
      },
    };

    vi.mocked(operatorApi.getActiveRuns).mockResolvedValue(mockData);

    const { result } = renderHook(() => useActiveRunsPoller(), {
      wrapper: AppProviderWrapper,
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.activeRuns).toBe(null);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });

    expect(result.current.activeRuns).toEqual(mockData);
    expect(result.current.error).toBe(null);
    expect(operatorApi.getActiveRuns).toHaveBeenCalled();
  });

  it('should handle API errors', async () => {
    const errorMessage = 'Failed to fetch active runs';
    vi.mocked(operatorApi.getActiveRuns).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useActiveRunsPoller(), {
      wrapper: AppProviderWrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.activeRuns).toBe(null);
  });

  it('should cleanup on unmount', async () => {
    vi.useFakeTimers();

    const mockData: ActiveRunsResponse = {
      totalActiveRuns: 0,
      totalClusters: 0,
      clusterRuns: {},
    };

    vi.mocked(operatorApi.getActiveRuns).mockResolvedValue(mockData);

    const { unmount } = renderHook(() => useActiveRunsPoller(), {
      wrapper: AppProviderWrapper,
    });

    // Wait for initial call
    await vi.waitFor(() => {
      expect(operatorApi.getActiveRuns).toHaveBeenCalledTimes(1);
    });

    const callCountBeforeUnmount = vi.mocked(operatorApi.getActiveRuns).mock.calls.length;

    unmount();

    // Advance timers after unmount
    await vi.advanceTimersByTimeAsync(5000);

    // Should not have called again after unmount
    expect(operatorApi.getActiveRuns).toHaveBeenCalledTimes(callCountBeforeUnmount);
  });
});
