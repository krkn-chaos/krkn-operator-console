import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';
import { AppProvider } from './context/AppContext';
import { operatorApi } from './services/operatorApi';
import { studioLeaveGuard } from './components/Studio/studioLeaveGuard';

/**
 * App-level test for Elasticsearch navigation.
 *
 * The reducer transition (NAVIGATE_TO_ELASTICSEARCH_DATA -> elasticsearch_data)
 * is covered directly in AppContext.test.tsx. This test exercises the parts the
 * reducer test cannot reach: the real AppSidebar callback wiring, App's
 * handleNavigateToElasticsearchData guarded dispatch, and the render switch that
 * mounts ElasticsearchDataView for the elasticsearch_data phase.
 *
 * Everything below App/AppSidebar is stubbed so the test stays focused on the
 * navigation path rather than child-component internals or network I/O.
 */

// Poller hooks perform network I/O on mount; stub them out.
vi.mock('./hooks', () => ({
  useTargetPoller: vi.fn(),
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));
vi.mock('./hooks/useScenarioRunsPoller', () => ({
  useScenarioRunsPoller: () => ({ fetchRunDetails: vi.fn() }),
}));
vi.mock('./hooks/useGraphRunsPoller', () => ({
  useGraphRunsPoller: vi.fn(),
}));
vi.mock('./hooks/useRole', () => ({
  useRole: () => ({ isAdmin: true }),
}));

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    state: { user: { userId: 'u1', name: 'Ada', surname: 'Lovelace' } },
    logout: vi.fn(),
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// handleCreateJob calls operatorApi.createTargetRequest via its proceed callback.
vi.mock('./services/operatorApi', () => ({
  operatorApi: { createTargetRequest: vi.fn() },
}));

// Stub every child component App pulls from the barrel so the render switch is
// observable without mounting real pages (which do their own network I/O).
vi.mock('./components', () => ({
  LoadingScreen: () => <div>LoadingScreen</div>,
  ErrorDisplay: () => <div>ErrorDisplay</div>,
  ClusterMultiSelector: () => <div>ClusterMultiSelector</div>,
  RegistrySelector: () => <div>RegistrySelector</div>,
  ScenariosList: () => <div>ScenariosList</div>,
  JobsList: () => <div>JobsList</div>,
  Settings: () => <div>Settings</div>,
  TerminalContent: () => <div>TerminalContent</div>,
  Studio: () => <div>Studio</div>,
  ElasticsearchDataView: () => <div data-testid="elasticsearch-data-view">ElasticsearchDataView</div>,
}));
vi.mock('./components/FileManagement', () => ({ FileManagementPage: () => <div>FileManagementPage</div> }));
vi.mock('./components/ResiliencyHistory', () => ({
  ResiliencyHistoryPage: () => <div data-testid="resiliency-history-page">ResiliencyHistoryPage</div>,
}));
vi.mock('./components/ScenarioDetail', () => ({ ScenarioDetail: () => <div>ScenarioDetail</div> }));
vi.mock('./components/UserForm', () => ({ UserForm: () => <div>UserForm</div> }));
vi.mock('./components/ChangePasswordForm', () => ({ ChangePasswordForm: () => <div>ChangePasswordForm</div> }));

function renderApp() {
  return render(
    <AppProvider>
      <App />
    </AppProvider>,
  );
}

describe('App Elasticsearch navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // App reads theme from localStorage on mount; jsdom does not expose it here.
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
  });

  it('renders ElasticsearchDataView after clicking the sidebar Elasticsearch item', async () => {
    const user = userEvent.setup();
    renderApp();

    // Default phase does not show the Elasticsearch page.
    expect(screen.queryByTestId('elasticsearch-data-view')).not.toBeInTheDocument();

    // Click the real sidebar item, exercising the callback wiring + guarded dispatch.
    await user.click(screen.getByText('ES Data'));

    await waitFor(() => {
      expect(screen.getByTestId('elasticsearch-data-view')).toBeInTheDocument();
    });
  });
});

describe('App Resiliency History navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
  });

  it('renders ResiliencyHistoryPage after choosing its sidebar destination', async () => {
    const user = userEvent.setup();
    renderApp();

    expect(screen.queryByTestId('resiliency-history-page')).not.toBeInTheDocument();
    await user.click(screen.getByText('Resiliency History'));
    await waitFor(() => expect(screen.getByTestId('resiliency-history-page')).toBeInTheDocument());
  });
});

/**
 * Scenario creation (handleCreateJob) runs its target-creation work through a
 * `proceed` callback that is gated by the Studio unsaved-work guard. These tests
 * cover the three guard states: clean (not in Studio, so no guard), confirmed
 * (guard returns true), and cancelled (guard returns false).
 */
describe('App scenario creation guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(operatorApi.createTargetRequest).mockResolvedValue({ uuid: 't1' });
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    // The guard is a module-level ref; reset it so tests do not leak state.
    studioLeaveGuard.current = null;
  });

  it('creates the target directly when not in Studio (clean, no guard)', async () => {
    const user = userEvent.setup();
    renderApp();

    // Default jobs_list phase: checkStudioGuard is a no-op, proceed runs.
    await user.click(screen.getByText('Run Scenario'));

    await waitFor(() =>
      expect(operatorApi.createTargetRequest).toHaveBeenCalledTimes(1),
    );
  });

  it('creates the target when the Studio guard confirms the leave', async () => {
    const user = userEvent.setup();
    renderApp();

    // Enter Studio so checkStudioGuard consults the registered guard.
    await user.click(screen.getByText('Chaos Studio'));
    // Guard confirms: returns true, leaving proceed() for the caller to run.
    const guard = vi.fn().mockReturnValue(true);
    studioLeaveGuard.current = guard;

    await user.click(screen.getByText('Run Scenario'));

    await waitFor(() =>
      expect(operatorApi.createTargetRequest).toHaveBeenCalledTimes(1),
    );
    expect(guard).toHaveBeenCalledTimes(1);
  });

  it('skips target creation when the Studio guard cancels the leave', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByText('Chaos Studio'));
    // Guard cancels: returns false, so handleCreateJob bails before proceed().
    const guard = vi.fn().mockReturnValue(false);
    studioLeaveGuard.current = guard;

    await user.click(screen.getByText('Run Scenario'));

    expect(guard).toHaveBeenCalledTimes(1);
    expect(operatorApi.createTargetRequest).not.toHaveBeenCalled();
  });
});
