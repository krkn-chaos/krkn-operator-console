import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { identityApi } from '../identityApi';
import { authService } from '../authService';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('identityApi', () => {
  beforeEach(() => { authService.logout(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('discovers login choices and treats an older operator 404 as no providers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(jsonResponse({ providers: [{ id: 'corp', displayName: 'Corporate' }] }));

    expect(await identityApi.loginProviders()).toEqual([]);
    expect(await identityApi.loginProviders()).toEqual([{ id: 'corp', displayName: 'Corporate' }]);
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/auth/providers', { credentials: 'include' });
  });

  it('encodes provider group pages and account pages without using flattened lengths', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ groups: [{ id: 'nested' }], nextFirst: 51, hasMore: true }))
      .mockResolvedValueOnce(jsonResponse({ users: [{ userId: 'later' }], total: 64, page: 6, limit: 10 }));

    expect((await identityApi.groups('corp/keycloak', 'Ops & Dev', 50, 50)).nextFirst).toBe(51);
    expect(await identityApi.users('corp/keycloak', 6, 10)).toMatchObject({ total: 64, users: [{ userId: 'later' }] });
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/v1/identity-providers/corp%2Fkeycloak/groups?search=Ops+%26+Dev&first=50&max=50');
    expect(fetchSpy.mock.calls[1][0]).toBe('/api/v1/users?authProvider=corp%2Fkeycloak&page=6&limit=10');
  });

  it('sends provider edits, user actions and blacklist deletion with the expected methods', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse({}));
    await identityApi.providers();
    await identityApi.updateProvider('corp/keycloak', { adminClientId: '', adminClientSecret: '' });
    await identityApi.setUserActive('oidc/user', false);
    await identityApi.deleteUser('oidc/user', false);
    await identityApi.deleteUser('oidc/user', true);
    await identityApi.blocks('corp/keycloak');
    await identityApi.unblock('block/id');

    expect(fetchSpy.mock.calls.map(([url, options]) => [url, options?.method ?? 'GET'])).toEqual([
      ['/api/v1/identity-providers', 'GET'],
      ['/api/v1/identity-providers/corp%2Fkeycloak', 'PATCH'],
      ['/api/v1/users/oidc%2Fuser', 'PATCH'],
      ['/api/v1/users/oidc%2Fuser', 'DELETE'],
      ['/api/v1/users/oidc%2Fuser?blacklist=true', 'DELETE'],
      ['/api/v1/identity-blocks?authProvider=corp%2Fkeycloak', 'GET'],
      ['/api/v1/identity-blocks/block%2Fid', 'DELETE'],
    ]);
    expect(fetchSpy.mock.calls[1][1]?.body).toBe(JSON.stringify({ adminClientId: '', adminClientSecret: '' }));
  });

  it('reports a rejected unblock instead of silently succeeding', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ message: 'Forbidden' }, 403));
    await expect(identityApi.unblock('blocked')).rejects.toThrow('HTTP 403');
  });
});
