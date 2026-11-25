import { beforeEach, describe, expect, it, vi } from 'vitest';
import { operatorApi } from '../operatorApi';

globalThis.fetch = vi.fn();

describe('getClusterResources', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requests provider-scoped resource items with encoded namespace', async () => {
    const payload = { items: [{ metadata: { name: 'web-0', namespace: 'team-a', labels: { app: 'web' } }, spec: { containers: [{ name: 'main' }] } }] };
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 200, json: async () => payload } as Response);

    const result = await operatorApi.getClusterResources({
      uuid: 'target-1', clusterName: 'shared', operatorName: 'operator-b', resource: 'pods', namespace: 'team-a',
    });

    const [url] = vi.mocked(fetch).mock.calls[0];
    const parsed = new URL(String(url), 'http://localhost');
    expect(parsed.pathname).toBe('/api/v1/cluster-resources');
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      id: 'target-1', 'cluster-name': 'shared', 'operator-name': 'operator-b', resource: 'pods', namespace: 'team-a',
    });
    expect(result).toEqual(payload);
  });

  it('requests all namespaces explicitly and exposes HTTP failure status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden', json: async () => ({ message: 'Denied' }) } as Response);

    await expect(operatorApi.getClusterResources({
      uuid: 'target-1', clusterName: 'shared', operatorName: 'operator-a', resource: 'pods', allNamespaces: true,
    })).rejects.toMatchObject({ status: 403, message: 'Denied' });
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(new URL(String(url), 'http://localhost').searchParams.get('all-namespaces')).toBe('true');
  });
});
