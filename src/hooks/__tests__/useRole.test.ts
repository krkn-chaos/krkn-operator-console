import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../context/AuthContext');

import { useAuth } from '../../context/AuthContext';
import { useRole } from '../useRole';

describe('useRole - userGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array for userGroups when user has no groups', () => {
    vi.mocked(useAuth).mockReturnValue({
      state: {
        isAuthenticated: true,
        user: {
          userId: 'test@example.com',
          name: 'Test',
          surname: 'User',
          role: 'user',
        },
        loading: false,
      },
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      isAdmin: vi.fn(() => false),
    });

    const { result } = renderHook(() => useRole());

    expect(result.current.userGroups).toEqual([]);
  });

  it('should return groups array when user has groups', () => {
    vi.mocked(useAuth).mockReturnValue({
      state: {
        isAuthenticated: true,
        user: {
          userId: 'test@example.com',
          name: 'Test',
          surname: 'User',
          role: 'admin',
          groups: ['team-alpha', 'team-beta'],
        },
        loading: false,
      },
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      isAdmin: vi.fn(() => true),
    });

    const { result } = renderHook(() => useRole());

    expect(result.current.userGroups).toEqual(['team-alpha', 'team-beta']);
  });
});
