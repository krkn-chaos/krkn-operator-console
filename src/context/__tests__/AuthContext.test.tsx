import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../AuthContext';
import { authService } from '../../services/authService';
import { operatorApi } from '../../services/operatorApi';
import { setUnauthorizedHandler } from '../../utils/apiClient';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { AUTH_STORAGE_KEYS } from '../../types/auth';
import type { User, UserRole } from '../../types/auth';

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

function ProtectedRouteConsumer() {
  return (
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route
          path="/app"
          element={(
            <ProtectedRoute>
              <span data-testid="protected-content">Protected content</span>
            </ProtectedRoute>
          )}
        />
        <Route path="/login" element={<span data-testid="login-route">Login</span>} />
      </Routes>
    </MemoryRouter>
  );
}

function dispatchAuthStorageEvent(): void {
  const event = new Event('storage') as StorageEvent;
  Object.defineProperties(event, {
    key: { value: AUTH_STORAGE_KEYS.TOKEN },
    storageArea: { value: window.localStorage },
  });
  window.dispatchEvent(event);
}

describe('AuthProvider - loadAndStoreGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(authService.getUser).mockReturnValue(null);
    vi.mocked(authService.getToken).mockReturnValue(null);
    vi.mocked(authService.getTokenExpiresAt).mockReturnValue(null);
    vi.mocked(authService.isTokenExpired).mockReturnValue(false);
    vi.mocked(authService.logout).mockImplementation(() => {});
    vi.mocked(operatorApi.getGroups).mockResolvedValue({ groups: [] });
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
    vi.mocked(authService.getTokenExpiresAt).mockReturnValue(new Date(Date.now() + 60 * 60 * 1000).toISOString());
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
    vi.mocked(authService.getTokenExpiresAt).mockReturnValue(new Date(Date.now() + 60 * 60 * 1000).toISOString());
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
    vi.mocked(authService.getTokenExpiresAt).mockReturnValue(new Date(Date.now() + 60 * 60 * 1000).toISOString());
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

  it('updates auth state when another tab logs in', async () => {
    const user: User = {
      userId: 'u3',
      name: 'Shared',
      surname: 'User',
      role: 'user',
    };

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    vi.mocked(authService.getUser).mockReturnValue(user);
    vi.mocked(authService.getToken).mockReturnValue('shared-token');
    vi.mocked(authService.getTokenExpiresAt).mockReturnValue(new Date(Date.now() + 60 * 60 * 1000).toISOString());
    vi.mocked(authService.isTokenExpired).mockReturnValue(false);

    act(() => {
      dispatchAuthStorageEvent();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
      expect(screen.getByTestId('role').textContent).toBe('user');
    });
  });

  it('updates auth state when another tab logs out', async () => {
    const user: User = {
      userId: 'u4',
      name: 'Shared',
      surname: 'User',
      role: 'user',
    };
    vi.mocked(authService.getUser).mockReturnValue(user);
    vi.mocked(authService.getToken).mockReturnValue('shared-token');
    vi.mocked(authService.getTokenExpiresAt).mockReturnValue(new Date(Date.now() + 60 * 60 * 1000).toISOString());

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('true'));

    vi.mocked(authService.getUser).mockReturnValue(null);
    vi.mocked(authService.getToken).mockReturnValue(null);
    vi.mocked(authService.getTokenExpiresAt).mockReturnValue(null);

    act(() => {
      dispatchAuthStorageEvent();
    });

    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('false'));
  });

  it('signs out on focus when session has expired', async () => {
    const user: User = {
      userId: 'u5',
      name: 'Expiring',
      surname: 'User',
      role: 'user',
    };
    vi.mocked(authService.getUser).mockReturnValue(user);
    vi.mocked(authService.getToken).mockReturnValue('expired-token');
    vi.mocked(authService.getTokenExpiresAt).mockReturnValue(new Date(Date.now() + 60 * 60 * 1000).toISOString());
    vi.mocked(authService.isTokenExpired).mockReturnValue(false);
    window.history.replaceState({}, '', '/login');

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('true'));

    vi.mocked(authService.isTokenExpired).mockReturnValue(true);
    act(() => window.dispatchEvent(new Event('focus')));

    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('false'));
    expect(authService.logout).toHaveBeenCalledOnce();
    window.history.replaceState({}, '', '/');
  });

  it('redirects protected content after another tab logs out', async () => {
    const user: User = {
      userId: 'u7',
      name: 'Protected',
      surname: 'User',
      role: 'user',
    };
    vi.mocked(authService.getUser).mockReturnValue(user);
    vi.mocked(authService.getToken).mockReturnValue('protected-token');
    vi.mocked(authService.getTokenExpiresAt).mockReturnValue(new Date(Date.now() + 60 * 60 * 1000).toISOString());

    render(
      <AuthProvider>
        <ProtectedRouteConsumer />
      </AuthProvider>,
    );
    expect(await screen.findByTestId('protected-content')).toBeInTheDocument();

    vi.mocked(authService.getUser).mockReturnValue(null);
    vi.mocked(authService.getToken).mockReturnValue(null);
    vi.mocked(authService.getTokenExpiresAt).mockReturnValue(null);

    act(() => {
      dispatchAuthStorageEvent();
    });

    expect(await screen.findByTestId('login-route')).toBeInTheDocument();
  });

  it('clears an expired session during startup', async () => {
    vi.mocked(authService.getUser).mockReturnValue({
      userId: 'u8',
      name: 'Expired',
      surname: 'User',
      role: 'user',
    });
    vi.mocked(authService.getToken).mockReturnValue('expired-token');
    vi.mocked(authService.getTokenExpiresAt).mockReturnValue(new Date(Date.now() - 60_000).toISOString());
    vi.mocked(authService.isTokenExpired).mockReturnValue(true);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
      expect(authService.logout).toHaveBeenCalledOnce();
    });
  });

  it('signs out when expiry timer fires', async () => {
    vi.useFakeTimers();
    const user: User = {
      userId: 'u6',
      name: 'Timed',
      surname: 'User',
      role: 'user',
    };
    const expiresAt = new Date(Date.now() + 1_000).toISOString();
    vi.mocked(authService.getUser).mockReturnValue(user);
    vi.mocked(authService.getToken).mockReturnValue('timed-token');
    vi.mocked(authService.getTokenExpiresAt).mockReturnValue(expiresAt);
    vi.mocked(authService.isTokenExpired).mockImplementation(() => Date.now() >= Date.parse(expiresAt));
    window.history.replaceState({}, '', '/login');

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByTestId('authenticated').textContent).toBe('true');

    await vi.advanceTimersByTimeAsync(1_000);
    expect(authService.logout).toHaveBeenCalledOnce();
    expect(screen.getByTestId('authenticated').textContent).toBe('false');

    vi.useRealTimers();
    window.history.replaceState({}, '', '/');
  });
});
