import { useCallback, useEffect, useState } from 'react';
import { operatorApi } from '../services/operatorApi';
import type { CategoryResponse } from '../types/api';

export type CategoryLoadStatus = 'loading' | 'ready' | 'error';

/** Load only the categories the current user is allowed to see. */
export function useVisibleCategories() {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [status, setStatus] = useState<CategoryLoadStatus>('loading');

  const reload = useCallback(async () => {
    setStatus('loading');
    setCategories([]);
    try {
      const response = await operatorApi.getCategories();
      setCategories(response.categories ?? []);
      setStatus('ready');
    } catch {
      // Do not leave a partial list visible if a refresh fails.
      setCategories([]);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { categories, status, reload };
}
