import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useWebSocket } from './useWebSocket';
import { websocketService } from '../services/websocketService';
import type { JobsSortField, JobsSortOrder, JobsSubscriptionFilters, PaginationMeta, ServerMessage } from '../types/websocket';
import type { UnifiedJobItem, JobStatsSummary } from '../types/api';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const EMPTY_PAGINATION: PaginationMeta = { page: 0, limit: 0, total: 0, totalPages: 0 };
const EMPTY_STATS: JobStatsSummary = { totalJobs: 0, succeededJobs: 0, failedJobs: 0 };
const EMPTY_CATEGORIES: string[] = [];
const EMPTY_FILTERS: JobsSubscriptionFilters = {};

interface UseJobsReturn {
  jobs: UnifiedJobItem[];
  pagination: PaginationMeta;
  stats: JobStatsSummary;
  hasReceivedStats: boolean;
  page: number;
  setPage: (page: number) => void;
  limit: number;
  setLimit: (limit: number) => void;
  isLoading: boolean;
  snapshotVersion: number;
  refresh: () => void;
}

/**
 * Hook providing a unified paginated jobs list via WebSocket.
 *
 * Subscribes to WS resource 'jobs' with page, limit, filters, and sort.
 * Backend sends a snapshot automatically on subscribe and on every change.
 * Page, limit, filters, or sort changes create a fresh subscription.
 */
export function useJobs(
  categoryFilters: string[] = EMPTY_CATEGORIES,
  sortBy: JobsSortField = 'createdAt',
  sortOrder: JobsSortOrder = 'desc',
  jobFilters: JobsSubscriptionFilters = EMPTY_FILTERS,
): UseJobsReturn {
  const [jobs, setJobs] = useState<UnifiedJobItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(EMPTY_PAGINATION);
  const [stats, setStats] = useState<JobStatsSummary>(EMPTY_STATS);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [isLoading, setIsLoading] = useState(true);
  const [hasReceivedStats, setHasReceivedStats] = useState(false);
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const lastSubscribedRef = useRef<string | null>(null);
  const subscriptionSequenceRef = useRef(0);
  const activeSubscriptionIdRef = useRef<string | null>(null);
  const desiredSubscriptionKeyRef = useRef('');
  const categories = useMemo(() => [...new Set(categoryFilters)].sort(), [categoryFilters]);
  const categoriesKey = categories.join('\u0000');
  const filters = useMemo(() => {
    const activeFilters = {
      owner: jobFilters.owner || undefined,
      createdAtFrom: jobFilters.createdAtFrom || undefined,
      createdAtTo: jobFilters.createdAtTo || undefined,
      runName: jobFilters.runName || undefined,
    };
    return Object.values(activeFilters).some(Boolean) ? activeFilters : undefined;
  }, [jobFilters.owner, jobFilters.createdAtFrom, jobFilters.createdAtTo, jobFilters.runName]);
  const filtersKey = JSON.stringify(filters ?? {});
  const subscriptionKey = `${page}:${limit}:${categoriesKey}:${sortBy}:${sortOrder}:${filtersKey}`;
  if (desiredSubscriptionKeyRef.current !== subscriptionKey) {
    desiredSubscriptionKeyRef.current = subscriptionKey;
    activeSubscriptionIdRef.current = null;
  }

  const handleMessage = useCallback((message: ServerMessage) => {
    if (message.resource !== 'jobs') return;
    if (message.subscriptionId && message.subscriptionId !== activeSubscriptionIdRef.current) return;

    if (message.event === 'snapshot') {
      const data = message.data as { jobs?: UnifiedJobItem[] };
      if (data.jobs) {
        setJobs(data.jobs);
        setSnapshotVersion((version) => version + 1);
        setIsLoading(false);
        if (message.pagination) {
          setPagination(message.pagination);
        }
        if (message.stats) {
          setStats(message.stats);
          setHasReceivedStats(true);
        }
      }
    }
  }, []);

  const wsUrl = websocketService.buildResourceUrl('runs');
  const { connectionState } = useWebSocket('jobs', wsUrl, handleMessage);
  const refresh = useCallback(() => {
    activeSubscriptionIdRef.current = null;
    lastSubscribedRef.current = null;
    setRefreshVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (connectionState !== 'connected') {
      lastSubscribedRef.current = null;
      activeSubscriptionIdRef.current = null;
      return;
    }

    const key = subscriptionKey;
    if (lastSubscribedRef.current === key && activeSubscriptionIdRef.current) return;
    lastSubscribedRef.current = key;
    const subscriptionId = `jobs-${++subscriptionSequenceRef.current}`;
    activeSubscriptionIdRef.current = subscriptionId;

    setIsLoading(true);
    websocketService.subscribe('jobs', 'jobs', undefined, page, limit, categories, subscriptionId, true, sortBy, sortOrder, filters);
  }, [connectionState, page, limit, categories, subscriptionKey, refreshVersion, sortBy, sortOrder, filters]);

  return {
    jobs,
    pagination,
    stats,
    hasReceivedStats,
    page,
    setPage,
    limit,
    setLimit,
    isLoading,
    snapshotVersion,
    refresh,
  };
}
