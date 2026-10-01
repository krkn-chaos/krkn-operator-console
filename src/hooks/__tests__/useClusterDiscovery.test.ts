import { describe, expect, it } from 'vitest';
import { transformDiscoveredClusters } from '../useClusterDiscovery';

describe('transformDiscoveredClusters', () => {
	it('preserves operator source, ACM status, and liveness metadata', () => {
    const clusters = transformDiscoveredClusters({
      'krkn-operator': [
        {
          'cluster-name': 'online-cluster',
          'cluster-api-url': 'https://online.example',
          'cluster-status': 'healthy',
          online: true,
          'checked-at': '2026-09-28T10:00:00Z',
        },
        {
          'cluster-name': 'offline-cluster',
          'cluster-api-url': 'https://offline.example',
          online: false,
          'checked-at': '2026-09-28T10:01:00Z',
        },
      ],
    });

    expect(clusters).toHaveLength(2);
    expect(clusters[0]).toEqual(expect.objectContaining({
      clusterName: 'online-cluster',
      operatorSource: 'krkn-operator',
      clusterStatus: 'healthy',
      online: true,
      checkedAt: '2026-09-28T10:00:00Z',
    }));
    expect(clusters[1]).toEqual(expect.objectContaining({
      clusterName: 'offline-cluster',
      online: false,
      checkedAt: '2026-09-28T10:01:00Z',
    }));
  });
});
