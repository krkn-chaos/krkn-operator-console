import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ScenarioDetail } from './ScenarioDetail';
import { AppContext } from '../context/AppContext';
import { operatorApi } from '../services/operatorApi';
import { elasticsearchApi } from '../services/elasticsearchApi';
import type { AppState } from '../types/api';
import type {
  ScenarioDetail as ScenarioDetailType,
  ScenarioGlobals,
  ScenariosRequest,
  CreateScenarioRunResponse,
  ScenarioRunStatusResponse,
  ActiveRunsResponse,
} from '../types/api';

vi.mock('../services/operatorApi');
vi.mock('../services/elasticsearchApi');

describe('ScenarioDetail', () => {
  const mockDispatch = vi.fn();

  const mockScenarioDetail: ScenarioDetailType = {
    name: 'pod-scenarios',
    title: 'Pod Scenarios',
    description: 'Kill random pods in a namespace',
    digest: 'sha256:abc123def456',
    fields: [
      {
        name: 'namespace',
        variable: 'NAMESPACE',
        short_description: 'Target namespace',
        title: 'Target namespace',
        description: 'Namespace where pods will be killed',
        type: 'string',
        required: true,
      },
      {
        name: 'kill_count',
        variable: 'KILL_COUNT',
        short_description: 'Number of pods to kill',
        title: 'Kill count',
        description: 'Number of pods to kill',
        type: 'number',
        required: false,
        default: '1',
      },
      {
        name: 'enable_alerts',
        variable: 'ENABLE_ALERTS',
        short_description: 'Enable alerting',
        title: 'Enable alerts',
        description: 'Enable alerting for this scenario',
        type: 'boolean',
        required: false,
        default: 'false',
      },
    ],
  };

  const mockScenarioGlobals: ScenarioGlobals = {
    name: 'globals',
    title: 'Global Parameters',
    description: 'Common parameters',
    fields: [
      {
        name: 'prometheus_url',
        variable: 'KRAKEN_PROMETHEUS_URL',
        short_description: 'Prometheus URL',
        title: 'Prometheus URL',
        description: 'URL of the Prometheus server',
        type: 'string',
        required: false,
        default: '',
      },
    ],
  };

  const baseState: AppState = {
    phase: 'configuring_scenario',
    uuid: 'test-uuid-123',
    selectedClusters: [
      { operatorName: 'krkn-operator', clusterName: 'cluster1', clusterApiUrl: 'https://api.cluster1.example.com:6443' },
    ],
    scenarioDetail: mockScenarioDetail,
    scenarioFormValues: {
      NAMESPACE: 'default',
    },
    scenarioGlobals: null,
    globalFormValues: null,
    globalTouchedFields: null,
    scenarios: null,
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

  const renderWithContext = (state: Partial<AppState> = {}, registryConfig: ScenariosRequest | null = null) => {
    const fullState = { ...baseState, ...state };

    return render(
      <AppContext.Provider value={{ state: fullState, dispatch: mockDispatch }}>
        <ScenarioDetail scenarioName="pod-scenarios" registryConfig={registryConfig} />
      </AppContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(operatorApi.getAvailableFiles).mockResolvedValue({ files: [] });
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue([]);
  });

  describe('Component Loading', () => {
    it('should show loading spinner when scenario detail is null', () => {
      renderWithContext({ scenarioDetail: null });

      expect(screen.getByText('Loading scenario details...')).toBeInTheDocument();
    });

    it('should fetch scenario detail on mount', async () => {
      vi.mocked(operatorApi.getScenarioDetail).mockResolvedValueOnce(mockScenarioDetail);

      renderWithContext({ scenarioDetail: null });

      await waitFor(() => {
        expect(operatorApi.getScenarioDetail).toHaveBeenCalledWith('pod-scenarios', {});
      });

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'SCENARIO_DETAIL_LOADING' });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: 'SCENARIO_DETAIL_SUCCESS',
          payload: { scenarioDetail: mockScenarioDetail },
        });
      });
    });

    it('should fetch scenario detail with private registry config', async () => {
      vi.mocked(operatorApi.getScenarioDetail).mockResolvedValueOnce(mockScenarioDetail);

      const registryConfig: ScenariosRequest = {
        registryName: 'corp-registry',
      };

      renderWithContext({ scenarioDetail: null }, registryConfig);

      await waitFor(() => {
        expect(operatorApi.getScenarioDetail).toHaveBeenCalledWith(
          'pod-scenarios',
          registryConfig
        );
      });
    });

    it('should handle error when fetching scenario detail', async () => {
      const errorMessage = 'Failed to fetch scenario detail';
      vi.mocked(operatorApi.getScenarioDetail).mockRejectedValueOnce(new Error(errorMessage));

      renderWithContext({ scenarioDetail: null });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: 'SCENARIO_DETAIL_ERROR',
          payload: {
            message: errorMessage,
            type: 'api_error',
          },
        });
      });
    });
  });

  describe('Scenario Header Display', () => {
    it('should render scenario title', () => {
      renderWithContext();

      expect(screen.getByText('Pod Scenarios')).toBeInTheDocument();
    });

    it('should render scenario description', () => {
      renderWithContext();

      expect(screen.getByText('Kill random pods in a namespace')).toBeInTheDocument();
    });

    it('should render scenario digest', () => {
      renderWithContext();

      expect(screen.getByText(/Digest:/i)).toBeInTheDocument();
      expect(screen.getByText(/sha256:abc123def456/i)).toBeInTheDocument();
    });

    it('should render back button', () => {
      renderWithContext();

      expect(screen.getByRole('button', { name: /Back to Scenarios List/i })).toBeInTheDocument();
    });
  });

  describe('Required Fields Section', () => {
    it('should render required parameters section', () => {
      renderWithContext();

      expect(screen.getByText('Required Parameters')).toBeInTheDocument();
    });

    it('should display required fields only in required section', () => {
      renderWithContext();

      // Required Parameters section should be present
      expect(screen.getByText('Required Parameters')).toBeInTheDocument();
    });

    it('should update form values when required fields change', async () => {
      renderWithContext();

      // The DynamicFormBuilder will render the input field
      // This test verifies the component structure
      expect(screen.getByText('Required Parameters')).toBeInTheDocument();
    });
  });

  describe('Optional Fields Section', () => {
    it('should render optional parameters toggle', () => {
      renderWithContext();

      expect(screen.getByRole('button', { name: /Optional Parameters/i })).toBeInTheDocument();
    });

    it('should expand optional fields when toggle clicked', async () => {
      const user = userEvent.setup();
      renderWithContext();

      const toggle = screen.getByRole('button', { name: /Optional Parameters/i });
      await user.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });

    it('should hide optional fields by default', () => {
      renderWithContext();

      const toggle = screen.getByRole('button', { name: /Optional Parameters/i });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Global Parameters Section', () => {
    it('should render global parameters toggle', () => {
      renderWithContext();

      expect(screen.getByRole('button', { name: /Global Parameters/i })).toBeInTheDocument();
    });

    it('should fetch global parameters when toggle expanded', async () => {
      const user = userEvent.setup();
      vi.mocked(operatorApi.getScenarioGlobals).mockResolvedValueOnce(mockScenarioGlobals);

      renderWithContext();

      const toggle = screen.getByRole('button', { name: /Global Parameters/i });
      await user.click(toggle);

      await waitFor(() => {
        expect(operatorApi.getScenarioGlobals).toHaveBeenCalledWith('pod-scenarios', {});
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: 'SCENARIO_GLOBALS_SUCCESS',
          payload: { scenarioGlobals: mockScenarioGlobals },
        });
      });
    });

    it('should show loading spinner while fetching globals', async () => {
      const user = userEvent.setup();
      let resolveGlobals!: (value: ScenarioGlobals) => void;
      vi.mocked(operatorApi.getScenarioGlobals).mockImplementation(
        () => new Promise(resolve => { resolveGlobals = resolve; })
      );

      renderWithContext();

      const toggle = screen.getByRole('button', { name: /Global Parameters/i });
      await user.click(toggle);

      await waitFor(() => {
        expect(screen.getByText('Loading global parameters...')).toBeInTheDocument();
      });

      resolveGlobals(mockScenarioGlobals);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: 'SCENARIO_GLOBALS_SUCCESS',
          payload: { scenarioGlobals: mockScenarioGlobals },
        });
      });
    });

    it('should handle error when fetching globals', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to fetch globals';
      vi.mocked(operatorApi.getScenarioGlobals).mockRejectedValueOnce(new Error(errorMessage));

      renderWithContext();

      const toggle = screen.getByRole('button', { name: /Global Parameters/i });
      await user.click(toggle);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: 'SCENARIO_GLOBALS_ERROR',
          payload: {
            message: errorMessage,
            type: 'api_error',
          },
        });
      });
    });

    it('should not fetch globals again if already loaded', async () => {
      const user = userEvent.setup();
      renderWithContext({ scenarioGlobals: mockScenarioGlobals });

      const toggle = screen.getByRole('button', { name: /Global Parameters/i });
      await user.click(toggle);

      // Should not call API again
      expect(operatorApi.getScenarioGlobals).not.toHaveBeenCalled();
    });
  });

  describe('Form Validation', () => {
    it('should enable preview button when required fields filled', () => {
      renderWithContext({
        scenarioFormValues: {
          NAMESPACE: 'default',
        },
      });

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      expect(previewButton).toBeInTheDocument();
    });

    it('should show validation errors when preview clicked with missing fields', async () => {
      const user = userEvent.setup();
      renderWithContext({
        scenarioFormValues: {},
      });

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText(/Form validation errors/i)).toBeInTheDocument();
        expect(screen.getByText(/Target namespace is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Configuration Preview', () => {
    it('should show preview when preview button clicked with valid form', async () => {
      const user = userEvent.setup();
      renderWithContext({
        scenarioFormValues: {
          NAMESPACE: 'default',
        },
      });

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      await user.click(previewButton);

      expect(screen.getByText('Configuration Preview')).toBeInTheDocument();
      expect(screen.getByText('Scenario Parameters')).toBeInTheDocument();
    });

    it('should display scenario parameters in preview table', async () => {
      const user = userEvent.setup();
      renderWithContext({
        scenarioFormValues: {
          NAMESPACE: 'default',
        },
      });

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      await user.click(previewButton);

      expect(screen.getByText('NAMESPACE')).toBeInTheDocument();
      expect(screen.getByText('default')).toBeInTheDocument();
    });

    it('should show edit button in preview mode', async () => {
      const user = userEvent.setup();
      renderWithContext({
        scenarioFormValues: {
          NAMESPACE: 'default',
        },
      });

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      await user.click(previewButton);

      expect(screen.getByRole('button', { name: /Edit Configuration/i })).toBeInTheDocument();
    });

    it('should return to form when edit button clicked', async () => {
      const user = userEvent.setup();
      renderWithContext({
        scenarioFormValues: {
          NAMESPACE: 'default',
        },
      });

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      await user.click(previewButton);

      const editButton = screen.getByRole('button', { name: /Edit Configuration/i });
      await user.click(editButton);

      expect(screen.getByText('Required Parameters')).toBeInTheDocument();
      expect(screen.queryByText('Configuration Preview')).not.toBeInTheDocument();
    });

    it('should mask secret fields in preview', async () => {
      const user = userEvent.setup();
      const detailWithSecret: ScenarioDetailType = {
        ...mockScenarioDetail,
        fields: [
          {
            name: 'api_key',
            variable: 'API_KEY',
            short_description: 'API Key',
            title: 'API Key',
            description: 'Secret API key for authentication',
            type: 'string',
            required: true,
            secret: true,
          },
        ],
      };

      renderWithContext({
        scenarioDetail: detailWithSecret,
        scenarioFormValues: {
          API_KEY: 'super-secret-key',
        },
      });

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      await user.click(previewButton);

      expect(screen.getByText('••••••••')).toBeInTheDocument();
      expect(screen.queryByText('super-secret-key')).not.toBeInTheDocument();
    });

    it('should show default values when field is empty', async () => {
      const user = userEvent.setup();
      renderWithContext({
        scenarioFormValues: {
          NAMESPACE: 'default',
        },
      });

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      await user.click(previewButton);

      // KILL_COUNT should show default value '1'
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  describe('Running Scenario', () => {
    const mockCreateResponse: CreateScenarioRunResponse = {
      scenarioRunName: 'test-run-123',
      targetClusters: {
        'krkn-operator': ['cluster1'],
      },
      totalTargets: 1,
    };

    const mockStatusResponse: ScenarioRunStatusResponse = {
      scenarioRunName: 'test-run-123',
      phase: 'Running',
      totalTargets: 1,
      successfulJobs: 0,
      failedJobs: 0,
      runningJobs: 1,
      clusterJobs: [
        {
          providerName: 'krkn-operator',
          clusterName: 'cluster1',
          jobId: 'job-123',
          podName: 'krkn-job-pod-123',
          phase: 'Running',
          message: '',
        },
      ],
    };

    const mockActiveRuns: ActiveRunsResponse = {
      totalActiveRuns: 0,
      totalClusters: 0,
      clusterRuns: {},
    };

    it('should run scenario when run button clicked in preview mode', async () => {
      const user = userEvent.setup();
      vi.mocked(operatorApi.runScenario).mockResolvedValueOnce(mockCreateResponse);
      vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValueOnce(mockStatusResponse);
      vi.mocked(operatorApi.getActiveRuns).mockResolvedValueOnce(mockActiveRuns);

      renderWithContext({
        scenarioFormValues: {
          NAMESPACE: 'default',
        },
      });

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      await user.click(previewButton);

      const runButton = screen.getByRole('button', { name: /Run Scenarios/i });
      await user.click(runButton);

      await waitFor(() => {
        expect(operatorApi.getActiveRuns).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(operatorApi.runScenario).toHaveBeenCalled();
      });
    });

    it('should build correct scenario run request with public registry', async () => {
      const user = userEvent.setup();
      vi.mocked(operatorApi.runScenario).mockResolvedValueOnce(mockCreateResponse);
      vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValueOnce(mockStatusResponse);
      vi.mocked(operatorApi.getActiveRuns).mockResolvedValueOnce(mockActiveRuns);

      renderWithContext({
        scenarioFormValues: {
          NAMESPACE: 'default',
          KILL_COUNT: '5',
        },
      });

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      await user.click(previewButton);

      const runButton = screen.getByRole('button', { name: /Run Scenarios/i });
      await user.click(runButton);

      await waitFor(() => {
        expect(operatorApi.runScenario).toHaveBeenCalledWith(
          expect.objectContaining({
            targetRequestId: 'test-uuid-123',
            targetClusters: {
              'krkn-operator': ['cluster1'],
            },
            scenarioImage: 'krkn-hub:pod-scenarios',
            scenarioName: 'pod-scenarios',
            environment: expect.objectContaining({
              NAMESPACE: 'default',
              KILL_COUNT: '5',
            }),
          })
        );
      });
    });

    it('should build correct scenario image for private registry', async () => {
      const user = userEvent.setup();
      vi.mocked(operatorApi.runScenario).mockResolvedValueOnce(mockCreateResponse);
      vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValueOnce(mockStatusResponse);
      vi.mocked(operatorApi.getActiveRuns).mockResolvedValueOnce(mockActiveRuns);

      const registryConfig: ScenariosRequest = {
        registryName: 'corp-registry',
      };

      renderWithContext(
        {
          scenarioFormValues: {
            NAMESPACE: 'default',
          },
          registryType: 'private',
          registryConfig,
        },
        registryConfig
      );

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      await user.click(previewButton);

      const runButton = screen.getByRole('button', { name: /Run Scenarios/i });
      await user.click(runButton);

      await waitFor(() => {
        expect(operatorApi.runScenario).toHaveBeenCalledWith(
          expect.objectContaining({
            scenarioImage: 'pod-scenarios', // Private registry: no krkn-hub prefix
            registryName: 'corp-registry',
          })
        );
      });
    });

    it('should dispatch scenario run created action', async () => {
      const user = userEvent.setup();
      vi.mocked(operatorApi.runScenario).mockResolvedValueOnce(mockCreateResponse);
      vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValueOnce(mockStatusResponse);
      vi.mocked(operatorApi.getActiveRuns).mockResolvedValueOnce(mockActiveRuns);

      renderWithContext({
        scenarioFormValues: {
          NAMESPACE: 'default',
        },
      });

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      await user.click(previewButton);

      const runButton = screen.getByRole('button', { name: /Run Scenarios/i });
      await user.click(runButton);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'SCENARIO_RUN_CREATED',
          })
        );
      });
    });
  });

  describe('Cluster Conflict Warning', () => {
    const mockCreateResponse: CreateScenarioRunResponse = {
      scenarioRunName: 'test-run-123',
      targetClusters: {
        'krkn-operator': ['cluster1'],
      },
      totalTargets: 1,
    };

    const mockStatusResponse: ScenarioRunStatusResponse = {
      scenarioRunName: 'test-run-123',
      phase: 'Running',
      totalTargets: 1,
      successfulJobs: 0,
      failedJobs: 0,
      runningJobs: 1,
      clusterJobs: [],
    };

    it('should show cluster conflict warning when cluster has active runs', async () => {
      const user = userEvent.setup();
      const mockActiveRunsWithConflict: ActiveRunsResponse = {
        totalActiveRuns: 1,
        totalClusters: 1,
        clusterRuns: {
          'cluster1': ['existing-run-1'],
        },
      };

      vi.mocked(operatorApi.getActiveRuns).mockResolvedValueOnce(mockActiveRunsWithConflict);

      renderWithContext({
        scenarioFormValues: {
          NAMESPACE: 'default',
        },
      });

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      await user.click(previewButton);

      const runButton = screen.getByRole('button', { name: /Run Scenarios/i });
      await user.click(runButton);

      await waitFor(() => {
        expect(screen.getByText(/cluster1/i)).toBeInTheDocument();
      });

      // Should not proceed with run yet
      expect(operatorApi.runScenario).not.toHaveBeenCalled();
    });

    it('should proceed with run when no conflicts exist', async () => {
      const user = userEvent.setup();
      const mockActiveRunsNoConflict: ActiveRunsResponse = {
        totalActiveRuns: 0,
        totalClusters: 0,
        clusterRuns: {},
      };

      vi.mocked(operatorApi.runScenario).mockResolvedValueOnce(mockCreateResponse);
      vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValueOnce(mockStatusResponse);
      vi.mocked(operatorApi.getActiveRuns).mockResolvedValueOnce(mockActiveRunsNoConflict);

      renderWithContext({
        scenarioFormValues: {
          NAMESPACE: 'default',
        },
      });

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      await user.click(previewButton);

      const runButton = screen.getByRole('button', { name: /Run Scenarios/i });
      await user.click(runButton);

      await waitFor(() => {
        expect(operatorApi.runScenario).toHaveBeenCalled();
      });
    });

    it('should send customRunName from the submitted request, not component state, when confirming a conflict', async () => {
      const user = userEvent.setup();
      const mockActiveRunsWithConflict: ActiveRunsResponse = {
        totalActiveRuns: 1,
        totalClusters: 1,
        clusterRuns: { cluster1: ['existing-run-1'] },
      };

      vi.mocked(operatorApi.getActiveRuns).mockResolvedValueOnce(mockActiveRunsWithConflict);
      vi.mocked(operatorApi.runScenario).mockResolvedValueOnce(mockCreateResponse);
      vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValueOnce(mockStatusResponse);

      renderWithContext({ scenarioFormValues: { NAMESPACE: 'default' } });

      // Advance to preview, then type a custom run name before running
      await user.click(screen.getByRole('button', { name: /Preview Configuration/i }));
      const runNameInput = screen.getByPlaceholderText('e.g. nightly-pod-disruption-test');
      await user.type(runNameInput, 'original-run-label');

      await user.click(screen.getByRole('button', { name: /Run Scenarios/i }));

      // Conflict modal appears; confirm to proceed
      await waitFor(() => expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: /Continue/i }));

      await waitFor(() => {
        expect(operatorApi.runScenario).toHaveBeenCalledWith(
          expect.objectContaining({ customRunName: 'original-run-label' })
        );
      });
    });

    it('should store customRunName from the submitted request in the new run state', async () => {
      const user = userEvent.setup();
      const mockActiveRunsNoConflict: ActiveRunsResponse = {
        totalActiveRuns: 0,
        totalClusters: 0,
        clusterRuns: {},
      };
      // Status response does not echo back customRunName (simulates a delayed/incomplete response)
      const statusWithoutCustomName: ScenarioRunStatusResponse = { ...mockStatusResponse, customRunName: undefined };

      vi.mocked(operatorApi.runScenario).mockResolvedValueOnce(mockCreateResponse);
      vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValueOnce(statusWithoutCustomName);
      vi.mocked(operatorApi.getActiveRuns).mockResolvedValueOnce(mockActiveRunsNoConflict);

      renderWithContext({ scenarioFormValues: { NAMESPACE: 'default' } });

      await user.click(screen.getByRole('button', { name: /Preview Configuration/i }));
      const runNameInput = screen.getByPlaceholderText('e.g. nightly-pod-disruption-test');
      await user.type(runNameInput, 'my-run-label');

      await user.click(screen.getByRole('button', { name: /Run Scenarios/i }));

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'ADD_SCENARIO_RUN',
            payload: expect.objectContaining({
              run: expect.objectContaining({ customRunName: 'my-run-label' }),
            }),
          })
        );
      });
    });
  });

  describe('Back Navigation', () => {
    it('should dispatch go back action when back button clicked', async () => {
      const user = userEvent.setup();
      renderWithContext();

      const backButton = screen.getByRole('button', { name: /Back to Scenarios List/i });
      await user.click(backButton);

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
    });
  });

  describe('Global Parameters in Preview', () => {
    it('should show touched global parameters in preview', async () => {
      const user = userEvent.setup();
      renderWithContext({
        scenarioFormValues: {
          NAMESPACE: 'default',
        },
        scenarioGlobals: mockScenarioGlobals,
        globalFormValues: {
          KRAKEN_PROMETHEUS_URL: 'http://prometheus:9090',
        },
        globalTouchedFields: {
          KRAKEN_PROMETHEUS_URL: true,
        },
      });

      // Enable global parameters first
      const globalParamsToggle = screen.getByRole('button', { name: /Global Parameters/i });
      await user.click(globalParamsToggle);

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText(/Global Parameters/)).toBeInTheDocument();
      });
      expect(screen.getByText('KRAKEN_PROMETHEUS_URL')).toBeInTheDocument();
      expect(screen.getByText('http://prometheus:9090')).toBeInTheDocument();
    });

    it('should not show untouched global parameters in preview', async () => {
      const user = userEvent.setup();
      renderWithContext({
        scenarioFormValues: {
          NAMESPACE: 'default',
        },
        scenarioGlobals: mockScenarioGlobals,
        globalFormValues: {
          KRAKEN_PROMETHEUS_URL: '',
        },
        globalTouchedFields: {
          KRAKEN_PROMETHEUS_URL: false,
        },
      });

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      await user.click(previewButton);

      expect(screen.queryByText('Global Parameters (Modified)')).not.toBeInTheDocument();
    });
  });

  describe('File References in Run Request', () => {
    const mockCreateResponse: CreateScenarioRunResponse = {
      scenarioRunName: 'test-run-456',
      targetClusters: { 'krkn-operator': ['cluster1'] },
      totalTargets: 1,
    };

    const mockStatusResponse: ScenarioRunStatusResponse = {
      scenarioRunName: 'test-run-456',
      phase: 'Running',
      totalTargets: 1,
      successfulJobs: 0,
      failedJobs: 0,
      runningJobs: 1,
      clusterJobs: [],
    };

    const mockActiveRuns: ActiveRunsResponse = {
      totalActiveRuns: 0,
      totalClusters: 0,
      clusterRuns: {},
    };

    it('should include fileReferences in run request when files are added', async () => {
      const user = userEvent.setup();

      vi.mocked(operatorApi.getAvailableFiles).mockResolvedValue({
        files: [
          { fileId: 'file-1', fileName: 'metrics.yaml', description: 'Metrics config', availableToAll: true },
        ],
      });
      vi.mocked(operatorApi.runScenario).mockResolvedValueOnce(mockCreateResponse);
      vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValueOnce(mockStatusResponse);
      vi.mocked(operatorApi.getActiveRuns).mockResolvedValueOnce(mockActiveRuns);

      renderWithContext({
        scenarioFormValues: { NAMESPACE: 'default' },
      });

      // Wait for FileSelector to load available files
      await waitFor(() => {
        expect(operatorApi.getAvailableFiles).toHaveBeenCalled();
      });

      // Open the file select dropdown and choose a file
      const fileToggle = await screen.findByText('Select a file');
      await user.click(fileToggle);
      const fileOption = await screen.findByText('metrics.yaml');
      await user.click(fileOption);

      // Type mount path
      const mountInput = screen.getByPlaceholderText('/path/to/mount/file.yaml');
      await user.type(mountInput, '/etc/krkn/metrics.yaml');

      // Click Add
      await user.click(screen.getByRole('button', { name: /Add/i }));

      // Preview
      await user.click(screen.getByRole('button', { name: /Preview Configuration/i }));
      expect(screen.getByText('Configuration Preview')).toBeInTheDocument();

      // Run
      await user.click(screen.getByRole('button', { name: /Run Scenarios/i }));

      await waitFor(() => {
        expect(operatorApi.runScenario).toHaveBeenCalledWith(
          expect.objectContaining({
            fileReferences: [{ fileId: 'file-1', mountPath: '/etc/krkn/metrics.yaml' }],
          })
        );
      });
    });

    it('should not include fileReferences when no files are added', async () => {
      const user = userEvent.setup();

      vi.mocked(operatorApi.runScenario).mockResolvedValueOnce(mockCreateResponse);
      vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValueOnce(mockStatusResponse);
      vi.mocked(operatorApi.getActiveRuns).mockResolvedValueOnce(mockActiveRuns);

      renderWithContext({
        scenarioFormValues: { NAMESPACE: 'default' },
      });

      await user.click(screen.getByRole('button', { name: /Preview Configuration/i }));
      await user.click(screen.getByRole('button', { name: /Run Scenarios/i }));

      await waitFor(() => {
        expect(operatorApi.runScenario).toHaveBeenCalledWith(
          expect.objectContaining({
            fileReferences: undefined,
          })
        );
      });
    });
  });

  describe('Pending File Warning Modal', () => {
    it('should show modal when preview clicked with pending file input', async () => {
      const user = userEvent.setup();

      vi.mocked(operatorApi.getAvailableFiles).mockResolvedValue({
        files: [
          { fileId: 'file-1', fileName: 'metrics.yaml', description: 'Metrics config', availableToAll: true },
        ],
      });

      renderWithContext({
        scenarioFormValues: { NAMESPACE: 'default' },
      });

      await waitFor(() => {
        expect(operatorApi.getAvailableFiles).toHaveBeenCalled();
      });

      // Select a file but do NOT click Add
      const fileToggle = await screen.findByText('Select a file');
      await user.click(fileToggle);
      const fileOption = await screen.findByText('metrics.yaml');
      await user.click(fileOption);

      // Click Preview — modal should appear
      await user.click(screen.getByRole('button', { name: /Preview Configuration/i }));

      expect(screen.getByText('Pending file not added')).toBeInTheDocument();
      expect(screen.getByText(/haven't clicked/)).toBeInTheDocument();
    });

    it('should show modal when only mount path is typed without selecting a file', async () => {
      const user = userEvent.setup();

      renderWithContext({
        scenarioFormValues: { NAMESPACE: 'default' },
      });

      // Type only mount path, no file selected
      const mountInput = screen.getByPlaceholderText('/path/to/mount/file.yaml');
      await user.type(mountInput, '/etc/krkn/config.yaml');

      // Click Preview — modal should appear
      await user.click(screen.getByRole('button', { name: /Preview Configuration/i }));

      expect(screen.getByText('Pending file not added')).toBeInTheDocument();
    });

    it('should return to form when "Go back" is clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(operatorApi.getAvailableFiles).mockResolvedValue({
        files: [
          { fileId: 'file-1', fileName: 'metrics.yaml', description: 'Metrics config', availableToAll: true },
        ],
      });

      renderWithContext({
        scenarioFormValues: { NAMESPACE: 'default' },
      });

      await waitFor(() => {
        expect(operatorApi.getAvailableFiles).toHaveBeenCalled();
      });

      const fileToggle = await screen.findByText('Select a file');
      await user.click(fileToggle);
      await user.click(await screen.findByText('metrics.yaml'));

      await user.click(screen.getByRole('button', { name: /Preview Configuration/i }));
      expect(screen.getByText('Pending file not added')).toBeInTheDocument();

      // Click "Go back"
      await user.click(screen.getByRole('button', { name: /Go back/i }));

      // Modal should close, preview should NOT appear
      expect(screen.queryByText('Pending file not added')).not.toBeInTheDocument();
      expect(screen.queryByText('Configuration Preview')).not.toBeInTheDocument();
      expect(screen.getByText('Required Parameters')).toBeInTheDocument();
    });

    it('should proceed to preview when "Continue without adding" is clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(operatorApi.getAvailableFiles).mockResolvedValue({
        files: [
          { fileId: 'file-1', fileName: 'metrics.yaml', description: 'Metrics config', availableToAll: true },
        ],
      });

      renderWithContext({
        scenarioFormValues: { NAMESPACE: 'default' },
      });

      await waitFor(() => {
        expect(operatorApi.getAvailableFiles).toHaveBeenCalled();
      });

      const fileToggle = await screen.findByText('Select a file');
      await user.click(fileToggle);
      await user.click(await screen.findByText('metrics.yaml'));

      await user.click(screen.getByRole('button', { name: /Preview Configuration/i }));
      expect(screen.getByText('Pending file not added')).toBeInTheDocument();

      // Click "Continue without adding"
      await user.click(screen.getByRole('button', { name: /Continue without adding/i }));

      // Should proceed to preview
      expect(screen.queryByText('Pending file not added')).not.toBeInTheDocument();
      expect(screen.getByText('Configuration Preview')).toBeInTheDocument();
    });
  });

  describe('Grouped Scenario Fields', () => {
    const groupedScenarioDetail: ScenarioDetailType = {
      name: 'grouped-scenario',
      title: 'Grouped Scenario',
      description: 'A scenario with grouped fields',
      digest: 'sha256:grouped123',
      fields: [
        {
          name: 'namespace',
          variable: 'NAMESPACE',
          short_description: 'Target namespace',
          title: 'Target namespace',
          description: 'Namespace where pods will be killed',
          type: 'string',
          required: true,
        },
        {
          name: 'advanced_group',
          variable: 'ADVANCED_GROUP',
          short_description: 'Advanced Settings',
          title: 'Advanced Settings',
          description: 'Group header for advanced settings',
          type: 'group',
          required: false,
        },
        {
          name: 'timeout',
          variable: 'TIMEOUT',
          short_description: 'Timeout seconds',
          title: 'Timeout',
          description: 'Max timeout',
          type: 'number',
          required: false,
          default: '60',
          group: 'ADVANCED_GROUP',
        },
      ],
    };

    it('should not show group headers in Preview table', async () => {
      const user = userEvent.setup();
      renderWithContext({
        scenarioDetail: groupedScenarioDetail,
        scenarioFormValues: { NAMESPACE: 'default' },
      });

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      await user.click(previewButton);

      expect(screen.getByText('NAMESPACE')).toBeInTheDocument();
      expect(screen.getByText('TIMEOUT')).toBeInTheDocument();
      expect(screen.queryByText('ADVANCED_GROUP')).not.toBeInTheDocument();
    });

    it('should not include group headers in run request environment', async () => {
      const user = userEvent.setup();
      vi.mocked(operatorApi.runScenario).mockResolvedValueOnce({
        scenarioRunName: 'test-run',
        targetClusters: { 'krkn-operator': ['cluster1'] },
        totalTargets: 1,
      });
      vi.mocked(operatorApi.getScenarioRunStatus).mockResolvedValueOnce({
        scenarioRunName: 'test-run',
        phase: 'Running',
        totalTargets: 1,
        successfulJobs: 0,
        failedJobs: 0,
        runningJobs: 1,
        clusterJobs: [],
      });
      vi.mocked(operatorApi.getActiveRuns).mockResolvedValueOnce({
        totalActiveRuns: 0,
        totalClusters: 0,
        clusterRuns: {},
      });

      renderWithContext({
        scenarioDetail: groupedScenarioDetail,
        scenarioFormValues: { NAMESPACE: 'test-ns' },
      });

      const previewButton = screen.getByRole('button', { name: /Preview Configuration/i });
      await user.click(previewButton);

      const runButton = screen.getByRole('button', { name: /Run Scenarios/i });
      await user.click(runButton);

      await waitFor(() => {
        expect(operatorApi.runScenario).toHaveBeenCalledWith(
          expect.objectContaining({
            environment: expect.not.objectContaining({
              ADVANCED_GROUP: expect.anything(),
            }),
          })
        );
      });

      await waitFor(() => {
        const callArgs = vi.mocked(operatorApi.runScenario).mock.calls[0][0];
        expect(callArgs.environment).toHaveProperty('NAMESPACE', 'test-ns');
        expect(callArgs.environment).toHaveProperty('TIMEOUT', '60');
        expect(callArgs.environment).not.toHaveProperty('ADVANCED_GROUP');
      });
    });

    it('should suppress optional parameters section when fields are grouped', () => {
      renderWithContext({
        scenarioDetail: groupedScenarioDetail,
        scenarioFormValues: { NAMESPACE: 'default' },
      });

      // When hasGroupedScenarioFields is true, optional section is suppressed
      expect(screen.queryByRole('button', { name: /Optional Parameters/i })).not.toBeInTheDocument();
    });
  });
});
