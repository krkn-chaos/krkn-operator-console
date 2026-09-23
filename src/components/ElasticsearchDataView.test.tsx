import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ElasticsearchDataView } from './ElasticsearchDataView';
import { elasticsearchApi } from '../services/elasticsearchApi';
import type { ElasticsearchConfig, QueryTelemetryResponse } from '../types/api';

vi.mock('../services/elasticsearchApi');

// Mutable admin flag so individual tests can exercise the admin vs non-admin
// empty-state behavior via the mocked useRole hook.
let mockIsAdmin = false;
// Stable notification spies so tests can assert on the exact showError call.
const mockShowError = vi.hoisted(() => vi.fn());
const mockShowSuccess = vi.hoisted(() => vi.fn());
vi.mock('../hooks', () => ({
  useNotifications: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
  useRole: () => ({ isAdmin: mockIsAdmin }),
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
  stats: { pass: 1, fail: 0, pass_percent: 100 },
};

describe('ElasticsearchDataView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = false;
  });

  it('loads configs and populates the selector', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    render(<ElasticsearchDataView />);

    await waitFor(() => {
      expect(screen.getByText('prod-es')).toBeInTheDocument();
    });
  });

  it('does not render configs excluded by the access-controlled API response', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue([
      mockConfigs[0],
    ]);

    render(<ElasticsearchDataView />);

    await waitFor(() => {
      expect(screen.getByText('prod-es')).toBeInTheDocument();
    });
    expect(screen.queryByText('restricted-es')).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'restricted-es' })).not.toBeInTheDocument();
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

  it('renders the telemetry summary with overridden labels, values, and pass rate', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    // pass=3, fail=1 gives distinct values and a 75.0% pass rate computed by
    // JobStatsSummary from succeededJobs/totalJobs.
    vi.mocked(elasticsearchApi.queryTelemetry).mockResolvedValue({
      ...mockQueryResult,
      stats: { pass: 3, fail: 1, pass_percent: 75 },
    });
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');
    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));

    // Overridden card labels replace the job-flavored defaults.
    await waitFor(() => expect(screen.getByText('Total Runs')).toBeInTheDocument());
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Pass Rate')).toBeInTheDocument();

    // Values: total = pass + fail, passed = pass, failed = fail.
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    // Pass rate recomputed as succeeded / total.
    expect(screen.getByText('75.0%')).toBeInTheDocument();

    // Overridden card footers.
    expect(screen.getByText('Runs across matched window')).toBeInTheDocument();
    expect(screen.getByText('status = true')).toBeInTheDocument();
    expect(screen.getByText('status = false')).toBeInTheDocument();
    expect(screen.getByText('Percentage of runs that passed')).toBeInTheDocument();
  });

  it('shows an error notification and no results when the query request rejects', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    vi.mocked(elasticsearchApi.queryTelemetry).mockRejectedValue(new Error('boom'));
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');
    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));

    // Rejection surfaces the error message via the notification system.
    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith('Query failed', 'boom'),
    );

    // No telemetry is committed.
    expect(screen.queryByText('abc1234')).not.toBeInTheDocument();
    // Querying finished, so the button is interactive again.
    expect(screen.getByRole('button', { name: 'Run Query' })).toBeEnabled();
  });

  it('falls back to a generic message when the query rejects with a non-Error', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    vi.mocked(elasticsearchApi.queryTelemetry).mockRejectedValue('nope');
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');
    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith('Query failed', 'Could not query Elasticsearch'),
    );
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
      screen.getByText('Run a query to view telemetry data.'),
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
        screen.getByText('Run a query to view telemetry data.'),
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
    // Config creation is admin-only; the create controls only render for admins.
    mockIsAdmin = true;
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

  it('hides the Add new config control from non-admins when saved configs exist', async () => {
    // Non-admin (default). Saved configs load, but config creation is admin-only.
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Add new config' })).not.toBeInTheDocument();
  });

  it('shows an empty state and inline connect form when no configs exist', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue([]);
    render(<ElasticsearchDataView />);

    await waitFor(() => {
      expect(screen.getByText('No Saved Elasticsearch Configs')).toBeInTheDocument();
    });
    // Non-admins get the ephemeral connect form instead of a dead-end message.
    expect(screen.getByText('Connect without saving')).toBeInTheDocument();
    expect(screen.getByLabelText('Elasticsearch host')).toBeInTheDocument();
    expect(screen.getByLabelText('Telemetry index')).toBeInTheDocument();
  });

  it('runs an inline query without a saved config and renders rows', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue([]);
    vi.mocked(elasticsearchApi.queryTelemetryInline).mockResolvedValue(mockQueryResult);
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('Connect without saving')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Elasticsearch host'), 'https://es.example.com');
    await userEvent.type(screen.getByLabelText('Elasticsearch port'), '9200');
    await userEvent.type(screen.getByLabelText('Elasticsearch username'), 'user');
    await userEvent.type(screen.getByLabelText('Elasticsearch password'), 'secret');
    await userEvent.type(screen.getByLabelText('Telemetry index'), 'krkn-telemetry');

    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));

    await waitFor(() => {
      expect(elasticsearchApi.queryTelemetryInline).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'https://es.example.com',
          port: 9200,
          username: 'user',
          password: 'secret',
          telemetryIndex: 'krkn-telemetry',
        }),
        50,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      );
      expect(screen.getByText('abc1234')).toBeInTheDocument();
    });
    // Saved-config path must not be used for an inline query.
    expect(elasticsearchApi.queryTelemetry).not.toHaveBeenCalled();
  });

  it('disables the inline Run Query button until host and index are provided', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue([]);
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('Connect without saving')).toBeInTheDocument());

    const runButton = screen.getByRole('button', { name: 'Run Query' });
    expect(runButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Elasticsearch host'), 'https://es.example.com');
    expect(runButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Telemetry index'), 'krkn-telemetry');
    expect(runButton).toBeEnabled();
  });

  it('shows the Add Config button in the empty state for admins', async () => {
    mockIsAdmin = true;
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue([]);
    render(<ElasticsearchDataView />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add Config' })).toBeInTheDocument();
    });
    // The inline form is available to admins too.
    expect(screen.getByText('Connect without saving')).toBeInTheDocument();
  });
});
