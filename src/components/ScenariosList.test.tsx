import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ScenariosList } from './ScenariosList';
import { AppContext } from '../context/AppContext';
import type { AppState, Scenario } from '../types/api';

vi.mock('../hooks', () => ({
  useNotifications: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

describe('ScenariosList', () => {
  const mockDispatch = vi.fn();

  const mockScenarios: Scenario[] = [
    {
      name: 'pod-scenarios',
      title: 'Pod Scenarios',
      description: 'Kill random pods',
      tags: [
        { name: 'category', value: 'kubernetes' },
        { name: 'component', value: 'pods' },
      ],
      digest: 'sha256:abc123',
      size: 1024 * 512,
      last_updated: '2024-01-15T10:30:00Z',
    },
    {
      name: 'node-scenarios',
      title: 'Node Scenarios',
      description: 'Drain or cordon nodes',
      tags: [
        { name: 'category', value: 'kubernetes' },
        { name: 'component', value: 'nodes' },
      ],
      digest: 'sha256:def456',
      size: 1024 * 768,
      last_updated: '2024-01-20T14:45:00Z',
    },
  ];

  const baseState: AppState = {
    phase: 'selecting_scenario',
    uuid: 'test-uuid-123',
    selectedClusters: [
      { operatorName: 'krkn-operator', clusterName: 'cluster1', clusterApiUrl: 'https://api.cluster1.example.com:6443' },
    ],
    scenarios: mockScenarios,
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

  const renderWithContext = (state: Partial<AppState> = {}) => {
    const fullState = { ...baseState, ...state };

    return render(
      <AppContext.Provider value={{ state: fullState, dispatch: mockDispatch }}>
        <ScenariosList />
      </AppContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cancellation flow', () => {
    it('should open cancel confirmation modal when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithContext();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Modal should be visible
      expect(screen.getByText(/Are you sure you want to cancel/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /yes, cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /no, go back/i })).toBeInTheDocument();
    });

    it('should close modal when "No, go back" is clicked', async () => {
      const user = userEvent.setup();
      renderWithContext();

      // Open modal
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.getByText(/Are you sure you want to cancel/i)).toBeInTheDocument();

      // Dismiss modal
      const dismissButton = screen.getByRole('button', { name: /no, go back/i });
      await user.click(dismissButton);

      // Modal should be closed (text no longer in document)
      expect(screen.queryByText(/Are you sure you want to cancel/i)).not.toBeInTheDocument();

      // CANCEL_WORKFLOW should NOT be dispatched
      expect(mockDispatch).not.toHaveBeenCalledWith({ type: 'CANCEL_WORKFLOW' });
    });

    it('should dispatch CANCEL_WORKFLOW when "Yes, cancel" is clicked', async () => {
      const user = userEvent.setup();
      renderWithContext();

      // Open modal
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.getByText(/Are you sure you want to cancel/i)).toBeInTheDocument();

      // Confirm cancellation
      const confirmButton = screen.getByRole('button', { name: /yes, cancel/i });
      await user.click(confirmButton);

      // CANCEL_WORKFLOW should be dispatched
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'CANCEL_WORKFLOW' });

      // Modal should be closed
      expect(screen.queryByText(/Are you sure you want to cancel/i)).not.toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should render empty state when no scenarios are available', () => {
      renderWithContext({ scenarios: [] });

      expect(screen.getByText('No Scenarios Found')).toBeInTheDocument();
      expect(screen.getByText(/No chaos scenarios were found in the registry/i)).toBeInTheDocument();
    });

    it('should render empty state when scenarios is null', () => {
      renderWithContext({ scenarios: null });

      expect(screen.getByText('No Scenarios Found')).toBeInTheDocument();
    });
  });

  describe('Scenario list rendering', () => {
    it('should render all scenarios', () => {
      renderWithContext();

      expect(screen.getByText('Pod Scenarios')).toBeInTheDocument();
      expect(screen.getByText('Node Scenarios')).toBeInTheDocument();
    });

    it('should have Configure button for each scenario', () => {
      renderWithContext();

      const configureButtons = screen.getAllByRole('button', { name: /configure/i });
      expect(configureButtons).toHaveLength(mockScenarios.length);
    });

    it('should dispatch SELECT_SCENARIO_FOR_DETAIL when Configure is clicked', async () => {
      const user = userEvent.setup();
      renderWithContext();

      const configureButtons = screen.getAllByRole('button', { name: /configure/i });
      await user.click(configureButtons[0]);

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SELECT_SCENARIO_FOR_DETAIL',
        payload: { scenarioName: 'pod-scenarios' },
      });
    });
  });
});
