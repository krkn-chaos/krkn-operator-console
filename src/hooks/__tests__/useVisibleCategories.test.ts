import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { operatorApi } from '../../services/operatorApi';
import { useVisibleCategories } from '../useVisibleCategories';

vi.mock('../../services/operatorApi');

describe('useVisibleCategories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads only categories returned by the visible-category endpoint', async () => {
    vi.mocked(operatorApi.getCategories).mockResolvedValue({
      categories: [{ name: 'network', color: '#d40078', availableToAll: true }],
      total: 1,
    });
    const { result } = renderHook(() => useVisibleCategories());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.categories.map((category) => category.name)).toEqual(['network']);
  });

  it('clears results on failure and allows a successful retry', async () => {
    vi.mocked(operatorApi.getCategories)
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({
        categories: [{ name: 'network', availableToAll: true }],
        total: 1,
      });
    const { result } = renderHook(() => useVisibleCategories());

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.categories).toEqual([]);

    await act(async () => result.current.reload());
    expect(result.current.status).toBe('ready');
    expect(result.current.categories.map((category) => category.name)).toEqual(['network']);
  });
});
