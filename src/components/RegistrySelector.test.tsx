import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { RegistrySelector } from './RegistrySelector';
import { AppContext } from '../context/AppContext';
import { operatorApi } from '../services/operatorApi';
import { registriesApi } from '../services/registriesApi';
import type { AppState } from '../types/api';
import type { ScenariosResponse, AvailableRegistry } from '../types/api';

vi.mock('../services/operatorApi');
vi.mock('../services/registriesApi');

describe('RegistrySelector', () => {
  const mockDispatch = vi.fn();

  const initialState: AppState = {
    phase: 'configuring_registry',
    uuid: null,
    pollAttempts: 0,
    scenarioRuns: [],
    scenarioRunsRefreshTrigger: 0,
    scenarioRunToRefresh: null,
    pollingRunNames: new Set(),
    pausedPollingRunIds: new Set(),
    expandedRunIds: new Set(),
    expandedClusterJobs: new Set(),
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
    error: null,
    providers: null,
    providerConfigUuid: null,
    providerConfigStatus: 'idle',
    providerConfigData: null,
    notifications: [],
  };

  const mockRegistries: AvailableRegistry[] = [
    {
      name: 'corp-registry',
      registryUrl: 'registry.corp.com',
      scenarioRepository: 'chaos/scenarios',
      description: 'Corporate registry for chaos scenarios',
    },
    {
      name: 'dev-registry',
      registryUrl: 'https://dev.registry.io',
      scenarioRepository: 'dev/krkn',
      description: 'Development registry',
    },
  ];

  const renderWithContext = (state: Partial<AppState> = {}) => {
    const fullState = { ...initialState, ...state };
    return render(
      <AppContext.Provider value={{ state: fullState, dispatch: mockDispatch }}>
        <RegistrySelector />
      </AppContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: return empty registries list
    vi.mocked(registriesApi.getAvailableRegistries).mockResolvedValue([]);
  });

  describe('Initial Rendering', () => {
    it('should render the registry configuration card', async () => {
      renderWithContext();
      expect(screen.getByText('Configure Chaos Scenarios Registry')).toBeInTheDocument();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });
    });

    it('should render public registry option by default', async () => {
      renderWithContext();
      const publicRadio = screen.getByLabelText(/Public Registry/i);
      expect(publicRadio).toBeInTheDocument();
      expect(publicRadio).toBeChecked();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });
    });

    it('should render private registry option', async () => {
      renderWithContext();
      const privateRadio = screen.getByLabelText(/Private Registry/i);
      expect(privateRadio).toBeInTheDocument();
      expect(privateRadio).not.toBeChecked();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });
    });

    it('should render load scenarios button', async () => {
      renderWithContext();
      expect(screen.getByRole('button', { name: /Load Scenarios/i })).toBeInTheDocument();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });
    });

    it('should render cancel button', async () => {
      renderWithContext();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });
    });

    it('should fetch available registries on mount', async () => {
      vi.mocked(registriesApi.getAvailableRegistries).mockResolvedValue(mockRegistries);
      renderWithContext();

      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Public Registry Selection', () => {
    it('should enable load button for public registry without extra fields', async () => {
      renderWithContext();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      expect(loadButton).not.toBeDisabled();
    });

    it('should load scenarios from public registry', async () => {
      const user = userEvent.setup();
      const mockResponse: ScenariosResponse = {
        scenarios: [
          { name: 'pod-scenarios', digest: 'sha256:abc123' },
        ],
      };

      vi.mocked(operatorApi.getScenarios).mockResolvedValueOnce(mockResponse);

      renderWithContext();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      await user.click(loadButton);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: 'REGISTRY_CONFIGURED',
          payload: {
            registryType: 'public',
            registryConfig: {},
          },
        });
      });

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'SCENARIOS_LOADING' });
      expect(operatorApi.getScenarios).toHaveBeenCalledWith({});

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: 'SCENARIOS_SUCCESS',
          payload: { scenarios: mockResponse.scenarios },
        });
      });
    });

    it('should handle API errors when loading public registry scenarios', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to connect to registry';

      vi.mocked(operatorApi.getScenarios).mockRejectedValueOnce(new Error(errorMessage));

      renderWithContext();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      await user.click(loadButton);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: 'SCENARIOS_ERROR',
          payload: {
            message: errorMessage,
            type: 'api_error',
          },
        });
      });
    });
  });

  describe('Private Registry Selection', () => {
    it('should show registry dropdown when private option selected and registries available', async () => {
      const user = userEvent.setup();
      vi.mocked(registriesApi.getAvailableRegistries).mockResolvedValue(mockRegistries);

      renderWithContext();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      expect(screen.getByLabelText('Select private registry')).toBeInTheDocument();
    });

    it('should show empty state when no registries configured', async () => {
      const user = userEvent.setup();
      vi.mocked(registriesApi.getAvailableRegistries).mockResolvedValue([]);

      renderWithContext();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      expect(screen.getByText('No private registries configured')).toBeInTheDocument();
      expect(screen.getByText(/Ask your administrator to configure/i)).toBeInTheDocument();
    });

    it('should auto-select first registry when available', async () => {
      vi.mocked(registriesApi.getAvailableRegistries).mockResolvedValue(mockRegistries);

      renderWithContext();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });

      const user = userEvent.setup();
      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      const select = screen.getByLabelText('Select private registry') as HTMLSelectElement;
      expect(select.value).toBe('corp-registry');
    });

    it('should load scenarios from selected private registry', async () => {
      const user = userEvent.setup();
      const mockResponse: ScenariosResponse = {
        scenarios: [
          { name: 'custom-scenario', digest: 'sha256:custom' },
        ],
      };

      vi.mocked(registriesApi.getAvailableRegistries).mockResolvedValue(mockRegistries);
      vi.mocked(operatorApi.getScenarios).mockResolvedValueOnce(mockResponse);

      renderWithContext();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      await user.click(loadButton);

      await waitFor(() => {
        expect(operatorApi.getScenarios).toHaveBeenCalledWith({
          registryName: 'corp-registry',
        });
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: 'SCENARIOS_SUCCESS',
          payload: { scenarios: mockResponse.scenarios },
        });
      });
    });

    it('should allow selecting different registry from dropdown', async () => {
      const user = userEvent.setup();
      vi.mocked(registriesApi.getAvailableRegistries).mockResolvedValue(mockRegistries);
      vi.mocked(operatorApi.getScenarios).mockResolvedValue({ scenarios: [] });

      renderWithContext();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      const select = screen.getByLabelText('Select private registry');
      await user.selectOptions(select, 'dev-registry');

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      await user.click(loadButton);

      await waitFor(() => {
        expect(operatorApi.getScenarios).toHaveBeenCalledWith({
          registryName: 'dev-registry',
        });
      });
    });

    it('should show loading spinner while fetching registries', async () => {
      vi.mocked(registriesApi.getAvailableRegistries).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockRegistries), 100))
      );

      renderWithContext();

      const user = userEvent.setup();
      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      expect(screen.getByText('Loading available registries...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Loading available registries...')).not.toBeInTheDocument();
      });
    });

    it('should show error when fetching registries fails', async () => {
      const user = userEvent.setup();
      vi.mocked(registriesApi.getAvailableRegistries).mockRejectedValue(
        new Error('Network error')
      );

      renderWithContext();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      expect(screen.getByText('Failed to load registries')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should disable load button when private selected but no registries available', async () => {
      const user = userEvent.setup();
      vi.mocked(registriesApi.getAvailableRegistries).mockResolvedValue([]);

      renderWithContext();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      expect(loadButton).toBeDisabled();
    });

    it('should disable load button while loading registries', async () => {
      const user = userEvent.setup();
      vi.mocked(registriesApi.getAvailableRegistries).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockRegistries), 100))
      );

      renderWithContext();

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      expect(loadButton).toBeDisabled();

      await waitFor(() => {
        expect(loadButton).not.toBeDisabled();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state while fetching scenarios', async () => {
      const user = userEvent.setup();
      vi.mocked(operatorApi.getScenarios).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ scenarios: [] }), 100))
      );

      renderWithContext();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      await user.click(loadButton);

      expect(screen.getByRole('button', { name: /Loading Scenarios/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Loading Scenarios/i })).toBeDisabled();

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: 'SCENARIOS_SUCCESS',
          payload: { scenarios: [] },
        });
      });
    });

    it('should disable load button while loading', async () => {
      const user = userEvent.setup();
      vi.mocked(operatorApi.getScenarios).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ scenarios: [] }), 100))
      );

      renderWithContext();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      await user.click(loadButton);

      const loadingButton = screen.getByRole('button', { name: /Loading Scenarios/i });
      expect(loadingButton).toBeDisabled();
    });
  });

  describe('Cancel Workflow', () => {
    it('should dispatch cancel action when cancel button clicked', async () => {
      const user = userEvent.setup();
      renderWithContext();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'CANCEL_WORKFLOW' });
    });
  });

  describe('Registry Type Toggle', () => {
    it('should hide registry dropdown when switching from private to public', async () => {
      const user = userEvent.setup();
      vi.mocked(registriesApi.getAvailableRegistries).mockResolvedValue(mockRegistries);

      renderWithContext();
      await waitFor(() => {
        expect(registriesApi.getAvailableRegistries).toHaveBeenCalled();
      });

      // Switch to private
      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      expect(screen.getByLabelText('Select private registry')).toBeInTheDocument();

      // Switch back to public
      const publicRadio = screen.getByLabelText(/Public Registry/i);
      await user.click(publicRadio);

      // Dropdown should not be visible
      expect(screen.queryByLabelText('Select private registry')).not.toBeInTheDocument();
    });
  });
});
