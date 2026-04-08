/**
 * useClusterDiscovery Hook
 *
 * Manages the async cluster discovery workflow for group management.
 *
 * **Workflow:**
 * 1. POST /api/v1/targets → get UUID
 * 2. Poll GET /api/v1/targets/{uuid} until status 200 (202 = pending)
 * 3. GET /api/v1/clusters?id={uuid} → get clusters from all operators
 * 4. Transform multi-operator response into TargetResponse[] format
 *
 * **Features:**
 * - Automatic polling with timeout/retry
 * - Loading state with spinner support
 * - Error handling with retry capability
 * - Cleanup on unmount
 * - Supports multiple operator sources (krkn-operator, krkn-operator-acm, etc.)
 *
 * @example
 * ```tsx
 * const { clusters, isLoading, error, startDiscovery, retry } = useClusterDiscovery();
 *
 * useEffect(() => {
 *   if (isOpen) {
 *     startDiscovery();
 *   }
 * }, [isOpen]);
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorWithRetry onRetry={retry} />;
 *
 * return <ClusterPermissionsTable targets={clusters || []} ... />;
 * ```
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { operatorApi } from '../services/operatorApi';
import { config } from '../config';
import type { TargetResponse, Cluster } from '../types/api';

interface UseClusterDiscoveryResult {
  /** Discovered clusters in TargetResponse[] format (compatible with ClusterPermissionsTable) */
  clusters: TargetResponse[] | null;

  /** UUID of the discovery request (for cleanup after group creation/update) */
  discoveryUuid: string | null;

  /** True during initial request and polling */
  isLoading: boolean;

  /** True during polling phase specifically */
  isPolling: boolean;

  /** Error message if discovery fails */
  error: string | null;

  /** Start the discovery workflow */
  startDiscovery: () => Promise<void>;

  /** Retry after error */
  retry: () => void;

  /** Reset all state */
  reset: () => void;
}

/**
 * Custom hook for cluster discovery workflow
 *
 * Encapsulates the complete async flow used in cluster selection,
 * adapted for group management modals.
 */
export function useClusterDiscovery(): UseClusterDiscoveryResult {
  const [clusters, setClusters] = useState<TargetResponse[] | null>(null);
  const [discoveryUuid, setDiscoveryUuid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<number | null>(null);
  const pollStartTimeRef = useRef<number | null>(null);

  /**
   * Transform ClustersResponse.targetData to TargetResponse[]
   *
   * Converts multi-operator format:
   * {
   *   "krkn-operator": [{cluster-name, cluster-api-url}],
   *   "krkn-operator-acm": [...]
   * }
   *
   * To flat array compatible with ClusterPermissionsTable:
   * [
   *   {uuid, clusterName, clusterAPIURL, ready: true},
   *   ...
   * ]
   */
  const transformClusters = useCallback(
    (targetData: { [operatorName: string]: Cluster[] }): TargetResponse[] => {
      const discovered: TargetResponse[] = [];

      for (const [operatorName, clusterList] of Object.entries(targetData)) {
        clusterList.forEach((cluster: Cluster) => {
          // Generate a unique UUID for each cluster
          // Format: operatorName-clusterName-timestamp
          const generatedUuid = `${operatorName}-${cluster['cluster-name']}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          discovered.push({
            uuid: generatedUuid,
            clusterName: cluster['cluster-name'],
            clusterAPIURL: cluster['cluster-api-url'],
            ready: true,
            operatorSource: operatorName, // Source operator for grouping
            // Optional fields
            secretType: 'kubeconfig',
            createdAt: new Date().toISOString(),
          });
        });
      }

      return discovered;
    },
    []
  );

  /**
   * Cleanup polling interval
   */
  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  /**
   * Poll GET /api/v1/targets/{uuid} until ready
   */
  const pollForClusters = useCallback(
    async (discoveryUuid: string) => {
      let attempt = 0;
      pollStartTimeRef.current = Date.now();

      const poll = async () => {
        attempt++;

        // Check timeout
        if (
          pollStartTimeRef.current &&
          Date.now() - pollStartTimeRef.current > config.pollTimeout
        ) {
          cleanup();
          setIsPolling(false);
          setIsLoading(false);
          setError('Discovery timeout - please try again');
          return;
        }

        try {
          const status = await operatorApi.getTargetStatus(discoveryUuid);

          if (status === 200) {
            // Ready - fetch clusters
            cleanup();

            try {
              const response = await operatorApi.getClusters(discoveryUuid);
              const transformed = transformClusters(response.targetData);

              if (config.debugMode) {
                console.log('[useClusterDiscovery] Discovered clusters:', transformed);
              }

              setClusters(transformed);
              setIsPolling(false);
              setIsLoading(false);
            } catch (err) {
              const errorMessage =
                err instanceof Error ? err.message : 'Failed to fetch clusters';
              setError(errorMessage);
              setIsPolling(false);
              setIsLoading(false);
            }
          } else if (status === 202) {
            // Still pending - continue polling
            if (config.debugMode) {
              console.log(
                `[useClusterDiscovery] Poll attempt ${attempt}: status 202 (pending)`
              );
            }
          } else if (status === 404) {
            cleanup();
            setError('Discovery request not found');
            setIsPolling(false);
            setIsLoading(false);
          } else {
            cleanup();
            setError(`Unexpected status: ${status}`);
            setIsPolling(false);
            setIsLoading(false);
          }
        } catch (err) {
          cleanup();
          const errorMessage =
            err instanceof Error ? err.message : 'Failed to poll discovery status';
          setError(errorMessage);
          setIsPolling(false);
          setIsLoading(false);
        }
      };

      // Start polling immediately
      await poll();
      pollIntervalRef.current = window.setInterval(poll, config.pollInterval);
    },
    [cleanup, transformClusters]
  );

  /**
   * Start cluster discovery workflow
   */
  const startDiscovery = useCallback(async () => {
    setIsLoading(true);
    setIsPolling(false);
    setError(null);
    setClusters(null);
    cleanup();

    try {
      // Step 1: POST /api/v1/targets to get UUID
      const response = await operatorApi.createTargetRequest();

      if (config.debugMode) {
        console.log('[useClusterDiscovery] Created target request:', response.uuid);
      }

      // Store UUID for later cleanup
      setDiscoveryUuid(response.uuid);
      setIsPolling(true);

      // Step 2: Poll until ready, then fetch clusters
      await pollForClusters(response.uuid);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start discovery';
      setError(errorMessage);
      setIsLoading(false);
    }
  }, [pollForClusters, cleanup]);

  /**
   * Retry discovery after error
   */
  const retry = useCallback(() => {
    startDiscovery();
  }, [startDiscovery]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    cleanup();
    setClusters(null);
    setDiscoveryUuid(null);
    setIsLoading(false);
    setIsPolling(false);
    setError(null);
  }, [cleanup]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    clusters,
    discoveryUuid,
    isLoading,
    isPolling,
    error,
    startDiscovery,
    retry,
    reset,
  };
}
