import { describe, it, expect, beforeEach } from 'vitest';
import { AUTH_STORAGE_KEYS } from '../../types/auth';
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
