import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { AppContext } from './context/AppContext';
import { operatorApi } from './services/operatorApi';
import { graphRunsApi } from './services';
import { useNotifications } from './hooks';
import type { AppState } from './types/api';

// App.tsx pulls in auth, pollers, role checks, and several large child
// components that are unrelated to the delete-handler error handling under
// test here. They are stubbed out so this file stays focused on
// App.tsx's own catch-block logic (the thing Issue #100 changes).
vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    state: {
      user: { userId: 'u1', name: 'Test', surname: 'User', role: 'user', groups: [], email: 'test@example.com' },
      isAuthenticated: true,
    },
    logout: vi.fn(),
  }),
}));

vi.mock('./hooks', () => ({
  useTargetPoller: () => undefined,
  useNotifications: vi.fn(),
}));

vi.mock('./hooks/useScenarioRunsPoller', () => ({
  useScenarioRunsPoller: () => ({ fetchRunDetails: vi.fn() }),
}));

vi.mock('./hooks/useGraphRunsPoller', () => ({
  useGraphRunsPoller: () => undefined,
}));

vi.mock('./hooks/useRole', () => ({
  useRole: () => ({
    role: 'user',
    isAdmin: false,
    isUser: true,
    hasRole: vi.fn(),
    isAuthenticated: true,
    userGroups: [],
  }),
}));

vi.mock('./services/operatorApi', () => ({
  operatorApi: {
    deleteScenarioRun: vi.fn(),
    deleteJob: vi.fn(),
  },
}));

vi.mock('./services', () => ({
  graphRunsApi: {
    deleteGraphRun: vi.fn(),
  },
}));

vi.mock('./components/AppSidebar', () => ({
  AppSidebar: () => null,
  SIDEBAR_RAIL_WIDTH: 0,
}));

vi.mock('./components/FileManagement', () => ({
  FileManagementModal: () => null,
}));

vi.mock('./components', () => ({
  LoadingScreen: () => null,
  ErrorDisplay: () => null,
  ClusterMultiSelector: () => null,
  RegistrySelector: () => null,
  ScenariosList: () => null,
  Settings: () => null,
  TerminalContent: () => null,
  Studio: () => null,
  JobsList: (props: {
    onDeleteScenarioRun: (scenarioRunName: string) => void;
    onDeleteJob: (jobId: string) => void;
    onDeleteGraphRun: (graphRunName: string) => void;
  }) => (
    <div>
      <button onClick={() => props.onDeleteScenarioRun('run-1')}>delete scenario run</button>
      <button onClick={() => props.onDeleteJob('job-1')}>delete job</button>
      <button onClick={() => props.onDeleteGraphRun('graph-1')}>delete graph run</button>
    </div>
  ),
}));

/**
 * Creates an ApiError compatible with isApiError() checks.
 * isApiError expects: err instanceof Error && typeof err.status === 'number'
 */
function createApiError(message: string, status: number, statusText: string): Error & { status: number; statusText: string } {
  return Object.assign(new Error(message), { status, statusText });
}

describe('App delete handlers - status-based permission detection', () => {
  const mockDispatch = vi.fn();
  const mockShowSuccess = vi.fn();
  const mockShowError = vi.fn();

  const baseState: AppState = {
    phase: 'jobs_list',
    uuid: null,
    pollAttempts: 0,
    scenarioRuns: [],
    scenarioRunsRefreshTrigger: 0,
    pollingRunNames: new Set(),
    expandedRunIds: new Set(),
    expandedClusterJobs: new Set(),
    loadingRunDetails: new Set(),
    graphRuns: [],
    expandedGraphRunIds: new Set(),
    clusters: null,
    selectedClusters: [],
    registryType: null,
    registryConfig: null,
    scenarios: null,
    selectedScenarios: null,
    selectedScenario: null,
    scenarioDetail: null,
    scenarioFormValues: null,
    scenarioGlobals: null,
    globalFormValues: null,
    globalTouchedFields: null,
    rerunIntent: null,
    startInPreview: false,
    rerunScenarioImage: null,
    rerunKubeconfigPath: null,
    error: null,
    providers: null,
    providerConfigUuid: null,
    providerConfigStatus: 'idle',
    providerConfigData: null,
    notifications: [],
  };

  const renderApp = () => {
    return render(
      <MemoryRouter>
        <AppContext.Provider value={{ state: baseState, dispatch: mockDispatch }}>
          <App />
        </AppContext.Provider>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotifications).mockReturnValue({
      showNotification: vi.fn(),
      showSuccess: mockShowSuccess,
      showError: mockShowError,
      showInfo: vi.fn(),
      showWarning: vi.fn(),
      hideNotification: vi.fn(),
    });
  });

  it('shows the permission-denied message when deleteScenarioRun rejects with a 403 ApiError', async () => {
    vi.mocked(operatorApi.deleteScenarioRun).mockRejectedValueOnce(
      createApiError('Forbidden', 403, 'Forbidden'),
    );

    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByText('delete scenario run'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        'Permission denied',
        'You do not have permission to delete this scenario run',
      );
    });
  });

  it('shows the permission-denied message when deleteJob rejects with a 403 ApiError', async () => {
    vi.mocked(operatorApi.deleteJob).mockRejectedValueOnce(
      createApiError('Forbidden', 403, 'Forbidden'),
    );

    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByText('delete job'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        'Permission denied',
        'You do not have permission to delete this job',
      );
    });
  });

  it('shows the permission-denied message when deleteGraphRun rejects with a 403 ApiError', async () => {
    vi.mocked(graphRunsApi.deleteGraphRun).mockRejectedValueOnce(
      createApiError('Forbidden', 403, 'Forbidden'),
    );

    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByText('delete graph run'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        'Permission denied',
        'You do not have permission to delete this graph run',
      );
    });
  });

  it('does not treat a non-ApiError whose message mentions "403"/"forbidden" as a permission error', async () => {
    // Regression guard: this error has no numeric `.status`, so isApiError()
    // returns false. The old string-matching implementation would have
    // incorrectly classified this as a 403 permission error.
    vi.mocked(operatorApi.deleteScenarioRun).mockRejectedValueOnce(
      new Error('403 forbidden: unrelated server text'),
    );

    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByText('delete scenario run'));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        'Failed to delete scenario run',
        '403 forbidden: unrelated server text',
      );
    });

    expect(mockShowError).not.toHaveBeenCalledWith(
      'Permission denied',
      expect.any(String),
    );
  });
});
