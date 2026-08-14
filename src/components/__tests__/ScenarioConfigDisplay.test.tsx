import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetScenarioRunConfig = vi.fn();
const mockGetGraphRunConfig = vi.fn();

vi.mock('../../services/operatorApi', () => ({
  operatorApi: {
    getScenarioRunConfig: (...args: unknown[]) => mockGetScenarioRunConfig(...args),
  },
}));

vi.mock('../../services/graphRunsApi', () => ({
  graphRunsApi: {
    getGraphRunConfig: (...args: unknown[]) => mockGetGraphRunConfig(...args),
  },
}));

const { ScenarioConfigDisplay } = await import('../ScenarioConfigDisplay');
const { configCache } = await import('../scenarioConfigCache');

const makeConfig = (envOverrides?: Record<string, string>) => ({
  targetRequestId: 'target-001',
  targetClusters: { 'krkn-operator': ['staging-us-east-1'] },
  scenarioImage: 'quay.io/krkn-chaos/krkn-hub:pod-scenarios',
  scenarioName: 'pod-scenarios',
  kubeconfigPath: '/root/.kube/config',
  environment: {
    NAMESPACE: 'default',
    DURATION: '60',
    LABEL_SELECTOR: 'app=test',
    ...envOverrides,
  },
});

describe('ScenarioConfigDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configCache.clear();
    mockGetScenarioRunConfig.mockResolvedValue(makeConfig());
    mockGetGraphRunConfig.mockResolvedValue(makeConfig());
  });

  it('shows spinner during loading', () => {
    mockGetScenarioRunConfig.mockReturnValue(new Promise(() => {}));
    render(<ScenarioConfigDisplay scenarioRunName="loading-run" />);
    expect(screen.getByLabelText('Loading configuration')).toBeInTheDocument();
  });

  it('renders config after successful fetch for scenario run', async () => {
    render(<ScenarioConfigDisplay scenarioRunName="fetch-run" />);

    await waitFor(() => {
      expect(screen.getByText('Scenario Image:')).toBeInTheDocument();
    });

    expect(screen.getByText('quay.io/krkn-chaos/krkn-hub:pod-scenarios')).toBeInTheDocument();
    expect(screen.getByText('NAMESPACE:')).toBeInTheDocument();
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('DURATION:')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(mockGetScenarioRunConfig).toHaveBeenCalledWith('fetch-run');
  });

  it('calls graph run API when graphRunName is provided', async () => {
    render(<ScenarioConfigDisplay graphRunName="my-graph-run" />);

    await waitFor(() => {
      expect(screen.getByText('Scenario Image:')).toBeInTheDocument();
    });

    expect(mockGetGraphRunConfig).toHaveBeenCalledWith('my-graph-run');
    expect(mockGetScenarioRunConfig).not.toHaveBeenCalled();
  });

  it('sorts environment variables alphabetically', async () => {
    mockGetScenarioRunConfig.mockResolvedValue(makeConfig({
      ZEBRA: 'z',
      ALPHA: 'a',
      MIDDLE: 'm',
    }));

    render(<ScenarioConfigDisplay scenarioRunName="sort-run" />);

    await waitFor(() => {
      expect(screen.getByText('Scenario Image:')).toBeInTheDocument();
    });

    const dtElements = screen.getAllByText(/^[A-Z_]+:$/);
    const labels = dtElements.map(el => el.textContent);
    const envLabels = labels.filter(l => l && !['Scenario Image:', 'Target Clusters:'].includes(l));
    const sorted = [...envLabels].sort();
    expect(envLabels).toEqual(sorted);
  });

  it('masks sensitive values', async () => {
    mockGetScenarioRunConfig.mockResolvedValue(makeConfig({
      DB_PASSWORD: 'supersecret',
      API_TOKEN: 'tok123',
      SECRET_KEY: 'key456',
      NORMAL_VAR: 'visible',
    }));

    render(<ScenarioConfigDisplay scenarioRunName="mask-run" />);

    await waitFor(() => {
      expect(screen.getByText('Scenario Image:')).toBeInTheDocument();
    });

    expect(screen.queryByText('supersecret')).not.toBeInTheDocument();
    expect(screen.queryByText('tok123')).not.toBeInTheDocument();
    expect(screen.queryByText('key456')).not.toBeInTheDocument();
    expect(screen.getByText('visible')).toBeInTheDocument();

    const maskedValues = screen.getAllByText('********');
    expect(maskedValues.length).toBe(3);
  });

  it('shows error alert on fetch failure', async () => {
    mockGetScenarioRunConfig.mockRejectedValue(new Error('Network error'));

    render(<ScenarioConfigDisplay scenarioRunName="error-run" />);

    await waitFor(() => {
      expect(screen.getByText('Configuration not available')).toBeInTheDocument();
    });
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('handles empty environment gracefully', async () => {
    mockGetScenarioRunConfig.mockResolvedValue({
      ...makeConfig(),
      environment: {},
    });

    render(<ScenarioConfigDisplay scenarioRunName="empty-env-run" />);

    await waitFor(() => {
      expect(screen.getByText('Scenario Image:')).toBeInTheDocument();
    });

    expect(screen.getByText('No configuration parameters set')).toBeInTheDocument();
  });

  it('renders target clusters', async () => {
    render(<ScenarioConfigDisplay scenarioRunName="clusters-run" />);

    await waitFor(() => {
      expect(screen.getByText('Target Clusters:')).toBeInTheDocument();
    });

    expect(screen.getByText(/krkn-operator/)).toBeInTheDocument();
    expect(screen.getByText(/staging-us-east-1/)).toBeInTheDocument();
  });

  it('renders nothing when no props are provided', () => {
    const { container } = render(<ScenarioConfigDisplay />);
    expect(container.firstChild).toBeNull();
  });

  it('uses cache on re-render with same name', async () => {
    const { unmount } = render(<ScenarioConfigDisplay scenarioRunName="cache-run" />);

    await waitFor(() => {
      expect(screen.getByText('Scenario Image:')).toBeInTheDocument();
    });

    expect(mockGetScenarioRunConfig).toHaveBeenCalledTimes(1);
    unmount();

    render(<ScenarioConfigDisplay scenarioRunName="cache-run" />);

    await waitFor(() => {
      expect(screen.getByText('Scenario Image:')).toBeInTheDocument();
    });

    expect(mockGetScenarioRunConfig).toHaveBeenCalledTimes(1);
  });
});
