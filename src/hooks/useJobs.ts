import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { websocketService } from '../services/websocketService';
import type { ServerMessage, PaginationMeta } from '../types/websocket';
import type { UnifiedJobItem, JobStatsSummary } from '../types/api';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const EMPTY_PAGINATION: PaginationMeta = { page: 0, limit: 0, total: 0, totalPages: 0 };
const EMPTY_STATS: JobStatsSummary = { totalJobs: 0, succeededJobs: 0, failedJobs: 0 };

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
}

/**
 * Hook providing a unified paginated jobs list via WebSocket.
 *
 * Subscribes to WS resource 'jobs' with page/limit.
 * Backend sends a snapshot automatically on subscribe and on every change.
 * When page or limit changes, re-subscribes to get the new page.
 */
export function useJobs(): UseJobsReturn {
  const [jobs, setJobs] = useState<UnifiedJobItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(EMPTY_PAGINATION);
  const [stats, setStats] = useState<JobStatsSummary>(EMPTY_STATS);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [isLoading, setIsLoading] = useState(true);
  const [hasReceivedStats, setHasReceivedStats] = useState(false);

  const lastSubscribedRef = useRef<string | null>(null);

  const handleMessage = useCallback((message: ServerMessage) => {
    if (message.resource !== 'jobs') return;

    if (message.event === 'snapshot') {
      const data = message.data as { jobs?: UnifiedJobItem[] };
      if (data.jobs) {
        setJobs(data.jobs);
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

  useEffect(() => {
    if (connectionState !== 'connected') {
      lastSubscribedRef.current = null;
      return;
    }

    const key = `${page}:${limit}`;
    if (lastSubscribedRef.current === key) return;
    lastSubscribedRef.current = key;

    setIsLoading(true);
    websocketService.subscribe('jobs', 'jobs', undefined, page, limit);
  }, [connectionState, page, limit]);

  return { jobs, pagination, stats, hasReceivedStats, page, setPage, limit, setLimit, isLoading };
}
