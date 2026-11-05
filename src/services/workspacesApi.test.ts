import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { workspacesApi } from './workspacesApi';
import { authService } from './authService';

vi.mock('./authService', () => ({ authService: { getToken: vi.fn() } }));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(authService.getToken).mockReturnValue('token');
});
afterEach(() => vi.unstubAllGlobals());

describe('workspacesApi', () => {
  it('reads the available catalog without exposing a PVC name', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ workspaces: [{ name: 'shared', available: true }] }) });
    expect(await workspacesApi.listAvailable()).toEqual([{ name: 'shared', available: true }]);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/workspaces/available');
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer token');
  });

  it('loads only eligible PVCs from the admin endpoint', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ pvcs: [{ name: 'shared-pvc' }] }) });
    expect(await workspacesApi.listEligiblePVCs()).toEqual([{ name: 'shared-pvc' }]);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/workspaces/pvcs/available');
  });

  it('publishes a PVC with an encoded workspace name and reports backend errors', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'team.data', available: false }) });
    await workspacesApi.save('team.data', { claimName: 'shared-pvc', availableToAll: true });
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/workspaces/team.data');
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body as string)).toEqual({ claimName: 'shared-pvc', availableToAll: true });

    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, statusText: 'Conflict', json: async () => ({ message: 'PVC is not RWX' }) });
    await expect(workspacesApi.save('team.data', { claimName: 'shared-pvc' })).rejects.toThrow('PVC is not RWX');
  });
});
