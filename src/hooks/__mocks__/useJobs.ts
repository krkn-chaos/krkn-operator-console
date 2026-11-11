import { vi } from 'vitest';
import type { UnifiedJobItem, PaginationMeta, JobStatsSummary } from '../../types/api';

const state = {
  jobs: [] as UnifiedJobItem[],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } as PaginationMeta,
  stats: { totalJobs: 0, succeededJobs: 0, failedJobs: 0 } as JobStatsSummary,
  hasReceivedStats: true,
  isLoading: false,
  snapshotVersion: 0,
  refresh: vi.fn(),
  setPage: vi.fn(),
  setLimit: vi.fn(),
};

export function useJobs() {
  return {
    jobs: state.jobs,
    pagination: state.pagination,
    stats: state.stats,
    hasReceivedStats: state.hasReceivedStats,
    page: state.pagination.page,
    setPage: state.setPage,
    limit: state.pagination.limit,
    setLimit: state.setLimit,
    isLoading: state.isLoading,
    snapshotVersion: state.snapshotVersion,
    refresh: state.refresh,
  };
}

export function setMockJobs(items: UnifiedJobItem[]) {
  state.jobs = items;
  state.pagination = { page: 1, limit: 20, total: items.length, totalPages: 1 };
}

export function setMockPagination(pagination: PaginationMeta) {
  state.pagination = pagination;
}

export function setMockIsLoading(loading: boolean) {
  state.isLoading = loading;
}

export function setMockStats(stats: JobStatsSummary) {
  state.stats = stats;
}

export function resetJobsMock() {
  state.jobs = [];
  state.pagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
  state.stats = { totalJobs: 0, succeededJobs: 0, failedJobs: 0 };
  state.hasReceivedStats = true;
  state.isLoading = false;
  state.snapshotVersion = 0;
  state.refresh.mockClear();
  state.setPage.mockClear();
  state.setLimit.mockClear();
}

export function setMockSnapshotVersion(snapshotVersion: number) {
  state.snapshotVersion = snapshotVersion;
}

export { state as _mockState };
