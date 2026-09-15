import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Settings } from './Settings';
import { AppContext } from '../context/AppContext';
import { useRole } from '../hooks/useRole';
import { providersApi } from '../services/providersApi';
import type { AppState } from '../types/api';

vi.mock('../hooks/useRole');
vi.mock('../hooks/useProviderConfigPoller', () => ({
  useProviderConfigPoller: () => {},
}));
vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));
vi.mock('../services/providersApi');

describe('Settings - VisualizeInstallCard Authorization', () => {
  const mockDispatch = vi.fn();

  const baseState: AppState = {
    phase: 'configuring_scenario',
    uuid: 'test-uuid',
    selectedClusters: [],
    scenarios: null,
    scenarioDetail: null,
    scenarioFormValues: null,
    scenarioGlobals: null,
    globalFormValues: null,
    globalTouchedFields: null,
    selectedScenarios: null,
    selectedScenario: null,
    registryType: 'public',
    registryConfig: null,
    scenarioRuns: [],
    graphRuns: [],
    expandedGraphRunIds: new Set(),
    clusters: null,
    error: null,
    pollAttempts: 0,
    scenarioRunsRefreshTrigger: 0,
    pollingRunNames: new Set(),
    expandedRunIds: new Set(),
    expandedClusterJobs: new Set(),
    loadingRunDetails: new Set(),
    providers: null,
    providerConfigUuid: null,
    providerConfigStatus: 'idle',
    providerConfigData: null,
    rerunIntent: null,
    startInPreview: false,
    rerunScenarioImage: null,
    rerunKubeconfigPath: null,
    notifications: [],
  };

  const renderWithRole = (isAdmin: boolean) => {
    vi.mocked(useRole).mockReturnValue({ isAdmin } as any);
    vi.mocked(providersApi.listProviders).mockResolvedValue([]);

    return render(
      <AppContext.Provider value={{ state: baseState, dispatch: mockDispatch }}>
        <Settings />
      </AppContext.Provider>
    );
  };

  it('should render VisualizeInstallCard tab only when user is admin', () => {
    renderWithRole(true);

    // When admin, the krkn-visualize tab should be visible
    expect(screen.getByText('krkn-visualize')).toBeInTheDocument();
  });

  it('should NOT render VisualizeInstallCard tab when user is not admin', () => {
    renderWithRole(false);

    // When not admin, the krkn-visualize tab should not exist
    expect(screen.queryByText('krkn-visualize')).not.toBeInTheDocument();
  });

  it('should render other admin-only tabs only when user is admin', () => {
    renderWithRole(true);

    // Admin-only tabs
    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Registries')).toBeInTheDocument();
    expect(screen.getByText('Provider Configuration')).toBeInTheDocument();
  });

  it('should NOT render admin-only tabs when user is not admin', () => {
    renderWithRole(false);

    // Admin-only tabs should not exist
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
    expect(screen.queryByText('Registries')).not.toBeInTheDocument();
    expect(screen.queryByText('Provider Configuration')).not.toBeInTheDocument();
  });
});
