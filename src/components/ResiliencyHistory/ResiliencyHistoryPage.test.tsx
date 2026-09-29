import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { operatorApi } from '../../services/operatorApi';
import { graphRunsApi } from '../../services/graphRunsApi';
import { configCache } from '../scenarioConfigCache';
import type { ResiliencyHistoryChartModel } from './resiliencyHistoryUtils';
import { ResiliencyHistoryPage } from './ResiliencyHistoryPage';

const mocks = vi.hoisted(() => ({
  clusterDiscovery: {
    clusters: [{
      uuid: 'cluster-uuid',
      clusterName: 'cluster-a',
      clusterAPIURL: 'https://cluster.example',
      operatorSource: 'krkn-operator',
      ready: true,
      secretType: 'kubeconfig',
    }],
    discoveryUuid: 'discovery-1',
    isLoading: false,
    isPolling: false,
    error: null as string | null,
    startDiscovery: vi.fn(),
    retry: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock('../../hooks/useClusterDiscovery', () => ({
  useClusterDiscovery: () => mocks.clusterDiscovery,
}));

vi.mock('./ResiliencyHistoryChart', () => ({
  ResiliencyHistoryChart: ({ chart, showBaselines }: { chart: ResiliencyHistoryChartModel; showBaselines: boolean }) => (
    <div data-testid="history-chart" data-show-baselines={showBaselines}>{chart.title}</div>
  ),
}));

const emptyHistory = { clusters: {}, configurationGroups: {} };
const populatedHistory = {
  clusters: {
    'cluster-a': {
      resilience: [{
        date: '2026-09-29T10:00:00Z',
        runId: 'run-1',
        runType: 'scenario-runs',
        score: 87,
        baseline: 85,
        configurationGroupId: 'config-1',
      }],
    },
  },
  configurationGroups: {
    resilience: { 'config-1': { runType: 'scenario-runs', representativeRunId: 'run-1', scenarioNames: ['pod-kill'] } },
  },
};
const multiHistory = {
  clusters: {
    'cluster-a': {
      resilience: [{ date: '2026-09-29T10:00:00Z', runId: 'a-1', runType: 'scenario-runs', score: 87, baseline: 85, configurationGroupId: 'cfg-a' }],
      reliability: [{ date: '2026-09-29T11:00:00Z', runId: 'a-2', runType: 'graph-runs', score: 91, configurationGroupId: 'cfg-b' }],
    },
    'cluster-b': {
      resilience: [{ date: '2026-09-28T10:00:00Z', runId: 'b-1', runType: 'scenario-runs', score: 75, configurationGroupId: 'cfg-a' }],
      reliability: [{ date: '2026-09-28T11:00:00Z', runId: 'b-2', runType: 'graph-runs', score: 81, configurationGroupId: 'cfg-b' }],
    },
  },
  configurationGroups: {
    resilience: { 'cfg-a': { runType: 'scenario-runs', representativeRunId: 'a-1', scenarioNames: ['pod-kill'] } },
    reliability: { 'cfg-b': { runType: 'graph-runs', representativeRunId: 'a-2', scenarioNames: ['workflow-a'] } },
  },
};

function renderPage() {
  return render(<ResiliencyHistoryPage />);
}

function createReportWindow() {
  const reportDocument = document.implementation.createHTMLDocument();
  const print = vi.fn();
  const reportWindow = {
    document: reportDocument,
    print,
    focus: vi.fn(),
    close: vi.fn(),
    setTimeout: window.setTimeout.bind(window),
    get closed() { return false; },
  } as unknown as Window;
  return { reportDocument, reportWindow, print };
}

async function selectFilters(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('checkbox', { name: 'resilience' });
  await user.click(screen.getByRole('checkbox', { name: 'resilience' }));
  await user.click(screen.getByRole('checkbox', { name: /cluster-a/ }));
}

describe('ResiliencyHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configCache.clear();
    mocks.clusterDiscovery.clusters = [{
      uuid: 'cluster-uuid',
      clusterName: 'cluster-a',
      clusterAPIURL: 'https://cluster.example',
      operatorSource: 'krkn-operator',
      ready: true,
      secretType: 'kubeconfig',
    }];
    mocks.clusterDiscovery.isLoading = false;
    mocks.clusterDiscovery.error = null;
    vi.spyOn(operatorApi, 'getCategories').mockResolvedValue({
      categories: [{ name: 'resilience', color: '#0066cc', availableToAll: true }],
      total: 1,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads visible clusters and keeps Apply disabled until a category and cluster are selected', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('checkbox', { name: 'resilience' })).toBeInTheDocument();
    const applyButton = screen.getByRole('button', { name: 'Apply filters' });
    expect(applyButton).toBeDisabled();
    expect(mocks.clusterDiscovery.startDiscovery).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('checkbox', { name: 'resilience' }));
    expect(applyButton).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /cluster-a/ }));
    expect(applyButton).toBeEnabled();
  });

  it('supports keyboard selection for filter checkboxes and chart mode radios', async () => {
    const user = userEvent.setup();
    vi.spyOn(operatorApi, 'queryResiliencyHistory').mockResolvedValue(populatedHistory);
    renderPage();

    const category = await screen.findByRole('checkbox', { name: 'resilience' });
    category.focus();
    await user.keyboard(' ');
    expect(category).toBeChecked();

    const cluster = screen.getByRole('checkbox', { name: /cluster-a/ });
    cluster.focus();
    await user.keyboard(' ');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    const separateMode = await screen.findByRole('radio', { name: 'Separate configuration groups' });
    separateMode.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Combine configurations by category' })).toBeChecked();
  });

  it('sends the selected category and cluster in a query and renders successful results', async () => {
    const user = userEvent.setup();
    const query = vi.spyOn(operatorApi, 'queryResiliencyHistory').mockResolvedValue(populatedHistory);
    renderPage();

    await selectFilters(user);
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => expect(query).toHaveBeenCalledWith({
      categories: ['resilience'],
      clusters: ['cluster-a'],
    }));
    expect(await screen.findByText('Score history')).toBeInTheDocument();
    expect(screen.getByTestId('history-chart')).toHaveTextContent('resilience — pod-kill');
    expect(screen.getByTestId('history-chart')).toHaveAttribute('data-show-baselines', 'true');
    await user.click(screen.getByRole('checkbox', { name: 'Show baseline comparisons' }));
    expect(screen.getByTestId('history-chart')).toHaveAttribute('data-show-baselines', 'false');
  });

  it('shows an empty state when the query returns no scored runs', async () => {
    const user = userEvent.setup();
    vi.spyOn(operatorApi, 'queryResiliencyHistory').mockResolvedValue(emptyHistory);
    renderPage();

    await selectFilters(user);
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(await screen.findByText('No resiliency history found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeDisabled();
  });

  it('shows an API error and permits another query', async () => {
    const user = userEvent.setup();
    const query = vi.spyOn(operatorApi, 'queryResiliencyHistory')
      .mockRejectedValueOnce(new Error('History service unavailable'))
      .mockResolvedValueOnce(emptyHistory);
    renderPage();

    await selectFilters(user);
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(await screen.findByText('History service unavailable')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(query).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('No resiliency history found')).toBeInTheDocument();
  });

  it('does not let a stale query overwrite filters changed while it is pending', async () => {
    const user = userEvent.setup();
    let resolveQuery!: (value: typeof populatedHistory) => void;
    vi.spyOn(operatorApi, 'queryResiliencyHistory').mockReturnValueOnce(
      new Promise((resolve) => { resolveQuery = resolve; }),
    );
    renderPage();

    await selectFilters(user);
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await user.click(screen.getByRole('checkbox', { name: 'resilience' }));

    await act(async () => {
      resolveQuery(populatedHistory);
    });

    expect(screen.queryByText('Score history')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply filters' })).toBeDisabled();
  });

  it('handles category loading errors and retries', async () => {
    const user = userEvent.setup();
    const getCategories = vi.mocked(operatorApi.getCategories);
    getCategories.mockRejectedValueOnce(new Error('Categories unavailable'));
    renderPage();

    expect(await screen.findByText('Categories unavailable')).toBeInTheDocument();
    getCategories.mockResolvedValueOnce({ categories: [{ name: 'resilience', availableToAll: true }], total: 1 });
    await user.click(screen.getByRole('button', { name: 'Retry categories' }));
    expect(await screen.findByRole('checkbox', { name: 'resilience' })).toBeInTheDocument();
  });

  it('renders category and cluster empty states', async () => {
    const user = userEvent.setup();
    vi.spyOn(operatorApi, 'getCategories').mockResolvedValue({ categories: [], total: 0 });
    mocks.clusterDiscovery.clusters = [];
    renderPage();

    expect(await screen.findByText('No visible categories')).toBeInTheDocument();
    expect(screen.getByText('No clusters discovered')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply filters' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Refresh clusters' }));
    expect(mocks.clusterDiscovery.startDiscovery).toHaveBeenCalledTimes(2);
  });

  it('offers a retry when cluster discovery fails', async () => {
    const user = userEvent.setup();
    mocks.clusterDiscovery.error = 'Discovery failed';
    renderPage();

    expect(await screen.findByText('Discovery failed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry cluster discovery' }));
    expect(mocks.clusterDiscovery.retry).toHaveBeenCalledTimes(1);
  });

  it('opens a structured print-ready report with charts and effective configurations', async () => {
    const user = userEvent.setup();
    vi.mocked(operatorApi.getCategories).mockResolvedValue({
      categories: [
        { name: 'resilience', availableToAll: true },
        { name: 'reliability', availableToAll: true },
      ],
      total: 2,
    });
    mocks.clusterDiscovery.clusters = [
      { uuid: 'a', clusterName: 'cluster-a', clusterAPIURL: 'https://a.example', operatorSource: 'operator-a', ready: true, secretType: 'kubeconfig' },
      { uuid: 'b', clusterName: 'cluster-b', clusterAPIURL: 'https://b.example', operatorSource: 'operator-b', ready: true, secretType: 'kubeconfig' },
    ];
    const query = vi.spyOn(operatorApi, 'queryResiliencyHistory').mockResolvedValue(multiHistory);
    const report = createReportWindow();
    vi.spyOn(window, 'open').mockReturnValue(report.reportWindow);
    vi.spyOn(operatorApi, 'getScenarioRunConfig').mockResolvedValue({
      targetRequestId: 'target-scenario',
      targetClusters: { 'krkn-operator': ['cluster-a'] },
      scenarioName: 'pod-kill',
      kubeconfigPath: '/unused',
      environment: { DURATION: '60', API_PASSWORD: 'scenario-secret' },
    });
    vi.spyOn(graphRunsApi, 'getGraphRunConfig').mockResolvedValue({
      targetRequestId: 'target-graph',
      targetClusters: { 'krkn-operator': ['cluster-a', 'cluster-b'] },
      graph: {
        'node-a': {
          scenario: { name: 'node-cpu-hog', private: false },
          env: { DURATION: '90', API_TOKEN: 'graph-secret' },
        },
      },
      maxRetries: 2,
    });
    renderPage();

    await screen.findByRole('checkbox', { name: 'resilience' });
    await user.click(screen.getByRole('checkbox', { name: 'resilience' }));
    await user.click(screen.getByRole('checkbox', { name: 'reliability' }));
    await user.click(screen.getByRole('checkbox', { name: /cluster-a/ }));
    await user.click(screen.getByRole('checkbox', { name: /cluster-b/ }));
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(await screen.findAllByTestId('history-chart')).toHaveLength(2);
    expect(query).toHaveBeenCalledWith({
      categories: ['resilience', 'reliability'],
      clusters: ['cluster-a', 'cluster-b'],
    });

    await user.click(screen.getByRole('radio', { name: 'Combine configurations by category' }));
    expect(screen.getAllByTestId('history-chart')).toHaveLength(2);
    expect(screen.getByText('resilience — Mixed configurations')).toBeInTheDocument();
    expect(screen.getByText('reliability — Mixed configurations')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Combine configurations by category' })).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Export PDF' }));
    await waitFor(() => expect(report.reportDocument.body.textContent).toContain('Configurations compared'));
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(report.reportDocument.body.textContent).toContain('Latest score snapshot');
    expect(report.reportDocument.body.textContent).toContain('Score trends');
    expect(report.reportDocument.body.textContent).toContain('Workflow nodes');
    expect(report.reportDocument.body.textContent).toContain('DURATION');
    expect(report.reportDocument.body.textContent).toContain('••••••••');
    expect(report.reportDocument.body.textContent).not.toContain('scenario-secret');
    expect(report.reportDocument.body.textContent).not.toContain('graph-secret');
    await waitFor(() => expect(report.print).toHaveBeenCalledTimes(1));
  });

  it('explains when the browser blocks the report popup', async () => {
    const user = userEvent.setup();
    vi.spyOn(operatorApi, 'queryResiliencyHistory').mockResolvedValue(populatedHistory);
    vi.spyOn(window, 'open').mockReturnValue(null);
    renderPage();

    await selectFilters(user);
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await screen.findByRole('button', { name: 'Export PDF' });
    await user.click(screen.getByRole('button', { name: 'Export PDF' }));

    expect(await screen.findByText('Allow pop-ups to open the PDF report.')).toBeInTheDocument();
  });
});
