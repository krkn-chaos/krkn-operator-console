import { vi } from 'vitest';
import type { UnifiedJobItem, PaginationMeta, JobStatsSummary } from '../../types/api';
import type { JobsSortField, JobsSortOrder } from '../../types/websocket';

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

export function useJobs(
  _categoryFilters: string[] = [],
  sortBy: JobsSortField = 'createdAt',
  sortOrder: JobsSortOrder = 'desc',
) {
  const jobs = [...state.jobs].sort((left, right) => {
    let leftValue: string | number = '';
    let rightValue: string | number = '';
    switch (sortBy) {
      case 'createdAt':
        leftValue = new Date(left.createdAt).getTime() || 0;
        rightValue = new Date(right.createdAt).getTime() || 0;
        break;
      case 'status':
        leftValue = left.type === 'graphRun'
          ? left.graphRun?.phase === 'Completed' ? 'Succeeded' : left.graphRun?.phase || 'Pending'
          : left.scenarioRun?.phase || 'Pending';
        rightValue = right.type === 'graphRun'
          ? right.graphRun?.phase === 'Completed' ? 'Succeeded' : right.graphRun?.phase || 'Pending'
          : right.scenarioRun?.phase || 'Pending';
        break;
      case 'name':
        leftValue = left.type === 'graphRun'
          ? left.name
          : left.scenarioRun?.customRunName?.trim() || left.scenarioRun?.scenarioRunName || left.name;
        rightValue = right.type === 'graphRun'
          ? right.name
          : right.scenarioRun?.customRunName?.trim() || right.scenarioRun?.scenarioRunName || right.name;
        break;
      case 'owner':
        leftValue = (left.type === 'graphRun' ? left.graphRun?.ownerUserId : left.scenarioRun?.ownerUserId) || '';
        rightValue = (right.type === 'graphRun' ? right.graphRun?.ownerUserId : right.scenarioRun?.ownerUserId) || '';
        break;
    }
    const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' });
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return {
    jobs,
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
