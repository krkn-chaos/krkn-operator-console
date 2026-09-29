import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseDocument } from 'yaml';
import { KrknAIConfigValidationError } from '../../services/krknAiApi';
import type {
  KrknAIRunResource,
  KrknAIRunSummary,
  KrknAIScenarioDetail,
  KrknAIScenarioIndexResponse,
  KrknAIScenarioIndexRow,
} from '../../services/krknAiApi';
import { operatorApi } from '../../services/operatorApi';
import { websocketService } from '../../services/websocketService';
import { validateConfigDraft, createEditableConfigDraft, updateConfigDocument } from './configModel';
import { KrknAIPage } from './KrknAIPage';
import { ClusterComponentsEditor } from './ClusterComponentsEditor';
import type { ClusterComponents } from './types';

const mocks = vi.hoisted(() => ({
  ai: {
    listRuns: vi.fn(),
    getRunSummary: vi.fn(),
    getScenarioIndex: vi.fn(),
    getScenario: vi.fn(),
    discover: vi.fn(),
    validateConfig: vi.fn(),
    createConfig: vi.fn(),
    createRun: vi.fn(),
  },
  operator: {
    createTargetRequest: vi.fn(),
    getTargetStatus: vi.fn(),
    getClusters: vi.fn(),
    executeTerminalCommand: vi.fn(),
    getAvailableFiles: vi.fn(),
    getFile: vi.fn(),
  },
  useWebSocket: vi.fn((_connectionId: string, _url: string, _message?: unknown, _options?: unknown) => ({ connectionState: 'connected' as const })),
}));

vi.mock('../../services/krknAiApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/krknAiApi')>();
  return { ...actual, krknAiApi: mocks.ai };
});
vi.mock('../../services/operatorApi', () => ({ operatorApi: mocks.operator }));
vi.mock('../../hooks/useWebSocket', () => ({ useWebSocket: mocks.useWebSocket }));

const DISCOVERED_YAML = `# Preserve this discovery comment.
kubeconfig_file_path: /input/kubeconfig
site_extension:
  preserve: discovery-value
fitness_function:
  query: up
  items: []
scenario:
  pod-scenarios:
    enable: false
baseline:
  enable: true
  duration: 120
genetic:
  generations: 2
  population_size: 2
  composition_rate: 0
health_checks:
  applications: []
cluster_components:
  namespaces:
    - name: shop
      pods:
        - name: web
          labels:
            app: web
          containers:
            - name: web
              disabled: false
      services:
        - name: web
          ports:
            - name: http
              port: 8080
              target_port: 8080
      pvcs:
        - name: data
          capacity: 5Gi
          storage_class: fast
      vmis:
        - name: guest
          labels:
            app: vm
  nodes:
    - name: worker-a
      labels:
        node-role: worker
      free_cpu: 4
      schedulable: true
output:
  result_name_fmt: scenario_%s.yaml
  graph_name_fmt: scenario_%s.png
  log_name_fmt: scenario_%s.log
`;

const originalHiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');

function makeRun(name: string, phase = 'Running'): KrknAIRunResource {
  return {
    apiVersion: 'krkn.dev/v1alpha1',
    kind: 'KrknAIRun',
    metadata: {
      name,
      uid: `uid-${name}`,
      creationTimestamp: '2026-09-01T12:00:00Z',
    },
    spec: {
      targetRequestId: 'target-request-1',
      targetClusters: { 'krkn-operator': ['staging'] },
      configMapName: 'saved-ai-config',
      configMapKey: 'krkn-ai.yaml',
    },
    status: {
      phase,
      orchestratorPodName: `orchestrator-${name}`,
      failureReason: '',
    },
  };
}

function makeSummary(name: string, phase = 'Running', values: Partial<KrknAIRunSummary> = {}): KrknAIRunSummary {
  return {
    name,
    phase,
    createdAt: '2026-09-01T12:00:00Z',
    cluster: 'staging',
    orchestratorPodName: `orchestrator-${name}`,
    failureReason: '',
    artifactStatus: phase === 'Succeeded' ? 'succeeded' : 'in_progress',
    completedGenerations: 0,
    completedScenarios: 0,
    configuredGenerations: 2,
    populationSize: 2,
    bestFitness: null,
    averageFitness: null,
    baselineFitness: null,
    fitnessProgression: [],
    ...values,
  };
}

function makeIndex(rows: KrknAIScenarioIndexRow[] = [], page = 1): KrknAIScenarioIndexResponse {
  return {
    scenarios: rows,
    pagination: { page, limit: 500, total: rows.length, totalPages: rows.length > 0 ? 1 : 0 },
  };
}

function makeScenarioRow(overrides: Partial<KrknAIScenarioIndexRow> = {}): KrknAIScenarioIndexRow {
  return {
    generation: 0,
    scenarioId: '9',
    scenarioType: 'pod-scenarios',
    outcome: 'succeeded',
    durationSeconds: 12,
    fitnessScore: 3,
    fitnessState: 'provisional',
    childRunName: 'child-run-9',
    phase: 'Running',
    jobId: 'real-job-9',
    podName: 'scenario-pod-9',
    ...overrides,
  };
}

function makeScenarioDetail(score: number, fitnessState: 'provisional' | 'final' = 'provisional'): KrknAIScenarioDetail {
  return {
    generation: 0,
    scenarioId: '9',
    scenarioType: 'pod-scenarios',
    parameters: [{ name: 'namespace', value: 'shop' }],
    command: 'krkn --scenario pod-scenarios',
    origin: 'initial',
    parentIds: [],
    durationSeconds: 12,
    returnCode: 0,
    fitnessResult: {
      fitnessScore: score,
      scores: [{ id: 1, fitnessScore: score, weightedScore: score / 2, normalizedScore: fitnessState === 'final' ? 1 : null }],
      healthCheckFailureScore: 0.25,
      healthCheckResponseTimeScore: 0.5,
      krknFailureScore: 0.75,
    },
    healthChecks: [
      { application: 'shop', timestamp: '2026-09-01T12:00:02Z', elapsedSeconds: 2, responseTimeSeconds: 0.12, statusCode: 200, success: true },
      { application: 'shop', timestamp: '2026-09-01T12:00:05Z', elapsedSeconds: 5, responseTimeSeconds: 0.2, statusCode: 503, success: false, error: 'unhealthy' },
    ],
    logPath: 'logs/scenario_9.log',
    fitnessState,
  };
}

async function flushReact(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  await flushReact();
}

function setDocumentHidden(hidden: boolean): void {
  act(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

async function openWizardToConfiguration(user: UserEvent, name: string): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Create run' }));
  await user.type(screen.getByRole('textbox', { name: 'Run name' }), name);
  const namespace = await screen.findByRole('checkbox', { name: 'shop' });
  expect(namespace).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Discover components' })).toBeDisabled();
  await user.click(namespace);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Discover components' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Discover components' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Review YAML/ })).toBeInTheDocument());
}

async function openWizardToPreview(user: UserEvent, name: string): Promise<void> {
  await openWizardToConfiguration(user, name);
  await user.click(screen.getByRole('button', { name: /Review YAML/ }));
}

describe('Krkn-AI real run lifecycle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.ai.listRuns.mockResolvedValue([]);
    mocks.ai.getRunSummary.mockImplementation(async (name: string) => makeSummary(name));
    mocks.ai.getScenarioIndex.mockResolvedValue(makeIndex());
    mocks.ai.getScenario.mockResolvedValue(makeScenarioDetail(3));
    mocks.ai.discover.mockResolvedValue({ configYaml: DISCOVERED_YAML, warnings: [] });
    mocks.ai.validateConfig.mockResolvedValue({ valid: true });
    mocks.ai.createConfig.mockResolvedValue({ configId: 'saved-config-uuid' });
    mocks.ai.createRun.mockImplementation(async (request: { name: string }) => makeRun(request.name, 'Pending'));
    mocks.operator.createTargetRequest.mockResolvedValue({ uuid: 'target-request-1' });
    mocks.operator.getTargetStatus.mockResolvedValue(200);
    mocks.operator.getClusters.mockResolvedValue({
      status: 'Completed',
      targetData: {
        'krkn-operator': [
          { 'cluster-name': 'staging', 'cluster-api-url': 'https://api.staging.example.test' },
          { 'cluster-name': 'staging-west', 'cluster-api-url': 'https://api.west.example.test' },
        ],
        'krkn-operator-acm': [
          { 'cluster-name': 'prod', 'cluster-api-url': 'https://api.prod.example.test' },
        ],
      },
    });
    mocks.operator.executeTerminalCommand.mockImplementation(async ({ cluster_id }: { cluster_id: string }) => {
      const names = cluster_id === 'prod' ? ['prod.cluster', 'kube-system'] : ['default', 'shop'];
      return {
        stdout: JSON.stringify({ items: names.map((name) => ({ metadata: { name } })) }),
        stderr: '',
        exitCode: 0,
      };
    });
    mocks.operator.getAvailableFiles.mockResolvedValue({ files: [] });
    mocks.operator.getFile.mockResolvedValue({ fileId: 'config-file', fileName: 'saved-ai-config', content: DISCOVERED_YAML, availableToAll: false });
    mocks.useWebSocket.mockReturnValue({ connectionState: 'connected' });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (originalHiddenDescriptor) Object.defineProperty(document, 'hidden', originalHiddenDescriptor);
    else Reflect.deleteProperty(document, 'hidden');
  });

  it('discovers clusters automatically, lets users pick one, and reuses its target for discovery/config/run', async () => {
    const user = userEvent.setup();
    mocks.operator.getTargetStatus.mockResolvedValueOnce(202).mockResolvedValueOnce(200);
    mocks.ai.createRun.mockResolvedValue(makeRun('real-run-1', 'Pending'));
    render(<KrknAIPage />);
    await flushReact();
    expect(operatorApi.createTargetRequest).toBe(mocks.operator.createTargetRequest);
    expect(mocks.operator.createTargetRequest).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Create run' }));
    await user.type(screen.getByRole('textbox', { name: 'Run name' }), 'real-run-1');
    expect(screen.getByRole('button', { name: 'Cancel' }).closest('.krkn-ai-actions')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request authorized clusters' })).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.operator.createTargetRequest).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.operator.getTargetStatus).toHaveBeenCalledTimes(1));
    expect(mocks.operator.getClusters).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.operator.getTargetStatus).toHaveBeenCalledTimes(2), { timeout: 5_000 });
    await waitFor(() => expect(mocks.operator.getClusters).toHaveBeenCalledTimes(1));
    const stagingNamespace = await screen.findByRole('checkbox', { name: 'shop' });
    expect(stagingNamespace).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Discover components' })).toBeDisabled();
    await user.click(stagingNamespace);

    const clusterSelect = screen.getByRole('combobox', { name: 'Cluster' });
    expect(screen.queryByRole('combobox', { name: 'Provider' })).not.toBeInTheDocument();
    expect(clusterSelect).toHaveDisplayValue('staging (krkn-operator)');
    await user.selectOptions(clusterSelect, screen.getByRole('option', { name: 'prod (krkn-operator-acm)' }));
    const prodNamespace = await screen.findByRole('checkbox', { name: 'prod.cluster' });
    const kubeSystemNamespace = screen.getByRole('checkbox', { name: 'kube-system' });
    expect(prodNamespace).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'shop' })).not.toBeInTheDocument();
    await user.click(prodNamespace);
    await user.click(kubeSystemNamespace);
    await user.click(screen.getByRole('button', { name: 'Discover components' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Review YAML/ })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Cancel' }).closest('.krkn-ai-actions')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(14);

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const dangerous = screen.getByRole('checkbox', { name: 'Service disruption' });
    await user.click(dangerous);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(dangerous).not.toBeChecked();
    confirm.mockReturnValue(true);
    await user.click(dangerous);
    expect(dangerous).toBeChecked();
    expect(mocks.ai.discover).toHaveBeenCalledWith(expect.objectContaining({
      targetRequestId: 'target-request-1',
      targetClusters: { 'krkn-operator-acm': ['prod'] },
      namespacePattern: 'prod\\.cluster,kube-system',
    }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    const discoveryRequest = mocks.ai.discover.mock.calls[0][0] as Record<string, unknown>;
    expect(discoveryRequest.namespacePattern).toBe('prod\\.cluster,kube-system');
    expect(discoveryRequest).not.toHaveProperty('podLabelPattern');
    expect(discoveryRequest).not.toHaveProperty('nodeLabelPattern');

    await user.click(screen.getByRole('button', { name: /Review YAML/ }));
    const yamlEditor = screen.getByRole('textbox', { name: 'Krkn AI configuration YAML' });
    expect(screen.getByRole('button', { name: 'Cancel' }).closest('.krkn-ai-actions')).toBeInTheDocument();
    const yamlText = (yamlEditor as HTMLTextAreaElement).value;
    expect(yamlText).toContain('# Preserve this discovery comment.');
    expect(yamlText).toContain('preserve: discovery-value');
    expect(yamlText).toContain('port: 8080');
    expect(yamlText).toContain('capacity: 5Gi');
    expect(yamlText).toContain('name: guest');
    expect(yamlText).toContain('schedulable: true');
    expect(yamlText).toContain('kubeconfig_file_path: /input/kubeconfig');
    expect(yamlText).toContain('allow_dangerous_scenarios: true');

    await user.click(screen.getByRole('button', { name: 'Validate and save config' }));
    await waitFor(() => expect(mocks.ai.createConfig).toHaveBeenCalledTimes(1));
    expect(mocks.ai.validateConfig).toHaveBeenCalledWith(expect.stringContaining('site_extension:'), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(mocks.ai.createConfig).toHaveBeenCalledWith(expect.objectContaining({
      name: expect.stringMatching(/^ai-real-run-1-[a-f0-9]{8}$/),
      targetRequestId: 'target-request-1',
      targetClusters: { 'krkn-operator-acm': ['prod'] },
    }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.getByText('saved-config-uuid')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start run' }));
    await waitFor(() => expect(mocks.ai.createRun).toHaveBeenCalledTimes(1));
    expect(mocks.ai.createRun).toHaveBeenCalledWith(expect.objectContaining({
      name: 'real-run-1',
      configId: 'saved-config-uuid',
      targetRequestId: 'target-request-1',
      targetClusters: { 'krkn-operator-acm': ['prod'] },
    }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(await screen.findByRole('heading', { name: 'real-run-1' })).toBeInTheDocument();
  }, 15_000);

  it('keeps genetic settings grouped and uses the fitness item list', async () => {
    const user = userEvent.setup();
    render(<KrknAIPage />);
    await flushReact();
    await openWizardToConfiguration(user, 'genetic-controls-run');

    await user.click(screen.getByRole('button', { name: /Genetic algorithm/ }));
    expect(screen.getByRole('heading', { name: 'Search budget' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Variation rates' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Parent selection' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Algorithm' })).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Population injection rate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Population injection size' })).not.toBeInTheDocument();
    expect(screen.queryByText('Control the search breadth')).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Tournament size' })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Selection strategy' }), 'roulette');
    expect(screen.queryByRole('spinbutton', { name: 'Tournament size' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Fitness functions/ }));
    expect(screen.queryByRole('textbox', { name: 'Fitness query' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Fitness query type' })).not.toBeInTheDocument();
    expect(screen.getByText(/Default fitness query/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Health checks/ }));
    expect(screen.getByRole('checkbox', { name: 'Stop the health-check watcher on failure' })).toBeInTheDocument();
  });

  it('shows the baseline artifact as a selectable scenario result', async () => {
    const run = makeRun('baseline-run', 'Succeeded');
    const baseline = makeScenarioRow({
      generation: 0,
      scenarioId: 'baseline',
      scenarioType: 'baseline',
      outcome: 'succeeded',
      fitnessScore: 12,
      fitnessState: 'final',
      durationSeconds: 120,
      childRunName: 'baseline-child-run',
      jobId: 'baseline-job',
      phase: 'Succeeded',
    });
    const generatedScenario = makeScenarioRow({
      generation: 0,
      scenarioId: '9',
      scenarioType: 'pod-delete',
      fitnessScore: 8,
      phase: 'Succeeded',
    });
    mocks.ai.listRuns.mockResolvedValue([run]);
    mocks.ai.getRunSummary.mockResolvedValue(makeSummary(run.metadata.name, 'Succeeded', {
      baselineFitness: 12,
      artifactStatus: 'succeeded',
    }));
    mocks.ai.getScenarioIndex.mockResolvedValue(makeIndex([generatedScenario, baseline]));
    mocks.ai.getScenario.mockResolvedValue(makeScenarioDetail(12, 'final'));
    render(<KrknAIPage />);
    await flushReact();
    const expectedRunTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      .format(new Date(run.metadata.creationTimestamp));
    expect(screen.getByText(expectedRunTime)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('row', { name: /Open run baseline-run/ }));
    await flushReact();
    expect(screen.getByRole('heading', { name: 'Run', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Progress', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fitness', level: 2 })).toBeInTheDocument();
    expect(screen.getByText(expectedRunTime)).toBeInTheDocument();
    const scenarioTable = screen.getByRole('table', { name: 'Scenario executions' });
    const visibleScenarioIds = () => Array.from(
      scenarioTable.querySelectorAll('tbody tr'),
      (row) => row.getAttribute('aria-label'),
    );
    expect(visibleScenarioIds()).toEqual([
      'Open baseline scenario details',
      'Open generation 1 scenario 9 details',
    ]);
    fireEvent.click(screen.getByRole('button', { name: /Scenario ID/ }));
    expect(visibleScenarioIds()).toEqual([
      'Open baseline scenario details',
      'Open generation 1 scenario 9 details',
    ]);
    expect(screen.getByText('Baseline fitness')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Baseline' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('row', { name: 'Open baseline scenario details' }));
    await flushReact();
    expect(screen.getByText('12 fitness units')).toBeInTheDocument();
    expect(screen.getByText('Run type')).toBeInTheDocument();
    expect(screen.getByText('baseline-child-run')).toBeInTheDocument();
  });

  it('passes server validation errors through and never launches an invalid config', async () => {
    const user = userEvent.setup();
    mocks.ai.validateConfig.mockRejectedValue(new KrknAIConfigValidationError([
      { path: 'genetic.population_size', message: 'Invalid value' },
    ]));
    render(<KrknAIPage />);
    await flushReact();
    await openWizardToPreview(user, 'invalid-run');

    await user.click(screen.getByRole('button', { name: 'Validate and save config' }));
    expect(await screen.findByText('genetic.population_size: Invalid value')).toBeInTheDocument();
    expect(mocks.ai.createConfig).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Start run' })).not.toBeInTheDocument();
  });


  it('loads the run config through the permission-filtered file ID', async () => {
    const run = makeRun('config-review-run', 'Running');
    mocks.ai.listRuns.mockResolvedValue([run]);
    mocks.operator.getAvailableFiles.mockResolvedValue({
      files: [{
        fileId: 'run-config-file-id',
        fileName: run.spec.configMapName!,
        filePurpose: 'krkn-ai-config',
        availableToAll: false,
      }],
    });
    mocks.operator.getFile.mockResolvedValue({
      fileId: 'run-config-file-id',
      fileName: run.spec.configMapName!,
      content: DISCOVERED_YAML,
      availableToAll: false,
    });

    render(<KrknAIPage />);
    await flushReact();
    fireEvent.click(screen.getByRole('row', { name: /Open run config-review-run/ }));
    await waitFor(() => expect(mocks.operator.getFile).toHaveBeenCalledWith(
      'run-config-file-id',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
    fireEvent.click(screen.getByText('View krkn-ai.yaml used for this run'));
    expect(await screen.findByText(/Preserve this discovery comment/)).toBeInTheDocument();
    expect(mocks.operator.getAvailableFiles).toHaveBeenCalledWith(
      'krkn-ai-config',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('keeps config authorization failures distinct from retriable file-service errors', async () => {
    const run = makeRun('config-retry-run', 'Running');
    mocks.ai.listRuns.mockResolvedValue([run]);
    mocks.operator.getAvailableFiles
      .mockRejectedValueOnce(Object.assign(new Error('temporary file service outage'), { status: 503, statusText: 'Service Unavailable' }))
      .mockResolvedValueOnce({
        files: [{
          fileId: 'retry-config-id',
          fileName: run.spec.configMapName!,
          filePurpose: 'krkn-ai-config',
          availableToAll: false,
        }],
      });
    mocks.operator.getFile.mockResolvedValue({
      fileId: 'retry-config-id',
      fileName: run.spec.configMapName!,
      content: DISCOVERED_YAML,
      availableToAll: false,
    });

    render(<KrknAIPage />);
    await flushReact();
    fireEvent.click(screen.getByRole('row', { name: /Open run config-retry-run/ }));
    fireEvent.click(screen.getByText('View krkn-ai.yaml used for this run'));
    const retry = await screen.findByRole('button', { name: 'Retry configuration load' });
    fireEvent.click(retry);
    expect(await screen.findByText(/Preserve this discovery comment/)).toBeInTheDocument();

    cleanup();
    mocks.ai.listRuns.mockResolvedValue([run]);
    mocks.operator.getAvailableFiles.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden'), { status: 403, statusText: 'Forbidden' }),
    );
    render(<KrknAIPage />);
    await flushReact();
    fireEvent.click(screen.getByRole('row', { name: /Open run config-retry-run/ }));
    fireEvent.click(screen.getByText('View krkn-ai.yaml used for this run'));
    expect(await screen.findByText('This configuration is not available to your account, or is no longer available.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry configuration load' })).not.toBeInTheDocument();
  });

  it('keeps the last successful summary and retries transient artifact updates', async () => {
    vi.useFakeTimers();
    const run = makeRun('retry-run', 'Running');
    mocks.ai.listRuns.mockResolvedValue([run]);
    mocks.ai.getRunSummary
      .mockResolvedValueOnce(makeSummary(run.metadata.name, 'Running', { bestFitness: 2.5, completedScenarios: 1 }))
      .mockRejectedValueOnce(Object.assign(new Error('artifact_updating'), { status: 503, statusText: 'Service Unavailable' }))
      .mockResolvedValueOnce(makeSummary(run.metadata.name, 'Running', { bestFitness: 4.5, completedScenarios: 2 }));
    render(<KrknAIPage />);
    await flushReact();
    const row = screen.getByRole('row', { name: /Open run retry-run/ });
    expect(row).toHaveTextContent('2.5');

    await advance(10_000);
    expect(row).toHaveTextContent('2.5');
    expect(screen.getByText('Updating committed results…')).toBeInTheDocument();
    await advance(10_000);
    expect(screen.getByRole('row', { name: /Open run retry-run/ })).toHaveTextContent('4.5');
    expect(screen.queryByText('Updating committed results…')).not.toBeInTheDocument();
  });

  it('does not overlap ten-second refreshes and stops after the run becomes terminal', async () => {
    vi.useFakeTimers();
    const running = makeRun('terminal-run', 'Running');
    const succeeded = makeRun('terminal-run', 'Succeeded');
    let resolveSecondList!: (runs: KrknAIRunResource[]) => void;
    const secondList = new Promise<KrknAIRunResource[]>((resolve) => { resolveSecondList = resolve; });
    mocks.ai.listRuns.mockResolvedValueOnce([running]).mockReturnValueOnce(secondList);
    mocks.ai.getRunSummary
      .mockResolvedValueOnce(makeSummary('terminal-run', 'Running'))
      .mockResolvedValueOnce(makeSummary('terminal-run', 'Succeeded', { artifactStatus: 'succeeded' }));
    render(<KrknAIPage />);
    await flushReact();

    await advance(10_000);
    expect(mocks.ai.listRuns).toHaveBeenCalledTimes(2);
    await advance(30_000);
    expect(mocks.ai.listRuns).toHaveBeenCalledTimes(2);
    await act(async () => { resolveSecondList([succeeded]); });
    await flushReact();
    expect(screen.getByRole('row', { name: /Open run terminal-run/ })).toHaveTextContent('Succeeded');
    await advance(30_000);
    expect(mocks.ai.listRuns).toHaveBeenCalledTimes(2);
    expect(mocks.ai.getRunSummary).toHaveBeenCalledTimes(2);
  });

  it('manual refresh discovers terminal runs without restarting a stopped timer', async () => {
    vi.useFakeTimers();
    const externalRun = makeRun('external-run', 'Succeeded');
    render(<KrknAIPage />);
    await flushReact();
    await advance(20_000);
    expect(mocks.ai.listRuns).toHaveBeenCalledTimes(1);

    mocks.ai.listRuns.mockResolvedValueOnce([externalRun]);
    mocks.ai.getRunSummary.mockResolvedValueOnce(makeSummary('external-run', 'Succeeded', { artifactStatus: 'succeeded' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await flushReact();
    expect(screen.getByRole('row', { name: /Open run external-run/ })).toBeInTheDocument();
    expect(mocks.ai.listRuns).toHaveBeenCalledTimes(2);

    await advance(20_000);
    expect(mocks.ai.listRuns).toHaveBeenCalledTimes(2);
  });

  it('pauses list polling while hidden and resumes once when visible', async () => {
    vi.useFakeTimers();
    const run = makeRun('visibility-run', 'Running');
    mocks.ai.listRuns.mockResolvedValue([run]);
    render(<KrknAIPage />);
    await flushReact();

    setDocumentHidden(true);
    await advance(20_000);
    expect(mocks.ai.listRuns).toHaveBeenCalledTimes(1);
    setDocumentHidden(false);
    await flushReact();
    expect(mocks.ai.listRuns).toHaveBeenCalledTimes(2);

    cleanup();
    await advance(20_000);
    expect(mocks.ai.listRuns).toHaveBeenCalledTimes(2);
  });

  it('loads measured scenario fitness and health, refreshes normalization, and separates the two log streams', async () => {
    vi.useFakeTimers();
    const run = makeRun('measured-run', 'Running');
    const provisional = makeScenarioRow({ fitnessScore: 3, fitnessState: 'provisional' });
    const finalized = makeScenarioRow({ fitnessScore: 75, fitnessState: 'final' });
    mocks.ai.listRuns.mockResolvedValue([run]);
    mocks.ai.getRunSummary
      .mockResolvedValueOnce(makeSummary('measured-run', 'Running', { bestFitness: 3, baselineFitness: 12 }))
      .mockResolvedValueOnce(makeSummary('measured-run', 'Running', { bestFitness: 3, baselineFitness: 12 }))
      .mockResolvedValueOnce(makeSummary('measured-run', 'Running', { bestFitness: 3, baselineFitness: 12 }))
      .mockResolvedValueOnce(makeSummary('measured-run', 'Succeeded', { bestFitness: 75, baselineFitness: 12, artifactStatus: 'succeeded' }));
    mocks.ai.getScenarioIndex.mockResolvedValueOnce(makeIndex([provisional])).mockResolvedValue(makeIndex([finalized]));
    mocks.ai.getScenario
      .mockResolvedValueOnce(makeScenarioDetail(3, 'provisional'))
      .mockRejectedValueOnce(Object.assign(new Error('artifact_updating'), { status: 503, statusText: 'Service Unavailable' }))
      .mockResolvedValueOnce(makeScenarioDetail(75, 'final'));
    const orchestratorUrl = vi.spyOn(websocketService, 'buildAiRunLogsUrl');
    const childUrl = vi.spyOn(websocketService, 'buildJobLogsUrl');
    render(<KrknAIPage />);
    await flushReact();
    fireEvent.click(screen.getByRole('row', { name: /Open run measured-run/ }));
    await flushReact();
    expect(screen.getByText('Baseline fitness')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('row', { name: /Open generation 1 scenario 9 details/ }));
    await flushReact();
    const expectedSampleTime = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date('2026-09-01T12:00:02Z'));
    expect(screen.getByText(expectedSampleTime)).toBeInTheDocument();
    expect(screen.getByText('3 fitness units')).toBeInTheDocument();
    expect(orchestratorUrl).toHaveBeenCalledWith('measured-run', true, 200, true);
    expect(childUrl).toHaveBeenCalledWith('child-run-9', 'real-job-9', true);
    const openedPaths = [...new Set(mocks.useWebSocket.mock.calls.map((call) => new URL(String(call[1])).pathname))];
    expect(openedPaths).toHaveLength(2);
    expect(openedPaths).toContain('/api/v2/ws/krkn-ai/runs/measured-run/logs');
    expect(openedPaths).toContain('/api/v2/ws/scenarios/run/child-run-9/jobs/real-job-9/logs');

    await advance(10_000);
    expect(screen.getByText('Result upload is updating. Showing the last committed scenario result.')).toBeInTheDocument();
    expect(screen.getByText('3 fitness units')).toBeInTheDocument();
    await advance(10_000);
    expect(screen.getByText('75 fitness units')).toBeInTheDocument();
    expect(screen.getByText('Fitness final')).toBeInTheDocument();
    expect(orchestratorUrl).toHaveBeenCalledWith('measured-run', false, 200, true);
    await advance(20_000);
    expect(mocks.ai.getRunSummary).toHaveBeenCalledTimes(4);
    expect(mocks.ai.getScenarioIndex).toHaveBeenCalledTimes(3);
    expect(mocks.ai.getScenario).toHaveBeenCalledTimes(3);
  });

  it('retries an in-progress scenario detail 404 after visibility returns and retains indexed rows', async () => {
    vi.useFakeTimers();
    const run = makeRun('late-artifact-run', 'Running');
    const row = makeScenarioRow({ fitnessScore: 4 });
    mocks.ai.listRuns.mockResolvedValue([run]);
    mocks.ai.getRunSummary
      .mockResolvedValueOnce(makeSummary(run.metadata.name, 'Running'))
      .mockRejectedValueOnce(Object.assign(new Error('run cache miss'), { status: 404, statusText: 'Not Found' }));
    mocks.ai.getScenarioIndex
      .mockResolvedValueOnce(makeIndex([row]))
      .mockResolvedValueOnce(makeIndex([]));
    mocks.ai.getScenario
      .mockRejectedValueOnce(Object.assign(new Error('scenario artifact not uploaded'), { status: 404, statusText: 'Not Found' }))
      .mockResolvedValue(makeScenarioDetail(9));

    render(<KrknAIPage />);
    await flushReact();
    fireEvent.click(screen.getByRole('row', { name: /Open run late-artifact-run/ }));
    await flushReact();
    fireEvent.click(screen.getByRole('row', { name: /Open generation 1 scenario 9 details/ }));
    await flushReact();
    expect(screen.getByText('The scenario result is not committed yet. Will retry when run results refresh.')).toBeInTheDocument();

    setDocumentHidden(true);
    await advance(20_000);
    expect(mocks.ai.getRunSummary).toHaveBeenCalledTimes(2);
    expect(mocks.ai.getScenarioIndex).toHaveBeenCalledTimes(1);

    setDocumentHidden(false);
    await flushReact();
    expect(screen.getByText('9 fitness units')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('row', { name: /Open generation 1 scenario 9 details/ })).toBeInTheDocument();
    expect(mocks.ai.getRunSummary).toHaveBeenCalledTimes(3);
    expect(mocks.ai.getScenarioIndex).toHaveBeenCalledTimes(2);
    expect(mocks.ai.getScenario).toHaveBeenCalledTimes(2);
  });

  it('uses Krkn-AI model defaults and migrates a legacy fitness query into an item', () => {
    const { document, draft } = createEditableConfigDraft('fitness_function:\n  query: up\n  type: range\n');
    expect(draft.genetic).toMatchObject({
      generations: '20',
      populationSize: '10',
      mutationRate: '0.7',
      scenarioMutationRate: '0.6',
      crossoverRate: '0.6',
      compositionRate: '0',
      selectionStrategy: 'tournament',
      tournamentSize: '6',
      populationInjectionRate: '0',
      populationInjectionSize: '2',
    });
    expect(draft.fitnessItems).toEqual([
      expect.objectContaining({ query: 'up', type: 'range', weight: '1' }),
    ]);

    const saved = parseDocument(updateConfigDocument(document, draft)).toJS() as Record<string, unknown>;
    expect(saved.algorithm).toBe('genetic');
    const savedGenetic = saved.genetic as Record<string, unknown>;
    expect(savedGenetic.generations).toBe(20);
    expect(savedGenetic.population_size).toBe(10);
    const savedFitness = saved.fitness_function as {
      query?: unknown;
      type?: unknown;
      items: Array<Record<string, unknown>>;
    };
    expect(savedFitness.query).toBeUndefined();
    expect(savedFitness.type).toBeUndefined();
    expect(savedFitness.items).toHaveLength(1);
    expect(savedFitness.items[0]).toMatchObject({ query: 'up', type: 'range', weight: 1 });
  });

  it('accepts real health URLs and unrestricted nonnegative weights but rejects invalid local bounds', () => {
    const { draft } = createEditableConfigDraft(DISCOVERED_YAML);
    const validDraft = {
      ...draft,
      genetic: {
        ...draft.genetic,
        populationSize: '2',
        selectionStrategy: 'roulette',
        compositionRate: '0',
        duration: '',
      },
      fitnessItems: [{ key: 1, id: '9', title: 'custom', query: 'up', type: 'point' as const, weight: '12' }],
      healthChecks: [{ key: 1, name: 'service', url: 'https://10.1.2.3/ready', statusCode: '200', timeout: '4', interval: '2' }],
    };
    expect(validateConfigDraft(validDraft)).toEqual({});
    const invalidDraft = {
      ...validDraft,
      genetic: { ...validDraft.genetic, populationSize: '1', compositionRate: '0.1' },
      fitnessItems: [{ ...validDraft.fitnessItems[0], weight: '-1' }],
    };
    expect(validateConfigDraft(invalidDraft)).toMatchObject({
      populationSize: expect.any(String),
      'genetic.compositionRate': expect.any(String),
      'fitnessItem.1.weight': expect.any(String),
    });
  });
  it('bulk-toggles namespaces and propagates individual namespace disables to descendants', async () => {
    const user = userEvent.setup();
    const components: ClusterComponents = {
      namespaces: [{
        name: 'shop',
        disabled: false,
        pods: [{ name: 'web', disabled: false, labels: {}, containers: [{ name: 'web', disabled: false }] }],
        services: [{ name: 'web', disabled: false }],
        pvcs: [{ name: 'data', disabled: false }],
        vmis: [{ name: 'guest', disabled: false }],
      }],
      nodes: [{ name: 'worker-a', disabled: false }],
    };
    const onChange = vi.fn((_next: ClusterComponents) => undefined);
    render(<ClusterComponentsEditor components={components} onChange={onChange} />);
    const accordion = screen.getByText('Namespace shop').closest('details');
    expect(accordion?.open).toBe(true);

    await user.click(screen.getByRole('checkbox', { name: 'Enable namespace shop' }));
    expect(accordion?.open).toBe(true);
    const disabledNamespace = onChange.mock.calls[0][0].namespaces[0];
    expect(disabledNamespace.disabled).toBe(true);
    expect(disabledNamespace.pods[0].disabled).toBe(true);
    expect(disabledNamespace.pods[0].containers[0].disabled).toBe(true);
    expect(disabledNamespace.services[0].disabled).toBe(true);
    expect(disabledNamespace.pvcs[0].disabled).toBe(true);
    expect(disabledNamespace.vmis?.[0].disabled).toBe(true);

    const editable = createEditableConfigDraft(DISCOVERED_YAML);
    const serialized = updateConfigDocument(editable.document, {
      ...editable.draft,
      clusterComponents: { ...editable.draft.clusterComponents, namespaces: [disabledNamespace] },
    });
    expect(createEditableConfigDraft(serialized).draft.clusterComponents.namespaces[0].vmis?.[0].disabled).toBe(true);

    onChange.mockClear();
    await user.click(screen.getByRole('button', { name: 'Disable all namespaces' }));
    const allDisabled = onChange.mock.calls[0][0].namespaces[0];
    expect(allDisabled.disabled).toBe(true);
    expect(allDisabled.pods[0].containers[0].disabled).toBe(true);
    expect(onChange.mock.calls[0][0].nodes[0].disabled).toBe(false);

    onChange.mockClear();
    await user.click(screen.getByRole('button', { name: 'Select all namespaces' }));
    const allEnabled = onChange.mock.calls[0][0].namespaces[0];
    expect(allEnabled.disabled).toBe(false);
    expect(allEnabled.pods[0].disabled).toBe(false);
    expect(allEnabled.pods[0].containers[0].disabled).toBe(false);
    expect(allEnabled.services[0].disabled).toBe(false);
    expect(allEnabled.pvcs[0].disabled).toBe(false);
    expect(allEnabled.vmis?.[0].disabled).toBe(false);
  });
});
