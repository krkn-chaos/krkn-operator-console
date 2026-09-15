import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ElasticsearchDataView } from './ElasticsearchDataView';
import { elasticsearchApi } from '../services/elasticsearchApi';
import type { ElasticsearchConfig, QueryTelemetryResponse } from '../types/api';

vi.mock('../services/elasticsearchApi');
vi.mock('../hooks', () => ({
  useNotifications: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

const mockConfigs: ElasticsearchConfig[] = [
  { name: 'prod-es', host: 'https://es.example.com', port: 9200, telemetryIndex: 'krkn-telemetry' },
];

const mockQueryResult: QueryTelemetryResponse = {
  documents: [
    {
      run_uuid: 'abc1234-rest-of-uuid',
      scenario_type: 'pod_disruption_scenarios',
      start_timestamp: 1735689600,
      end_timestamp: 1735689900,
      namespace: 'openshift-kube-apiserver',
      status: true,
    },
  ],
  total: 1,
};

describe('ElasticsearchDataView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads configs and populates the selector', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    render(<ElasticsearchDataView />);

    await waitFor(() => {
      expect(screen.getByText('prod-es')).toBeInTheDocument();
    });
  });

  it('runs a query and renders telemetry rows in the table', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    vi.mocked(elasticsearchApi.queryTelemetry).mockResolvedValue(mockQueryResult);
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());

    const select = screen.getByLabelText('Select an Elasticsearch config');
    await userEvent.selectOptions(select, 'prod-es');

    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));

    await waitFor(() => {
      // Called with config, size, and the default start/end date bounds.
      expect(elasticsearchApi.queryTelemetry).toHaveBeenCalledWith(
        'prod-es',
        50,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      );
      // UUID is truncated to the first 7 characters.
      expect(screen.getByText('abc1234')).toBeInTheDocument();
      expect(screen.getByText('pod_disruption_scenarios')).toBeInTheDocument();
      expect(screen.getByText('openshift-kube-apiserver')).toBeInTheDocument();
      expect(screen.getByText('Pass')).toBeInTheDocument();
    });
  });

  it('clears displayed results when a query criterion changes', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    vi.mocked(elasticsearchApi.queryTelemetry).mockResolvedValue(mockQueryResult);
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');
    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));

    await waitFor(() => expect(screen.getByText('abc1234')).toBeInTheDocument());

    // Changing the result limit invalidates the previously displayed telemetry.
    const sizeInput = screen.getByLabelText('Max results');
    await userEvent.clear(sizeInput);
    await userEvent.type(sizeInput, '25');

    expect(screen.queryByText('abc1234')).not.toBeInTheDocument();
    expect(
      screen.getByText('Select a config and run a query to view telemetry data.'),
    ).toBeInTheDocument();
  });

  it('discards a stale response when criteria change before it resolves', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);

    // Defer the query response so we can change criteria while it is in flight.
    let resolveQuery: (value: QueryTelemetryResponse) => void = () => {};
    vi.mocked(elasticsearchApi.queryTelemetry).mockReturnValue(
      new Promise<QueryTelemetryResponse>((resolve) => {
        resolveQuery = resolve;
      }),
    );

    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');
    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));

    // Change a criterion while the first response is still pending.
    const sizeInput = screen.getByLabelText('Max results');
    await userEvent.clear(sizeInput);
    await userEvent.type(sizeInput, '25');

    // The in-flight response now resolves, but it is stale and must be ignored.
    resolveQuery(mockQueryResult);

    await waitFor(() =>
      expect(
        screen.getByText('Select a config and run a query to view telemetry data.'),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText('abc1234')).not.toBeInTheDocument();
  });

  it('blocks the query when the end date is in the future', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    vi.mocked(elasticsearchApi.queryTelemetry).mockResolvedValue(mockQueryResult);
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');

    const endInput = screen.getByLabelText('End date');
    await userEvent.clear(endInput);
    await userEvent.type(endInput, '2099-12-31');

    const runButton = screen.getByRole('button', { name: 'Run Query' });
    expect(runButton).toBeDisabled();

    await userEvent.click(runButton);
    expect(elasticsearchApi.queryTelemetry).not.toHaveBeenCalled();
  });

  it('blocks the query and shows an inline error when max results is out of range', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    vi.mocked(elasticsearchApi.queryTelemetry).mockResolvedValue(mockQueryResult);
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');

    const sizeInput = screen.getByLabelText('Max results');
    await userEvent.clear(sizeInput);
    await userEvent.type(sizeInput, '999999');

    expect(screen.getByText('Max results must be between 1 and 10000')).toBeInTheDocument();

    const runButton = screen.getByRole('button', { name: 'Run Query' });
    expect(runButton).toBeDisabled();

    await userEvent.click(runButton);
    expect(elasticsearchApi.queryTelemetry).not.toHaveBeenCalled();
  });

  it('omits the size limit when max results is left empty', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    vi.mocked(elasticsearchApi.queryTelemetry).mockResolvedValue(mockQueryResult);
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');

    const sizeInput = screen.getByLabelText('Max results');
    await userEvent.clear(sizeInput);

    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));

    await waitFor(() => {
      // Empty input intentionally omits the limit (undefined size).
      expect(elasticsearchApi.queryTelemetry).toHaveBeenCalledWith(
        'prod-es',
        undefined,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      );
    });
  });

  it('creates a config, refreshes the list, closes the modal, and selects the new config', async () => {
    const newConfig: ElasticsearchConfig = {
      name: 'staging-es',
      host: 'https://staging.example.com',
      port: 9200,
      telemetryIndex: 'krkn-telemetry',
    };

    // listConfigs reflects server state: the new config only appears after it
    // has been created. (Stateful rather than call-ordered because the mocked
    // useNotifications returns a fresh callback each render, which can re-run
    // the load effect.)
    // Stable array references: the mocked useNotifications returns a fresh
    // callback each render, which re-runs the load effect; returning a new
    // array each call would make setConfigs re-render endlessly.
    const configsAfterCreate = [...mockConfigs, newConfig];
    let created = false;
    vi.mocked(elasticsearchApi.listConfigs).mockImplementation(async () =>
      created ? configsAfterCreate : mockConfigs,
    );
    vi.mocked(elasticsearchApi.createConfig).mockImplementation(async () => {
      created = true;
      return { name: newConfig.name, message: 'created' };
    });

    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());

    // Open the create modal.
    await userEvent.click(screen.getByRole('button', { name: 'Add new config' }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByPlaceholderText(/lowercase alphanumeric and hyphens/),
      newConfig.name,
    );
    const hostInput = within(dialog).getByPlaceholderText('https://es.example.com');
    await userEvent.clear(hostInput);
    await userEvent.type(hostInput, newConfig.host);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    // The config is created with the submitted values.
    await waitFor(() => {
      expect(elasticsearchApi.createConfig).toHaveBeenCalledWith(
        expect.objectContaining({ name: newConfig.name, host: newConfig.host }),
      );
    });

    // The list is refreshed after creation.
    await waitFor(() => expect(screen.getByText('staging-es')).toBeInTheDocument());

    // The modal closes and the newly created config becomes the selection.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    const select = screen.getByLabelText('Select an Elasticsearch config') as HTMLSelectElement;
    expect(select.value).toBe(newConfig.name);
  });

  it('shows an empty state when no configs exist', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue([]);
    render(<ElasticsearchDataView />);

    await waitFor(() => {
      expect(screen.getByText('No Elasticsearch Configs')).toBeInTheDocument();
    });
  });
});
