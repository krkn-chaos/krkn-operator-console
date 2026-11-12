import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AUTH_SESSION_STORAGE_KEY, AUTH_STORAGE_KEYS, RateLimitError } from '../../types/auth';
import { authService } from '../authService';
import type { User } from '../../types/auth';

describe('authService - user groups', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const baseUser: User = {
    userId: 'test@example.com',
    name: 'Test',
    surname: 'User',
    role: 'user',
  };

  describe('setUser', () => {
    it('stores groups in versioned session record', () => {
      const user: User = { ...baseUser, groups: ['group-a', 'group-b'] };

      authService.setUser(user);

      const record = JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)!);
      expect(record.session.user.groups).toEqual(['group-a', 'group-b']);
    });

    it('omits groups when they are undefined', () => {
      authService.setUser(baseUser);

      const record = JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)!);
      expect(record.session.user.groups).toBeUndefined();
    });

    it('does not create a new session version when user data is unchanged', () => {
      authService.setUser(baseUser);
      const generation = JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)!).generation;

      authService.setUser(baseUser);

      expect(JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)!).generation).toBe(generation);
    });
  });

  describe('getUser', () => {
    it('should return user with parsed groups array', () => {
      authService.setUser({ ...baseUser, groups: ['dev', 'ops'] });

      const user = authService.getUser();

      expect(user).not.toBeNull();
      expect(user!.groups).toEqual(['dev', 'ops']);
    });

    it('should return user with undefined groups when no groups stored', () => {
      authService.setUser(baseUser);

      const user = authService.getUser();

      expect(user).not.toBeNull();
      expect(user!.groups).toBeUndefined();
    });

    it('clears malformed versioned session data', () => {
      authService.setUser(baseUser);
      localStorage.setItem(AUTH_SESSION_STORAGE_KEY, '{not-valid-json');

      const user = authService.getUser();

      expect(user).toBeNull();
      expect(JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)!).session).toBeNull();
    });
  });

  describe('clearUser', () => {
    it('clears stored user data', () => {
      authService.setUser({ ...baseUser, groups: ['team-x'] });
      expect(authService.getUser()?.groups).toEqual(['team-x']);

      authService.clearUser();

      expect(authService.getUser()).toBeNull();
    });
  });

  describe('legacy session migration', () => {
    it('moves a valid, unexpired sessionStorage session into localStorage', () => {
      sessionStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, 'legacy-token');
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_EMAIL, baseUser.userId);
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_NAME, baseUser.name);
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_SURNAME, baseUser.surname);
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_ROLE, baseUser.role);
      sessionStorage.setItem(
        AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT,
        new Date(Date.now() + 60_000).toISOString(),
      );

      expect(authService.getToken()).toBe('legacy-token');
      expect(authService.getUser()).toEqual(baseUser);
      expect(JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)!).session.token).toBe('legacy-token');
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)).toBeNull();
      expect(sessionStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)).toBeNull();
    });

    it('discards expired legacy sessionStorage data', () => {
      sessionStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, 'expired-token');
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_EMAIL, baseUser.userId);
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_NAME, baseUser.name);
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_SURNAME, baseUser.surname);
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_ROLE, baseUser.role);
      sessionStorage.setItem(
        AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT,
        new Date(Date.now() - 60_000).toISOString(),
      );

      expect(authService.getToken()).toBeNull();
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)).toBeNull();
      expect(sessionStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)).toBeNull();
      expect(JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)!).session).toBeNull();
    });

    it('does not restore an older tab session after another tab logs out', () => {
      const expiresAt = new Date(Date.now() + 60_000).toISOString();

      // Older tab holds legacy auth while updated tab uses shared auth.
      sessionStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, 'legacy-token');
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_EMAIL, baseUser.userId);
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_NAME, baseUser.name);
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_SURNAME, baseUser.surname);
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_ROLE, baseUser.role);
      sessionStorage.setItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt);
      const olderTabStorage = Object.fromEntries(
        Object.values(AUTH_STORAGE_KEYS).map(key => [key, sessionStorage.getItem(key)]),
      );

      sessionStorage.clear();
      authService.setSession(baseUser, 'shared-token', expiresAt);
      authService.logout();

      // Reload older tab with its unchanged sessionStorage and shared localStorage.
      Object.entries(olderTabStorage).forEach(([key, value]) => {
        if (value !== null) sessionStorage.setItem(key, value);
      });

      expect(authService.getToken()).toBeNull();
      expect(authService.getUser()).toBeNull();
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)).toBeNull();
      expect(JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)!).session).toBeNull();
      expect(sessionStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)).toBeNull();
    });

    it('allows only one legacy session migration across tabs', () => {
      sessionStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, 'first-legacy-token');
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_EMAIL, baseUser.userId);
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_NAME, baseUser.name);
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_SURNAME, baseUser.surname);
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_ROLE, baseUser.role);
      sessionStorage.setItem(
        AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT,
        new Date(Date.now() + 60_000).toISOString(),
      );

      expect(authService.getToken()).toBe('first-legacy-token');
      Object.values(AUTH_STORAGE_KEYS).forEach(key => localStorage.removeItem(key));

      sessionStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, 'second-legacy-token');
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_EMAIL, baseUser.userId);
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_NAME, baseUser.name);
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_SURNAME, baseUser.surname);
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_ROLE, baseUser.role);
      sessionStorage.setItem(
        AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT,
        new Date(Date.now() + 60_000).toISOString(),
      );

      expect(authService.getToken()).toBe('first-legacy-token');
      expect(sessionStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)).toBeNull();
    });
  });

  it('logout clears shared and legacy auth data', () => {
    authService.setSession(baseUser, 'shared-token', new Date(Date.now() + 60_000).toISOString());
    sessionStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, 'legacy-token');

    authService.logout();

    expect(authService.getToken()).toBeNull();
    expect(authService.getUser()).toBeNull();
    expect(authService.getTokenExpiresAt()).toBeNull();
    expect(JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)!).session).toBeNull();
    expect(sessionStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)).toBeNull();
  });

  it('keeps a newer shared session when logout request token is stale', () => {
    authService.setSession(baseUser, 'current-token', new Date(Date.now() + 60_000).toISOString());

    expect(authService.logout('previous-token')).toBe(false);
    expect(authService.getToken()).toBe('current-token');
    expect(authService.getUser()).toEqual(baseUser);
    expect(authService.getTokenExpiresAt()).not.toBeNull();

    expect(authService.logout('current-token')).toBe(true);
    expect(authService.getToken()).toBeNull();
  });
});

describe('authService - rate limiting (429)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mock429() {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: () => Promise.resolve({ error: 'rate_limited', message: 'Too many requests, please try again later' }),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response);
  }

  describe('login', () => {
    it('stores successful login data in localStorage', async () => {
      const expiresAt = new Date(Date.now() + 60_000).toISOString();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          token: 'shared-token',
          expiresAt,
          userId: 'test@example.com',
          role: 'user',
          name: 'Test',
          surname: 'User',
        }),
      } as unknown as Response);

      await authService.login({ userId: 'test@example.com', password: 'password' });

      const record = JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)!);
      expect(record.session).toEqual({
        token: 'shared-token',
        user: { userId: 'test@example.com', name: 'Test', surname: 'User', role: 'user' },
        expiresAt,
      });
      expect(record.generation).toBe(1);
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)).toBeNull();
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.USER_EMAIL)).toBeNull();
      expect(sessionStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)).toBeNull();
    });

    it('rejects login response started before another tab logs in and out', async () => {
      let resolveFirst!: (response: Response) => void;
      globalThis.fetch = vi.fn()
        .mockImplementationOnce(() => new Promise<Response>(resolve => { resolveFirst = resolve; }))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({
            token: 'other-tab-token', expiresAt: new Date(Date.now() + 60_000).toISOString(),
            userId: 'other@example.com', role: 'user', name: 'Other', surname: 'Tab',
          }),
        } as unknown as Response);

      const staleLogin = authService.login({ userId: 'stale@example.com', password: 'password' });
      await authService.login({ userId: 'other@example.com', password: 'password' });
      expect(authService.logout()).toBe(true);

      resolveFirst({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          token: 'stale-token', expiresAt: new Date(Date.now() + 60_000).toISOString(),
          userId: 'stale@example.com', role: 'user', name: 'Stale', surname: 'Tab',
        }),
      } as unknown as Response);

      expect(await staleLogin).toBeNull();
      expect(authService.getToken()).toBeNull();
      const record = JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE_KEY)!);
      expect(record.session).toBeNull();
      expect(record.logoutGeneration).toBe(1);
    });

    it('commits concurrent login user and token together as one versioned record', async () => {
      const responses: Array<(response: Response) => void> = [];
      globalThis.fetch = vi.fn().mockImplementation(() => new Promise<Response>(resolve => {
        responses.push(resolve);
      }));

      const firstLogin = authService.login({ userId: 'first@example.com', password: 'password' });
      const secondLogin = authService.login({ userId: 'second@example.com', password: 'password' });
      const makeResponse = (userId: string, name: string, token: string): Response => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          token, expiresAt: new Date(Date.now() + 60_000).toISOString(),
          userId, role: 'user', name, surname: 'User',
        }),
      } as unknown as Response);

      responses[0](makeResponse('first@example.com', 'First', 'first-token'));
      expect(await firstLogin).not.toBeNull();
      responses[1](makeResponse('second@example.com', 'Second', 'second-token'));
      expect(await secondLogin).toBeNull();

      const serializedRecord = localStorage.getItem(AUTH_SESSION_STORAGE_KEY)!;
      const record = JSON.parse(serializedRecord);
      expect(record.version).toBe(1);
      expect(record.generation).toBe(1);
      expect(record.session).toMatchObject({
        token: 'first-token',
        user: { userId: 'first@example.com', name: 'First' },
      });
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)).toBeNull();
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.USER_EMAIL)).toBeNull();
    });

    it('should throw RateLimitError on 429 response', async () => {
      mock429();

      await expect(
        authService.login({ userId: 'test@example.com', password: 'password' }),
      ).rejects.toThrow(RateLimitError);
    });

    it('should include a user-friendly message', async () => {
      mock429();

      await expect(
        authService.login({ userId: 'test@example.com', password: 'password' }),
      ).rejects.toThrow('Too many attempts. Please wait and try again.');
    });
  });

  describe('register', () => {
    it('should throw RateLimitError on 429 response', async () => {
      mock429();

      await expect(
        authService.register({
          userId: 'test@example.com',
          password: 'password123',
          name: 'Test',
          surname: 'User',
          role: 'admin',
        }),
      ).rejects.toThrow(RateLimitError);
    });
  });

  describe('isRegistered', () => {
    it('should throw RateLimitError on 429 response', async () => {
      mock429();

      await expect(authService.isRegistered()).rejects.toThrow(RateLimitError);
    });
  });
});
