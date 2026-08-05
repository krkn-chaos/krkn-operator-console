import { vi } from 'vitest';
import type { UnifiedJobItem, PaginationMeta } from '../../types/api';

const state = {
  jobs: [] as UnifiedJobItem[],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } as PaginationMeta,
  isLoading: false,
  setPage: vi.fn(),
  setLimit: vi.fn(),
};

export function useJobs() {
  return {
    jobs: state.jobs,
    pagination: state.pagination,
    page: state.pagination.page,
    setPage: state.setPage,
    limit: state.pagination.limit,
    setLimit: state.setLimit,
    isLoading: state.isLoading,
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

export function resetJobsMock() {
  state.jobs = [];
  state.pagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
  state.isLoading = false;
  state.setPage.mockClear();
  state.setLimit.mockClear();
}

export { state as _mockState };
