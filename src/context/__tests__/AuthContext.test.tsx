import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../AuthContext';
import { AppProvider, useAppContext } from '../AppContext';
import { authService } from '../../services/authService';
import { operatorApi } from '../../services/operatorApi';
import { setUnauthorizedHandler } from '../../utils/apiClient';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { AUTH_SESSION_STORAGE_KEY } from '../../types/auth';
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
  );
}

function RouterLocationConsumer() {
  const location = useLocation();
  const returnUrl = new URLSearchParams(location.search).get('returnUrl');

  return (
    <>
      <span data-testid="route-path">{location.pathname}</span>
      <span data-testid="route-return-url">{returnUrl}</span>
    </>
  );
}

function renderAuthProvider(
  children: ReactNode,
  options: { basename?: string; initialEntries?: string[] } = {},
) {
  return render(
    <MemoryRouter basename={options.basename} initialEntries={options.initialEntries ?? ['/login']}>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>,
  );
}

function dispatchAuthStorageEvent(): void {
  const event = new Event('storage') as StorageEvent;
  Object.defineProperties(event, {
    key: { value: AUTH_SESSION_STORAGE_KEY },
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
    vi.mocked(authService.getSessionVersion).mockReturnValue({ generation: 0, logoutGeneration: 0 });
    vi.mocked(authService.isTokenExpired).mockReturnValue(false);
    vi.mocked(authService.logout).mockImplementation(() => true);
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

    renderAuthProvider(<TestConsumer />);

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

    renderAuthProvider(<TestConsumer />);

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

    renderAuthProvider(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
  });

  it('does not fetch groups when no user is logged in', async () => {
    vi.mocked(authService.getUser).mockReturnValue(null);
    vi.mocked(authService.getToken).mockReturnValue(null);

    renderAuthProvider(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(operatorApi.getGroups).not.toHaveBeenCalled();
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
  });

  it('sets unauthorized handler on mount', async () => {
    vi.mocked(authService.getUser).mockReturnValue(null);
    vi.mocked(authService.getToken).mockReturnValue(null);

    renderAuthProvider(<TestConsumer />);

    expect(setUnauthorizedHandler).toHaveBeenCalledWith(expect.any(Function));
  });

  it('updates auth state when another tab logs in', async () => {
    const user: User = {
      userId: 'u3',
      name: 'Shared',
      surname: 'User',
      role: 'user',
    };

    renderAuthProvider(<TestConsumer />);
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

    renderAuthProvider(<TestConsumer />);
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

    renderAuthProvider(<TestConsumer />);
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

    renderAuthProvider(<ProtectedRouteConsumer />, { initialEntries: ['/app'] });
    expect(await screen.findByTestId('protected-content')).toBeInTheDocument();

    vi.mocked(authService.getUser).mockReturnValue(null);
    vi.mocked(authService.getToken).mockReturnValue(null);
    vi.mocked(authService.getTokenExpiresAt).mockReturnValue(null);

    act(() => {
      dispatchAuthStorageEvent();
    });

    expect(await screen.findByTestId('login-route')).toBeInTheDocument();
  });

  it('resets account-scoped application state when another tab switches users', async () => {
    const firstUser: User = { userId: 'first@example.com', name: 'First', surname: 'User', role: 'user' };
    const secondUser: User = { userId: 'second@example.com', name: 'Second', surname: 'User', role: 'user' };
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    vi.mocked(authService.getUser).mockReturnValue(firstUser);
    vi.mocked(authService.getToken).mockReturnValue('first-token');
    vi.mocked(authService.getTokenExpiresAt).mockReturnValue(expiresAt);

    let app!: ReturnType<typeof useAppContext>;
    function AccountStateReader() {
      app = useAppContext();
      const { state } = useAuth();
      return <span data-testid="account-id">{state.user?.userId ?? 'none'}</span>;
    }

    renderAuthProvider(<AppProvider><AccountStateReader /></AppProvider>);
    await waitFor(() => expect(screen.getByTestId('account-id').textContent).toBe(firstUser.userId));

    act(() => {
      app.dispatch({ type: 'LOAD_SCENARIO_RUNS_SUCCESS', payload: { runs: [{
        scenarioRunName: 'first-run', scenarioName: 'pod-scenarios', phase: 'Running',
        totalTargets: 1, successfulJobs: 0, failedJobs: 0, runningJobs: 1,
        clusterJobs: [], createdAt: '2026-01-01T00:00:00Z',
      }] } });
      app.dispatch({ type: 'LOAD_GRAPH_RUNS_SUCCESS', payload: { runs: [{
        name: 'first-graph', namespace: 'krkn-operator-system',
        creationTimestamp: '2026-01-01T00:00:00Z', phase: 'Running',
        ownerUserId: firstUser.userId, targetRequestId: 'target-1',
        summary: { totalNodes: 1, completedNodes: 0, runningNodes: 1, failedNodes: 0, pendingNodes: 0 },
      }] } });
      app.dispatch({ type: 'TOGGLE_CLUSTER', payload: { cluster: {
        operatorName: 'operator', clusterName: 'first-cluster', clusterApiUrl: 'https://first.example',
      } } });
      app.dispatch({ type: 'PROVIDERS_LOADED', payload: { providers: [
        { name: 'first-provider', active: true, lastHeartbeat: null },
      ] } });
      app.dispatch({ type: 'PROVIDER_CONFIG_CREATE_SUCCESS', payload: { uuid: 'first-config' } });
      app.dispatch({ type: 'PROVIDER_CONFIG_READY', payload: { data: {
        'first-provider': { configMap: 'first-config', namespace: 'first-namespace', fields: [] },
      } } });
      app.dispatch({ type: 'UPDATE_SCENARIO_FORM', payload: { formValues: { namespace: 'first-user' } } });
    });

    expect(app.state.scenarioRuns).toHaveLength(1);
    expect(app.state.graphRuns).toHaveLength(1);
    expect(app.state.selectedClusters).toHaveLength(1);
    expect(app.state.providers).toHaveLength(1);
    expect(app.state.providerConfigUuid).toBe('first-config');
    expect(app.state.providerConfigData?.['first-provider']?.configMap).toBe('first-config');
    expect(app.state.scenarioFormValues).toEqual({ namespace: 'first-user' });

    vi.mocked(authService.getUser).mockReturnValue(secondUser);
    vi.mocked(authService.getToken).mockReturnValue('second-token');
    act(() => dispatchAuthStorageEvent());

    expect(screen.getByTestId('account-id').textContent).toBe(secondUser.userId);
    expect(app.state.scenarioRuns).toEqual([]);
    expect(app.state.graphRuns).toEqual([]);
    expect(app.state.selectedClusters).toEqual([]);
    expect(app.state.providers).toBeNull();
    expect(app.state.providerConfigUuid).toBeNull();
    expect(app.state.providerConfigData).toBeNull();
    expect(app.state.scenarioFormValues).toBeNull();
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

    renderAuthProvider(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
      expect(authService.logout).toHaveBeenCalledOnce();
    });
  });

  it('ignores a 401 for an older token without logging out the current session', async () => {
    vi.mocked(authService.getUser).mockReturnValue({
      userId: 'u9',
      name: 'Current',
      surname: 'User',
      role: 'user',
    });
    vi.mocked(authService.getToken).mockReturnValue('current-token');
    vi.mocked(authService.getTokenExpiresAt).mockReturnValue(new Date(Date.now() + 60 * 60 * 1000).toISOString());
    vi.mocked(authService.logout).mockImplementation((expectedToken) => expectedToken === 'current-token');
    window.history.replaceState({}, '', '/login');

    renderAuthProvider(<TestConsumer />);
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('true'));

    const calls = vi.mocked(setUnauthorizedHandler).mock.calls;
    const unauthorizedHandler = calls[calls.length - 1]?.[0];
    expect(unauthorizedHandler).toBeTypeOf('function');

    act(() => unauthorizedHandler?.('previous-token'));
    expect(authService.logout).toHaveBeenCalledWith('previous-token');
    expect(screen.getByTestId('authenticated').textContent).toBe('true');

    act(() => unauthorizedHandler?.('current-token'));
    expect(authService.logout).toHaveBeenCalledWith('current-token');
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    window.history.replaceState({}, '', '/');
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

    renderAuthProvider(
      <>
        <TestConsumer />
        <RouterLocationConsumer />
      </>,
      {
        basename: '/console',
        initialEntries: ['/console/app?view=recent#top'],
      },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByTestId('authenticated').textContent).toBe('true');

    await vi.advanceTimersByTimeAsync(1_000);
    expect(authService.logout).toHaveBeenCalledOnce();
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('route-path').textContent).toBe('/login');
    expect(screen.getByTestId('route-return-url').textContent).toBe('/app?view=recent#top');

    vi.useRealTimers();
    window.history.replaceState({}, '', '/');
  });
});
