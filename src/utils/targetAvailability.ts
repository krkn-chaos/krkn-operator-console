import type { TargetResponse } from '../types/api';
import {
  findDiscoveredCluster,
  formatClusterCheckedAt,
  isClusterUnavailable,
} from './clusterAvailability';

/**
 * Live availability of a configured target, as reported by the discovery flow.
 *
 * - `checking`       — discovery is still running (or has not started yet)
 * - `available`      — discovery reached the cluster and nothing flags it unhealthy
 * - `unavailable`    — discovery reached the target but it is offline/unhealthy,
 *                      so the cluster picker will not let users run on it
 * - `not-discovered` — discovery returned no record for this target, so it
 *                      cannot be selected either
 * - `unknown`        — discovery itself failed; availability is undetermined
 */
export type TargetAvailabilityState =
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'not-discovered'
  | 'unknown';

export interface TargetAvailability {
  state: TargetAvailabilityState;
  /** Explanation shown in the status tooltip. */
  detail: string;
  /** Discovery record backing the state, when one exists. */
  cluster?: TargetResponse;
}

/** Explain why a discovered record cannot be selected in the cluster picker. */
function unavailableDetail(cluster: TargetResponse): string {
  const reasons: string[] = [];

  if (cluster.online === false) {
    const checkedAt = cluster.checkedAt
      ? ` at the last check (${formatClusterCheckedAt(cluster.checkedAt)})`
      : ' at the last check';
    reasons.push(`its API server was unreachable${checkedAt}`);
  }
  if (cluster.clusterStatus === 'unhealthy') {
    reasons.push('ACM reports it as unhealthy');
  }

  return `Scenarios cannot run on this cluster because ${reasons.join(' and ')}.`;
}

/** Explain why discovery produced no usable record for a configured target. */
function notDiscoveredDetail(ready: boolean): string {
  return ready
    ? 'Cluster discovery did not report this target, so scenarios cannot run on it. Make sure its operator is running and advertises this cluster.'
    : 'This target is not registered as ready, so cluster discovery excludes it.';
}

function describeDiscoveredCluster(cluster: TargetResponse): TargetAvailability {
  if (isClusterUnavailable(cluster.online, cluster.clusterStatus)) {
    return { state: 'unavailable', cluster, detail: unavailableDetail(cluster) };
  }

  return {
    state: 'available',
    cluster,
    detail: 'Cluster discovery reached this cluster, so scenarios can run on it.',
  };
}

/**
 * Resolve what the cluster picker would do with a configured target.
 *
 * Settings must never fall back to `target.ready`: that flag only records that
 * the target was created, while the picker disables clusters that discovery
 * could not reach. Reporting the registration flag as the cluster status is
 * what issue #182 described as misleading.
 *
 * @param target - A configured target from `GET /operator/targets`. Only its
 *   identity (`clusterName`, `clusterAPIURL`) and registration flag are read.
 * @param discovered - Clusters returned by the discovery flow, or `null` when
 *   discovery has not produced a result yet (not started, still polling, or
 *   failed). An empty array means discovery completed and reported no clusters;
 *   the two are different, which is why they are not normalized to one value.
 * @param discoveryError - Discovery failure message, or `null` when discovery
 *   did not fail. When set it wins over every other input, because no
 *   availability claim is trustworthy.
 * @param isChecking - `true` while discovery is running, so a previous result
 *   is not presented as fresh.
 *
 * @example
 * ```ts
 * const availability = describeTargetAvailability(
 *   { clusterName: 'ibm', clusterAPIURL: 'https://api.ibm:6443', ready: true },
 *   discoveredClusters, // TargetResponse[] | null from useClusterDiscovery
 *   discoveryError,     // string | null
 *   isChecking,         // boolean
 * );
 *
 * switch (availability.state) {
 *   case 'checking': break;        // discovery has no result yet
 *   case 'available': break;       // the picker allows this cluster
 *   case 'unavailable': break;     // offline or unhealthy; show availability.detail
 *   case 'not-discovered': break;  // discovery never reported it
 *   case 'unknown': break;         // discovery failed
 * }
 * ```
 */
export function describeTargetAvailability(
  target: Pick<TargetResponse, 'clusterName' | 'clusterAPIURL' | 'ready'>,
  discovered: TargetResponse[] | null,
  discoveryError: string | null,
  isChecking: boolean
): TargetAvailability {
  if (discoveryError) {
    return {
      state: 'unknown',
      detail: `Live cluster status could not be checked: ${discoveryError}`,
    };
  }

  if (isChecking || discovered === null) {
    return {
      state: 'checking',
      detail: 'Checking whether this cluster can run scenarios…',
    };
  }

  const cluster = findDiscoveredCluster(target, discovered);
  if (!cluster) {
    return {
      state: 'not-discovered',
      detail: notDiscoveredDetail(target.ready),
    };
  }

  return describeDiscoveredCluster(cluster);
}
