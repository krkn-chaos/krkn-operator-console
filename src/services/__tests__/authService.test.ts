import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AUTH_STORAGE_KEYS, RateLimitError } from '../../types/auth';
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
    it('stores groups as JSON string in localStorage under USER_GROUPS key', () => {
      const user: User = { ...baseUser, groups: ['group-a', 'group-b'] };

      authService.setUser(user);

      const stored = localStorage.getItem(AUTH_STORAGE_KEYS.USER_GROUPS);
      expect(stored).toBe(JSON.stringify(['group-a', 'group-b']));
    });

    it('does not write USER_GROUPS key when groups are undefined', () => {
      authService.setUser(baseUser);

      const stored = localStorage.getItem(AUTH_STORAGE_KEYS.USER_GROUPS);
      expect(stored).toBeNull();
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

    it('should return user with undefined groups when stored groups JSON is invalid', () => {
      authService.setUser(baseUser);
      // Manually corrupt the stored JSON
      localStorage.setItem(AUTH_STORAGE_KEYS.USER_GROUPS, '{not-valid-json');

      const user = authService.getUser();

      expect(user).not.toBeNull();
      expect(user!.groups).toBeUndefined();
    });
  });

  describe('clearUser', () => {
    it('removes the USER_GROUPS key from localStorage', () => {
      authService.setUser({ ...baseUser, groups: ['team-x'] });
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.USER_GROUPS)).not.toBeNull();

      authService.clearUser();

      expect(localStorage.getItem(AUTH_STORAGE_KEYS.USER_GROUPS)).toBeNull();
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
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)).toBe('legacy-token');
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
    });
  });

  it('logout clears shared and legacy auth data', () => {
    authService.setToken('shared-token');
    authService.setUser(baseUser);
    localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT, new Date(Date.now() + 60_000).toISOString());
    sessionStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, 'legacy-token');

    authService.logout();

    expect(localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.USER_EMAIL)).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT)).toBeNull();
    expect(sessionStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)).toBeNull();
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

      expect(localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)).toBe('shared-token');
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.USER_EMAIL)).toBe('test@example.com');
      expect(localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT)).toBe(expiresAt);
      expect(sessionStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)).toBeNull();
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
