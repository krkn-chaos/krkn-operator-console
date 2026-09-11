import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AUTH_STORAGE_KEYS, RateLimitError } from '../../types/auth';
import { authService } from '../authService';
import type { User } from '../../types/auth';

describe('authService - user groups', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  const baseUser: User = {
    userId: 'test@example.com',
    name: 'Test',
    surname: 'User',
    role: 'user',
  };

  describe('setUser', () => {
    it('should store groups as JSON string in sessionStorage under USER_GROUPS key', () => {
      const user: User = { ...baseUser, groups: ['group-a', 'group-b'] };

      authService.setUser(user);

      const stored = sessionStorage.getItem(AUTH_STORAGE_KEYS.USER_GROUPS);
      expect(stored).toBe(JSON.stringify(['group-a', 'group-b']));
    });

    it('should NOT write USER_GROUPS key when groups is undefined', () => {
      authService.setUser(baseUser);

      const stored = sessionStorage.getItem(AUTH_STORAGE_KEYS.USER_GROUPS);
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
      sessionStorage.setItem(AUTH_STORAGE_KEYS.USER_GROUPS, '{not-valid-json');

      const user = authService.getUser();

      expect(user).not.toBeNull();
      expect(user!.groups).toBeUndefined();
    });
  });

  describe('clearUser', () => {
    it('should remove the USER_GROUPS key from sessionStorage', () => {
      authService.setUser({ ...baseUser, groups: ['team-x'] });
      expect(sessionStorage.getItem(AUTH_STORAGE_KEYS.USER_GROUPS)).not.toBeNull();

      authService.clearUser();

      expect(sessionStorage.getItem(AUTH_STORAGE_KEYS.USER_GROUPS)).toBeNull();
    });
  });
});

describe('authService - rate limiting (429)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
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
