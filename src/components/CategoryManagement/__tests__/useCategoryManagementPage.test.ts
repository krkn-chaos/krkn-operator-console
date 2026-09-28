import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { operatorApi } from '../../../services/operatorApi';
import { useCategoryManagementPage } from '../useCategoryManagementPage';

vi.mock('../../../services/operatorApi', () => ({
  operatorApi: {
    getCategories: vi.fn(),
    deleteCategory: vi.fn(),
  },
}));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ state: { user: { userId: 'owner@example.com' } } }),
}));
vi.mock('../../../hooks/useRole', () => ({ useRole: () => ({ isAdmin: true }) }));

describe('useCategoryManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(operatorApi.getCategories).mockResolvedValue({ categories: [], total: 0 });
    vi.mocked(operatorApi.deleteCategory).mockResolvedValue({ message: 'deleted' });
  });

  it('deletes a category and refreshes the list', async () => {
    const { result } = renderHook(() => useCategoryManagementPage());

    await act(async () => {
      await result.current.handleDeleteCategory('resilience');
    });

    expect(operatorApi.deleteCategory).toHaveBeenCalledWith('resilience');
    expect(operatorApi.getCategories).toHaveBeenCalledTimes(2);
  });
});
