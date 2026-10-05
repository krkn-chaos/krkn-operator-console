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
 * Flatten the operator response while preserving liveness metadata.
 * Kept separate from the hook so the API contract is directly testable.
 */
export function transformDiscoveredClusters(
  targetData: { [operatorName: string]: Cluster[] }
): TargetResponse[] {
  const discovered: TargetResponse[] = [];

  for (const [operatorName, clusterList] of Object.entries(targetData)) {
    clusterList.forEach((cluster) => {
      const generatedUuid = `${operatorName}-${cluster['cluster-name']}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      discovered.push({
        uuid: generatedUuid,
        clusterName: cluster['cluster-name'],
        clusterAPIURL: cluster['cluster-api-url'],
        ready: true,
        operatorSource: operatorName,
        clusterStatus: cluster['cluster-status'],
        online: cluster.online,
        checkedAt: cluster['checked-at'],
        secretType: 'kubeconfig',
        createdAt: new Date().toISOString(),
      });
    });
  }

  return discovered;
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
  const requestControllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);

  /**
   * Cleanup polling interval
   */
  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);
  const cancelActiveDiscovery = useCallback(() => {
    generationRef.current++;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    cleanup();
  }, [cleanup]);

  /**
   * Poll GET /api/v1/targets/{uuid} until ready
   */
  const pollForClusters = useCallback(
    async (discoveryUuid: string, generation: number, controller: AbortController) => {
      let attempt = 0;
      pollStartTimeRef.current = Date.now();

      const isCurrent = () =>
        generationRef.current === generation && !controller.signal.aborted;
      const finish = () => {
        cleanup();
        if (requestControllerRef.current === controller) {
          requestControllerRef.current = null;
        }
        controller.abort();
        setIsPolling(false);
        setIsLoading(false);
      };

      const poll = async (): Promise<boolean> => {
        if (!isCurrent()) return false;
        attempt++;

        // Check timeout
        if (
          pollStartTimeRef.current &&
          Date.now() - pollStartTimeRef.current > config.pollTimeout
        ) {
          setError('Discovery timeout - please try again');
          finish();
          return false; // Terminal state - stop polling
        }

        try {
          const status = await operatorApi.getTargetStatus(discoveryUuid, {
            signal: controller.signal,
          });
          if (!isCurrent()) return false;

          if (status === 200) {
            // Ready - fetch clusters
            cleanup();

            try {
              const response = await operatorApi.getClusters(discoveryUuid, {
                signal: controller.signal,
              });
              if (!isCurrent()) return false;
              const transformed = transformDiscoveredClusters(response.targetData);

              if (config.debugMode) {
                console.log('[useClusterDiscovery] Discovered clusters:', transformed);
              }

              setClusters(transformed);
              finish();
            } catch (err) {
              if (!isCurrent()) return false;
              const errorMessage =
                err instanceof Error ? err.message : 'Failed to fetch clusters';
              setError(errorMessage);
              finish();
            }
            return false; // Terminal state - stop polling
          } else if (status === 202) {
            // Still pending - continue polling
            if (config.debugMode) {
              console.log(
                `[useClusterDiscovery] Poll attempt ${attempt}: status 202 (pending)`
              );
            }
            return true; // Continue polling
          } else if (status === 404) {
            setError('Discovery request not found');
            finish();
            return false; // Terminal state - stop polling
          } else {
            setError(`Unexpected status: ${status}`);
            finish();
            return false; // Terminal state - stop polling
          }
        } catch (err) {
          if (!isCurrent()) return false;
          const errorMessage =
            err instanceof Error ? err.message : 'Failed to poll discovery status';
          setError(errorMessage);
          finish();
          return false; // Terminal state - stop polling
        }
      };

      // Start polling immediately
      const shouldContinue = await poll();

      // Only schedule interval if first poll returned 202 (pending).
      if (shouldContinue && isCurrent()) {
        pollIntervalRef.current = window.setInterval(poll, config.pollInterval);
      }
    },
    [cleanup]
  );

  /**
   * Start cluster discovery workflow
   */
  const startDiscovery = useCallback(async () => {
    cleanup();
    requestControllerRef.current?.abort();
    const generation = ++generationRef.current;
    const controller = new AbortController();
    requestControllerRef.current = controller;

    setIsLoading(true);
    setIsPolling(false);
    setError(null);
    setClusters(null);
    setDiscoveryUuid(null);

    try {
      // Step 1: POST /api/v1/targets to get UUID
      const response = await operatorApi.createTargetRequest({
        signal: controller.signal,
      });
      if (generationRef.current !== generation || controller.signal.aborted) return;
      if (!response.uuid) throw new Error('Target request did not return a UUID.');

      if (config.debugMode) {
        console.log('[useClusterDiscovery] Created target request:', response.uuid);
      }

      setDiscoveryUuid(response.uuid);
      setIsPolling(true);

      // Step 2: Poll until ready, then fetch clusters
      await pollForClusters(response.uuid, generation, controller);
    } catch (err) {
      if (generationRef.current !== generation || controller.signal.aborted) return;
      cleanup();
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to start discovery';
      setError(errorMessage);
      setIsLoading(false);
    }
  }, [cleanup, pollForClusters]);

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
    cancelActiveDiscovery();
    setClusters(null);
    setDiscoveryUuid(null);
    setIsLoading(false);
    setIsPolling(false);
    setError(null);
  }, [cancelActiveDiscovery]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => cancelActiveDiscovery, [cancelActiveDiscovery]);

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
