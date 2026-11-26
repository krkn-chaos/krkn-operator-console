import type { ClusterHealthStatus } from '../types/api';

/**
 * Shared cluster-availability rules.
 *
 * The console has two views of the same cluster:
 *
 * 1. **Registration** — `GET /operator/targets` reports `ready`, which only means
 *    the target and its kubeconfig Secret were created. It involves no network
 *    call to the cluster.
 * 2. **Live availability** — the discovery flow (`POST /targets` -> poll ->
 *    `GET /clusters`) dials each cluster's API server (`online`) and, for ACM
 *    targets, reports the ACM sanity check (`cluster-status`).
 *
 * Running scenarios requires (2), so every place that tells the user whether a
 * cluster is usable MUST use the helpers in this module rather than the
 * registration flag. Keeping the rules here prevents the settings page and the
 * cluster picker from drifting apart again.
 */

/** Keep target-cluster eligibility consistent across visual and terminal pickers. */
export function isClusterUnavailable(
  online?: boolean,
  clusterStatus?: ClusterHealthStatus
): boolean {
  return online === false || clusterStatus === 'unhealthy';
}

/** A discovered cluster in the shape produced by `transformDiscoveredClusters`. */
export interface DiscoveredClusterInfo {
  clusterName: string;
  clusterAPIURL?: string;
  clusterStatus?: ClusterHealthStatus;
  online?: boolean;
  checkedAt?: string;
}

/**
 * Normalize an API URL so discovery records can be matched to configured
 * targets. The backend treats API URLs as unique per target, so they are a
 * safer identity than cluster names (which may repeat across providers).
 */
export function normalizeClusterApiUrl(url?: string): string {
  return (url ?? '').trim().replace(/\/+$/, '').toLowerCase();
}

/**
 * Find the discovery record that corresponds to a configured target.
 *
 * API URL is the target's identity: the backend rejects duplicate URLs, and a
 * configured target always has one. When it is present the match MUST be exact
 * (after normalization); falling back to the cluster name there would let a
 * same-named cluster owned by another provider — an ACM cluster whose name
 * matches but whose endpoint differs — lend its health to this target while
 * the target's own operator omits it from discovery.
 *
 * The cluster name is only used when the target has no API URL at all, and
 * only when exactly one discovered record carries that name.
 *
 * Several operators can report the same API URL with different liveness (a
 * direct target and an ACM-managed record for the same endpoint, for example).
 * The cluster picker offers the cluster as long as any of those records is
 * selectable, so a selectable record is preferred; otherwise the first record
 * is returned so callers can report why it is unavailable.
 *
 * Returns `undefined` when discovery has no record for the target, which means
 * the cluster was not offered by any operator and therefore cannot be selected
 * in the cluster picker.
 */
export function findDiscoveredCluster<T extends DiscoveredClusterInfo>(
  target: { clusterName: string; clusterAPIURL?: string },
  discovered: readonly T[] | null | undefined
): T | undefined {
  if (!discovered || discovered.length === 0) return undefined;

  const targetUrl = normalizeClusterApiUrl(target.clusterAPIURL);
  if (targetUrl) {
    const byUrl = discovered.filter(
      (cluster) => normalizeClusterApiUrl(cluster.clusterAPIURL) === targetUrl
    );
    if (byUrl.length === 0) return undefined;

    return (
      byUrl.find(
        (cluster) => !isClusterUnavailable(cluster.online, cluster.clusterStatus)
      ) ?? byUrl[0]
    );
  }

  const byName = discovered.filter((cluster) => cluster.clusterName === target.clusterName);
  return byName.length === 1 ? byName[0] : undefined;
}

/** Render a discovery check timestamp, tolerating missing or malformed values. */
export function formatClusterCheckedAt(checkedAt?: string): string {
  if (!checkedAt) return 'unknown';

  const date = new Date(checkedAt);
  if (Number.isNaN(date.getTime())) return checkedAt;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
