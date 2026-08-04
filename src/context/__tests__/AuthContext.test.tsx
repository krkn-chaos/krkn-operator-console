import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';
import { authService } from '../../services/authService';
import { operatorApi } from '../../services/operatorApi';
import { setUnauthorizedHandler } from '../../utils/apiClient';
import type { UserRole } from '../../types/auth';

vi.mock('../../services/authService');
vi.mock('../../services/operatorApi');
vi.mock('../../utils/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiClient')>();
  return {
    ...actual,
    setUnauthorizedHandler: vi.fn(),
  };
});

function TestConsumer() {
  const { state } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(state.loading)}</span>
      <span data-testid="authenticated">{String(state.isAuthenticated)}</span>
      <span data-testid="groups">{JSON.stringify(state.user?.groups ?? [])}</span>
      <span data-testid="role">{state.user?.role ?? 'none'}</span>
    </div>
  );
}

describe('AuthProvider - loadAndStoreGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and stores groups for admin users on init', async () => {
    const adminUser = {
      userId: 'u1',
      name: 'Admin',
      surname: 'User',
      role: 'admin' as UserRole,
      organization: 'test-org',
    };

    vi.mocked(authService.getUser).mockReturnValue(adminUser);
    vi.mocked(authService.getToken).mockReturnValue('valid-token');
    vi.mocked(authService.isTokenExpired).mockReturnValue(false);
    vi.mocked(authService.setUser).mockImplementation(() => {});
    vi.mocked(operatorApi.getGroups).mockResolvedValue({
      groups: [
        { name: 'dev-team', description: 'Development' },
        { name: 'ops-team', description: 'Operations' },
      ],
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await waitFor(() => {
      expect(operatorApi.getGroups).toHaveBeenCalledOnce();
    });

    await waitFor(() => {
      expect(screen.getByTestId('groups').textContent).toBe(
        JSON.stringify(['dev-team', 'ops-team']),
      );
    });

    expect(authService.setUser).toHaveBeenCalledWith(
      expect.objectContaining({ groups: ['dev-team', 'ops-team'] }),
    );
  });

  it('does not fetch groups for non-admin users', async () => {
    const regularUser = {
      userId: 'u2',
      name: 'Regular',
      surname: 'User',
      role: 'user' as UserRole,
      organization: 'test-org',
    };

    vi.mocked(authService.getUser).mockReturnValue(regularUser);
    vi.mocked(authService.getToken).mockReturnValue('valid-token');
    vi.mocked(authService.isTokenExpired).mockReturnValue(false);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(operatorApi.getGroups).not.toHaveBeenCalled();
  });

  it('handles group fetch failure gracefully', async () => {
    const adminUser = {
      userId: 'u1',
      name: 'Admin',
      surname: 'User',
      role: 'admin' as UserRole,
      organization: 'test-org',
    };

    vi.mocked(authService.getUser).mockReturnValue(adminUser);
    vi.mocked(authService.getToken).mockReturnValue('valid-token');
    vi.mocked(authService.isTokenExpired).mockReturnValue(false);
    vi.mocked(operatorApi.getGroups).mockRejectedValue(new Error('Network error'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
  });

  it('does not fetch groups when no user is logged in', async () => {
    vi.mocked(authService.getUser).mockReturnValue(null);
    vi.mocked(authService.getToken).mockReturnValue(null);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(operatorApi.getGroups).not.toHaveBeenCalled();
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
  });

  it('sets unauthorized handler on mount', async () => {
    vi.mocked(authService.getUser).mockReturnValue(null);
    vi.mocked(authService.getToken).mockReturnValue(null);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(setUnauthorizedHandler).toHaveBeenCalledWith(expect.any(Function));
  });
});
