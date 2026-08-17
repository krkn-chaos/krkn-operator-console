import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePagination } from '../usePagination';

describe('usePagination', () => {
  const mockData = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

  describe('initial state', () => {
    it('should initialize with default perPage of 10', () => {
      const { result } = renderHook(() => usePagination(mockData));

      expect(result.current.page).toBe(1);
      expect(result.current.perPage).toBe(10);
      expect(result.current.totalItems).toBe(25);
      expect(result.current.totalPages).toBe(3);
      expect(result.current.paginatedData).toHaveLength(10);
      expect(result.current.paginatedData[0]).toEqual({ id: 1, name: 'Item 1' });
      expect(result.current.paginatedData[9]).toEqual({ id: 10, name: 'Item 10' });
    });

    it('should initialize with custom initialPerPage', () => {
      const { result } = renderHook(() => usePagination(mockData, { initialPerPage: 20 }));

      expect(result.current.perPage).toBe(20);
      expect(result.current.totalPages).toBe(2);
      expect(result.current.paginatedData).toHaveLength(20);
    });
  });

  describe('page navigation', () => {
    it('should navigate to page 2 using handleSetPage', () => {
      const { result } = renderHook(() => usePagination(mockData));

      act(() => {
        result.current.handleSetPage(null, 2);
      });

      expect(result.current.page).toBe(2);
      expect(result.current.paginatedData).toHaveLength(10);
      expect(result.current.paginatedData[0]).toEqual({ id: 11, name: 'Item 11' });
      expect(result.current.paginatedData[9]).toEqual({ id: 20, name: 'Item 20' });
    });

    it('should navigate to page 3 using handleSetPage', () => {
      const { result } = renderHook(() => usePagination(mockData));

      act(() => {
        result.current.handleSetPage(null, 3);
      });

      expect(result.current.page).toBe(3);
      expect(result.current.paginatedData).toHaveLength(5); // Last page has 5 items
      expect(result.current.paginatedData[0]).toEqual({ id: 21, name: 'Item 21' });
      expect(result.current.paginatedData[4]).toEqual({ id: 25, name: 'Item 25' });
    });

    it('should navigate using setPage directly', () => {
      const { result } = renderHook(() => usePagination(mockData));

      act(() => {
        result.current.setPage(2);
      });

      expect(result.current.page).toBe(2);
      expect(result.current.paginatedData[0]).toEqual({ id: 11, name: 'Item 11' });
    });
  });

  describe('perPage selection', () => {
    it('should change perPage and reset to page 1 using handlePerPageSelect', () => {
      const { result } = renderHook(() => usePagination(mockData));

      // First navigate to page 2
      act(() => {
        result.current.handleSetPage(null, 2);
      });
      expect(result.current.page).toBe(2);

      // Change perPage - should reset to page 1
      act(() => {
        result.current.handlePerPageSelect(null, 20);
      });

      expect(result.current.perPage).toBe(20);
      expect(result.current.page).toBe(1); // Reset to page 1
      expect(result.current.totalPages).toBe(2);
      expect(result.current.paginatedData).toHaveLength(20);
      expect(result.current.paginatedData[0]).toEqual({ id: 1, name: 'Item 1' });
    });

    it('should update pagination metadata when perPage changes', () => {
      const { result } = renderHook(() => usePagination(mockData));

      act(() => {
        result.current.handlePerPageSelect(null, 50);
      });

      expect(result.current.perPage).toBe(50);
      expect(result.current.totalPages).toBe(1);
      expect(result.current.paginatedData).toHaveLength(25); // All items on one page
    });
  });

  describe('data changes (filtering/sorting)', () => {
    it('should reset to page 1 when data changes', () => {
      const { result, rerender } = renderHook(
        ({ data }) => usePagination(data),
        { initialProps: { data: mockData } }
      );

      // Navigate to page 2
      act(() => {
        result.current.handleSetPage(null, 2);
      });
      expect(result.current.page).toBe(2);
      expect(result.current.paginatedData[0]).toEqual({ id: 11, name: 'Item 11' });

      // Simulate filtering - data changes to fewer items
      const filteredData = mockData.slice(0, 5);
      rerender({ data: filteredData });

      // Should reset to page 1
      expect(result.current.page).toBe(1);
      expect(result.current.totalItems).toBe(5);
      expect(result.current.totalPages).toBe(1);
      expect(result.current.paginatedData).toHaveLength(5);
      expect(result.current.paginatedData[0]).toEqual({ id: 1, name: 'Item 1' });
    });

    it('should reset to page 1 even when on last page', () => {
      const { result, rerender } = renderHook(
        ({ data }) => usePagination(data),
        { initialProps: { data: mockData } }
      );

      // Navigate to page 3 (last page)
      act(() => {
        result.current.handleSetPage(null, 3);
      });
      expect(result.current.page).toBe(3);
      expect(result.current.paginatedData).toHaveLength(5);

      // Data changes (e.g., search filter applied)
      const newData = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Filtered ${i + 1}` }));
      rerender({ data: newData });

      // Should reset to page 1
      expect(result.current.page).toBe(1);
      expect(result.current.paginatedData[0]).toEqual({ id: 1, name: 'Filtered 1' });
    });

    it('should handle data becoming empty', () => {
      const { result, rerender } = renderHook(
        ({ data }) => usePagination(data),
        { initialProps: { data: mockData } }
      );

      // Navigate to page 2
      act(() => {
        result.current.handleSetPage(null, 2);
      });

      // Data becomes empty (e.g., no search results)
      rerender({ data: [] });

      expect(result.current.page).toBe(1);
      expect(result.current.totalItems).toBe(0);
      expect(result.current.totalPages).toBe(0);
      expect(result.current.paginatedData).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty data array', () => {
      const { result } = renderHook(() => usePagination([]));

      expect(result.current.page).toBe(1);
      expect(result.current.perPage).toBe(10);
      expect(result.current.totalItems).toBe(0);
      expect(result.current.totalPages).toBe(0);
      expect(result.current.paginatedData).toHaveLength(0);
    });

    it('should handle data with fewer items than perPage', () => {
      const smallData = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const { result } = renderHook(() => usePagination(smallData));

      expect(result.current.totalPages).toBe(1);
      expect(result.current.paginatedData).toHaveLength(3);
    });

    it('should handle exact multiple of perPage', () => {
      const exactData = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
      const { result } = renderHook(() => usePagination(exactData));

      expect(result.current.totalPages).toBe(2);
      expect(result.current.paginatedData).toHaveLength(10);

      act(() => {
        result.current.handleSetPage(null, 2);
      });

      expect(result.current.paginatedData).toHaveLength(10);
    });
  });

  describe('combined scenarios', () => {
    it('should handle navigation, filter change, then navigation again', () => {
      const { result, rerender } = renderHook(
        ({ data }) => usePagination(data),
        { initialProps: { data: mockData } }
      );

      // Navigate to page 2
      act(() => {
        result.current.handleSetPage(null, 2);
      });
      expect(result.current.page).toBe(2);

      // Filter data (simulating search)
      const filtered = mockData.filter(item => item.id <= 15);
      rerender({ data: filtered });
      expect(result.current.page).toBe(1); // Reset

      // Navigate to page 2 again with filtered data
      act(() => {
        result.current.handleSetPage(null, 2);
      });
      expect(result.current.page).toBe(2);
      expect(result.current.paginatedData[0]).toEqual({ id: 11, name: 'Item 11' });
    });

    it('should handle perPage change from non-first page', () => {
      const { result } = renderHook(() => usePagination(mockData));

      // Navigate to page 3
      act(() => {
        result.current.handleSetPage(null, 3);
      });
      expect(result.current.page).toBe(3);
      expect(result.current.paginatedData).toHaveLength(5);

      // Change perPage to 50
      act(() => {
        result.current.handlePerPageSelect(null, 50);
      });

      // Should be on page 1 with all items
      expect(result.current.page).toBe(1);
      expect(result.current.totalPages).toBe(1);
      expect(result.current.paginatedData).toHaveLength(25);
    });
  });
});
