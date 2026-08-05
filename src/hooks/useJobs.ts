import { useState, useEffect, useRef, useCallback } from 'react';
import { operatorApi } from '../services/operatorApi';
import { useWebSocket } from './useWebSocket';
import { websocketService } from '../services/websocketService';
import type { ServerMessage, PaginationMeta } from '../types/websocket';
import type { UnifiedJobItem, UnifiedJobsResponse } from '../types/api';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const EMPTY_PAGINATION: PaginationMeta = { page: 0, limit: 0, total: 0, totalPages: 0 };

interface UseJobsReturn {
  jobs: UnifiedJobItem[];
  pagination: PaginationMeta;
  page: number;
  setPage: (page: number) => void;
  limit: number;
  setLimit: (limit: number) => void;
  isLoading: boolean;
}

/**
 * Hook providing a unified paginated jobs list via REST + WebSocket.
 *
 * On mount: fetches the initial page via REST.
 * Subscribes to WS resource 'jobs' with page/limit for real-time snapshots.
 * When page or limit changes, re-subscribes and re-fetches.
 */
export function useJobs(): UseJobsReturn {
  const [jobs, setJobs] = useState<UnifiedJobItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(EMPTY_PAGINATION);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [isLoading, setIsLoading] = useState(false);

  const initialFetchDoneRef = useRef(false);
  const pageRef = useRef(page);
  const limitRef = useRef(limit);
  pageRef.current = page;
  limitRef.current = limit;

  const fetchJobs = useCallback(async (p: number, l: number) => {
    setIsLoading(true);
    try {
      const data: UnifiedJobsResponse = await operatorApi.listUnifiedJobs(p, l);
      setJobs(data.jobs);
      setPagination(data.pagination);
    } catch {
      // Keep existing state on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleMessage = useCallback((message: ServerMessage) => {
    if (message.resource !== 'jobs') return;

    if (message.event === 'snapshot') {
      const data = message.data as { jobs?: UnifiedJobItem[] };
      if (data.jobs) {
        setJobs(data.jobs);
      }
      if (message.pagination) {
        setPagination(message.pagination);
      }
    } else if (message.event === 'created' || message.event === 'updated') {
      // Individual item update — re-fetch current page for consistency
      fetchJobs(pageRef.current, limitRef.current);
    } else if (message.event === 'deleted') {
      fetchJobs(pageRef.current, limitRef.current);
    }
  }, [fetchJobs]);

  const wsUrl = websocketService.buildResourceUrl('runs');
  const { connectionState } = useWebSocket('jobs', wsUrl, handleMessage);

  // Initial fetch + subscribe on connect
  useEffect(() => {
    if (connectionState !== 'connected') {
      initialFetchDoneRef.current = false;
      return;
    }
    if (initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;

    fetchJobs(page, limit);
    websocketService.subscribe('jobs', 'jobs', undefined, page, limit);
  }, [connectionState, page, limit, fetchJobs]);

  // Re-subscribe + re-fetch when page or limit changes
  useEffect(() => {
    if (connectionState !== 'connected') return;
    if (!initialFetchDoneRef.current) return;

    fetchJobs(page, limit);
    websocketService.subscribe('jobs', 'jobs', undefined, page, limit);
  }, [page, limit, connectionState, fetchJobs]);

  return { jobs, pagination, page, setPage, limit, setLimit, isLoading };
}
