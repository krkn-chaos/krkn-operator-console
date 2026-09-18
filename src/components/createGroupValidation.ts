import type { ClusterPermissions, TargetResponse } from '../types/api';

export function normalizeClusterPermissions(permissions: ClusterPermissions): ClusterPermissions {
  return Object.fromEntries(
    Object.entries(permissions).filter(([, permission]) => (permission.actions || []).length > 0)
  );
}

export function checkRunOrCancelWithoutView(clusterPermissions: ClusterPermissions): {
  hasIssue: boolean;
  missingPermissions: string[];
} {
  const issues: string[] = [];

  const hasRunWithoutView = Object.values(clusterPermissions).some(
    (perms) => (perms.actions || []).includes('run') && !(perms.actions || []).includes('view')
  );

  const hasCancelWithoutView = Object.values(clusterPermissions).some(
    (perms) => (perms.actions || []).includes('cancel') && !(perms.actions || []).includes('view')
  );

  if (hasRunWithoutView) {
    issues.push('Run');
  }

  if (hasCancelWithoutView) {
    issues.push('Cancel');
  }

  return {
    hasIssue: issues.length > 0,
    missingPermissions: issues,
  };
}

export function checkDuplicateClusters(
  clusterPermissions: ClusterPermissions,
  targets: TargetResponse[]
): { hasDuplicates: boolean; duplicates: string[] } {
  const duplicates: string[] = [];
  const selectedUrls = Object.keys(clusterPermissions).filter(
    (url) => (clusterPermissions[url].actions || []).length > 0
  );

  selectedUrls.forEach((url) => {
    const clustersWithUrl = targets.filter((target) => target.clusterAPIURL === url);

    if (clustersWithUrl.length > 1) {
      const clusterNames = clustersWithUrl
        .map((cluster) => `${cluster.clusterName} (${cluster.operatorSource || 'unknown'})`)
        .join(', ');

      duplicates.push(`${url}: ${clusterNames}`);
    }
  });

  return {
    hasDuplicates: duplicates.length > 0,
    duplicates,
  };
}
