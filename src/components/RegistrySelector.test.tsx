import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { RegistrySelector } from './RegistrySelector';
import { AppContext } from '../context/AppContext';
import { operatorApi } from '../services/operatorApi';
import type { AppState, AppAction } from '../context/AppContext';
import type { ScenariosResponse } from '../types/api';

vi.mock('../services/operatorApi');

describe('RegistrySelector', () => {
  const mockDispatch = vi.fn();

  const initialState: AppState = {
    step: 'registry_selection',
    uuid: null,
    selectedClusters: [],
    scenarios: null,
    scenarioDetail: null,
    scenarioFormValues: null,
    scenarioGlobals: null,
    globalFormValues: null,
    globalTouchedFields: null,
    scenarioRuns: [],
    registryType: null,
    registryConfig: null,
    isLoading: false,
    error: null,
  };

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
  });

  describe('Initial Rendering', () => {
    it('should render the registry configuration card', () => {
      renderWithContext();

      expect(screen.getByText('Configure Chaos Scenarios Registry')).toBeInTheDocument();
    });

    it('should render public registry option by default', () => {
      renderWithContext();

      const publicRadio = screen.getByLabelText(/Public Registry/i);
      expect(publicRadio).toBeInTheDocument();
      expect(publicRadio).toBeChecked();
    });

    it('should render private registry option', () => {
      renderWithContext();

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      expect(privateRadio).toBeInTheDocument();
      expect(privateRadio).not.toBeChecked();
    });

    it('should render load scenarios button', () => {
      renderWithContext();

      expect(screen.getByRole('button', { name: /Load Scenarios/i })).toBeInTheDocument();
    });

    it('should render cancel button', () => {
      renderWithContext();

      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });
  });

  describe('Public Registry Selection', () => {
    it('should enable load button for public registry without extra fields', () => {
      renderWithContext();

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      expect(loadButton).not.toBeDisabled();
    });

    it('should load scenarios from public registry', async () => {
      const user = userEvent.setup();
      const mockResponse: ScenariosResponse = {
        scenarios: [
          { name: 'pod-scenarios', tags: ['v1.0.0'], digest: 'sha256:abc123' },
        ],
      };

      vi.mocked(operatorApi.getScenarios).mockResolvedValueOnce(mockResponse);

      renderWithContext();

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
    it('should show private registry fields when private option selected', async () => {
      const user = userEvent.setup();
      renderWithContext();

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      expect(screen.getByLabelText(/Registry URL/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Scenario Repository/i)).toBeInTheDocument();
    });

    it('should show authentication method options for private registry', async () => {
      const user = userEvent.setup();
      renderWithContext();

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      expect(screen.getByLabelText(/Username & Password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Token/i)).toBeInTheDocument();
    });

    it('should show username and password fields by default for private registry', async () => {
      const user = userEvent.setup();
      renderWithContext();

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      await waitFor(() => {
        expect(screen.getByLabelText('Username')).toBeInTheDocument();
      });
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
    });

    it('should show token field when token auth method selected', async () => {
      const user = userEvent.setup();
      renderWithContext();

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      const tokenRadio = screen.getByLabelText(/^Token$/);
      await user.click(tokenRadio);

      expect(screen.getByLabelText('Token')).toBeInTheDocument();
      expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    });

    it('should show TLS options for private registry', async () => {
      const user = userEvent.setup();
      renderWithContext();

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      expect(screen.getByLabelText(/Skip TLS Verification/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Allow Insecure Connections/i)).toBeInTheDocument();
    });

    it('should disable load button when private registry fields incomplete', async () => {
      const user = userEvent.setup();
      renderWithContext();

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      expect(loadButton).toBeDisabled();
    });

    it('should enable load button when all private registry fields complete with credentials', async () => {
      const user = userEvent.setup();
      renderWithContext();

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      const registryUrlInput = screen.getByLabelText(/Registry URL/i);
      await user.type(registryUrlInput, 'https://registry.example.com');

      const repoInput = screen.getByLabelText(/Scenario Repository/i);
      await user.type(repoInput, 'myorg/scenarios');

      const usernameInput = screen.getByLabelText('Username');
      await user.type(usernameInput, 'testuser');

      const passwordInput = screen.getByLabelText('Password');
      await user.type(passwordInput, 'testpass');

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      expect(loadButton).not.toBeDisabled();
    });

    it('should enable load button when all private registry fields complete with token', async () => {
      const user = userEvent.setup();
      renderWithContext();

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      const tokenRadio = screen.getByLabelText(/^Token$/);
      await user.click(tokenRadio);

      const registryUrlInput = screen.getByLabelText(/Registry URL/i);
      await user.type(registryUrlInput, 'https://registry.example.com');

      const repoInput = screen.getByLabelText(/Scenario Repository/i);
      await user.type(repoInput, 'myorg/scenarios');

      const tokenInput = screen.getByLabelText('Token');
      await user.type(tokenInput, 'my-token-12345');

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      expect(loadButton).not.toBeDisabled();
    });

    it('should load scenarios from private registry with credentials', async () => {
      const user = userEvent.setup();
      const mockResponse: ScenariosResponse = {
        scenarios: [
          { name: 'custom-scenario', tags: ['v2.0.0'], digest: 'sha256:custom' },
        ],
      };

      vi.mocked(operatorApi.getScenarios).mockResolvedValueOnce(mockResponse);

      renderWithContext();

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      await user.type(screen.getByLabelText(/Registry URL/i), 'https://registry.example.com');
      await user.type(screen.getByLabelText(/Scenario Repository/i), 'myorg/scenarios');
      await user.type(screen.getByLabelText('Username'), 'testuser');
      await user.type(screen.getByLabelText('Password'), 'testpass');

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      await user.click(loadButton);

      await waitFor(() => {
        expect(operatorApi.getScenarios).toHaveBeenCalledWith({
          username: 'testuser',
          password: 'testpass',
          registryUrl: 'https://registry.example.com',
          scenarioRepository: 'myorg/scenarios',
          skipTls: false,
          insecure: false,
        });
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: 'SCENARIOS_SUCCESS',
          payload: { scenarios: mockResponse.scenarios },
        });
      });
    });

    it('should load scenarios from private registry with token', async () => {
      const user = userEvent.setup();
      const mockResponse: ScenariosResponse = {
        scenarios: [
          { name: 'token-scenario', tags: ['v1.0.0'], digest: 'sha256:token' },
        ],
      };

      vi.mocked(operatorApi.getScenarios).mockResolvedValueOnce(mockResponse);

      renderWithContext();

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      const tokenRadio = screen.getByLabelText(/^Token$/);
      await user.click(tokenRadio);

      await user.type(screen.getByLabelText(/Registry URL/i), 'https://private.registry.io');
      await user.type(screen.getByLabelText(/Scenario Repository/i), 'org/chaos');
      await user.type(screen.getByLabelText('Token'), 'Bearer abc123xyz');

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      await user.click(loadButton);

      await waitFor(() => {
        expect(operatorApi.getScenarios).toHaveBeenCalledWith({
          token: 'Bearer abc123xyz',
          registryUrl: 'https://private.registry.io',
          scenarioRepository: 'org/chaos',
          skipTls: false,
          insecure: false,
        });
      });
    });

    it('should include TLS options when enabled', async () => {
      const user = userEvent.setup();
      vi.mocked(operatorApi.getScenarios).mockResolvedValueOnce({ scenarios: [] });

      renderWithContext();

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      await user.type(screen.getByLabelText(/Registry URL/i), 'http://insecure.local');
      await user.type(screen.getByLabelText(/Scenario Repository/i), 'scenarios');
      await user.type(screen.getByLabelText('Username'), 'user');
      await user.type(screen.getByLabelText('Password'), 'pass');

      const skipTlsCheckbox = screen.getByLabelText(/Skip TLS Verification/i);
      await user.click(skipTlsCheckbox);

      const insecureCheckbox = screen.getByLabelText(/Allow Insecure Connections/i);
      await user.click(insecureCheckbox);

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      await user.click(loadButton);

      await waitFor(() => {
        expect(operatorApi.getScenarios).toHaveBeenCalledWith(
          expect.objectContaining({
            skipTls: true,
            insecure: true,
          })
        );
      });
    });
  });

  describe('Form Validation', () => {
    it('should not allow empty username with credentials auth', async () => {
      const user = userEvent.setup();
      renderWithContext();

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      await user.type(screen.getByLabelText(/Registry URL/i), 'https://registry.example.com');
      await user.type(screen.getByLabelText(/Scenario Repository/i), 'myorg/scenarios');
      await user.type(screen.getByLabelText('Password'), 'testpass');

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      expect(loadButton).toBeDisabled();
    });

    it('should not allow empty password with credentials auth', async () => {
      const user = userEvent.setup();
      renderWithContext();

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      await user.type(screen.getByLabelText(/Registry URL/i), 'https://registry.example.com');
      await user.type(screen.getByLabelText(/Scenario Repository/i), 'myorg/scenarios');
      await user.type(screen.getByLabelText('Username'), 'testuser');

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      expect(loadButton).toBeDisabled();
    });

    it('should not allow empty token with token auth', async () => {
      const user = userEvent.setup();
      renderWithContext();

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      const tokenRadio = screen.getByLabelText(/^Token$/);
      await user.click(tokenRadio);

      await user.type(screen.getByLabelText(/Registry URL/i), 'https://registry.example.com');
      await user.type(screen.getByLabelText(/Scenario Repository/i), 'myorg/scenarios');

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      expect(loadButton).toBeDisabled();
    });

    it('should not allow whitespace-only credentials', async () => {
      const user = userEvent.setup();
      renderWithContext();

      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      await user.type(screen.getByLabelText(/Registry URL/i), 'https://registry.example.com');
      await user.type(screen.getByLabelText(/Scenario Repository/i), 'myorg/scenarios');
      await user.type(screen.getByLabelText('Username'), '   ');
      await user.type(screen.getByLabelText('Password'), '   ');

      const loadButton = screen.getByRole('button', { name: /Load Scenarios/i });
      expect(loadButton).toBeDisabled();
    });
  });

  describe('Loading State', () => {
    it('should show loading state while fetching scenarios', async () => {
      const user = userEvent.setup();
      vi.mocked(operatorApi.getScenarios).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ scenarios: [] }), 100))
      );

      renderWithContext();

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
        () => new Promise(resolve => setTimeout(() => resolve({ scenarios: [] }), 100))
      );

      renderWithContext();

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

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'CANCEL_WORKFLOW' });
    });
  });

  describe('Registry Type Toggle', () => {
    it('should clear private registry fields when switching to public', async () => {
      const user = userEvent.setup();
      vi.mocked(operatorApi.getScenarios).mockResolvedValue({ scenarios: [] });

      renderWithContext();

      // Switch to private and fill fields
      const privateRadio = screen.getByLabelText(/Private Registry/i);
      await user.click(privateRadio);

      await user.type(screen.getByLabelText(/Registry URL/i), 'https://registry.example.com');
      await user.type(screen.getByLabelText('Username'), 'testuser');

      // Switch back to public
      const publicRadio = screen.getByLabelText(/Public Registry/i);
      await user.click(publicRadio);

      // Private fields should not be visible
      expect(screen.queryByLabelText(/Registry URL/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
    });
  });
});
