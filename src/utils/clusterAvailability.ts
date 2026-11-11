import type { ClusterHealthStatus } from '../types/api';

/** Keep target-cluster eligibility consistent across visual and terminal pickers. */
export function isClusterUnavailable(
  online?: boolean,
  clusterStatus?: ClusterHealthStatus
): boolean {
  return online === false || clusterStatus === 'unhealthy';
}
