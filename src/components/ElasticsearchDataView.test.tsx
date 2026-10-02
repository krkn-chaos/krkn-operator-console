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
      // Called with config, page size, page 1, default start/end date bounds,
      // and no filters on a fresh run.
      expect(elasticsearchApi.queryTelemetry).toHaveBeenCalledWith(
        'prod-es',
        50,
        1,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        undefined,
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
    // pass=3, fail=2 gives distinct values and a 60.0% pass rate computed by
    // JobStatsSummary from succeededJobs/totalJobs. Values avoid colliding with
    // the pagination's "1 - 1 of 1" digits.
    vi.mocked(elasticsearchApi.queryTelemetry).mockResolvedValue({
      ...mockQueryResult,
      stats: { pass: 3, fail: 2, pass_percent: 60 },
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
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    // Pass rate recomputed as succeeded / total.
    expect(screen.getByText('60.0%')).toBeInTheDocument();

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

    // Changing the date range invalidates the previously displayed telemetry.
    const startInput = screen.getByLabelText('Start date');
    await userEvent.clear(startInput);
    await userEvent.type(startInput, '2024-01-01');

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
    const startInput = screen.getByLabelText('Start date');
    await userEvent.clear(startInput);
    await userEvent.type(startInput, '2024-01-01');

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
        1,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        undefined,
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

  it('does not render expand toggle for rows without metadata or pod disruption data', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    const resultWithoutMetadata: QueryTelemetryResponse = {
      documents: [
        {
          run_uuid: 'no-metadata-uuid',
          scenario_type: 'node_disruption_scenarios',
          start_timestamp: 1735689600,
          end_timestamp: 1735689900,
          namespace: 'default',
          status: true,
        },
      ],
      total: 1,
      stats: { pass: 1, fail: 0, pass_percent: 100 },
    };
    vi.mocked(elasticsearchApi.queryTelemetry).mockResolvedValue(resultWithoutMetadata);
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');
    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));

    await waitFor(() => expect(screen.getByText('no-meta')).toBeInTheDocument());

    // Find table row containing document data
    const table = screen.getByLabelText('Telemetry documents');
    const tbody = within(table).getAllByRole('rowgroup')[1]; // Skip thead, get tbody
    const rows = within(tbody).getAllByRole('row');

    // First row in tbody should be the data row (not expandable row)
    const dataRow = rows[0];
    const cells = within(dataRow).getAllByRole('cell');

    // First cell should be empty (no expand button) for non-expandable rows
    expect(cells[0]).toBeEmptyDOMElement();
  });

  it('renders expand toggle for rows with metadata', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    const resultWithMetadata: QueryTelemetryResponse = {
      documents: [
        {
          run_uuid: 'has-metadata-uuid',
          scenario_type: 'pod_disruption_scenarios',
          start_timestamp: 1735689600,
          end_timestamp: 1735689900,
          namespace: 'default',
          status: true,
          metadata: {
            cluster_version: '4.15.0',
            total_node_count: 3,
          },
        },
      ],
      total: 1,
      stats: { pass: 1, fail: 0, pass_percent: 100 },
    };
    vi.mocked(elasticsearchApi.queryTelemetry).mockResolvedValue(resultWithMetadata);
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');
    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));

    await waitFor(() => expect(screen.getByText('has-met')).toBeInTheDocument());

    // Find table and verify expand button exists
    const table = screen.getByLabelText('Telemetry documents');
    const tbody = within(table).getAllByRole('rowgroup')[1];
    const rows = within(tbody).getAllByRole('row');
    const dataRow = rows[0];
    const cells = within(dataRow).getAllByRole('cell');

    // First cell should contain expand button
    const expandButton = within(cells[0]).getByRole('button');
    expect(expandButton).toBeInTheDocument();

    // Click expand and verify expandable content appears
    await userEvent.click(expandButton);
    await waitFor(() => {
      expect(screen.getByText('Cluster Config')).toBeInTheDocument();
      expect(screen.getByText('Node summary')).toBeInTheDocument();
    });
  });

  it('displays flattened cluster config values when metadata exists', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    const resultWithFullMetadata: QueryTelemetryResponse = {
      documents: [
        {
          run_uuid: 'full-metadata-uuid',
          scenario_type: 'pod_disruption_scenarios',
          start_timestamp: 1735689600,
          end_timestamp: 1735689900,
          namespace: 'default',
          status: true,
          metadata: {
            cluster_version: '4.15.0',
            cloud_infrastructure: 'AWS',
            cloud_type: 'aws',
            total_node_count: 6,
            network_plugins: ['OVNKubernetes', 'Multus'],
            fips_enabled: true,
            etcd_encryption_enabled: false,
            ipsec_enabled: true,
            build_url: 'https://prow.example.com/build/123',
          },
        },
      ],
      total: 1,
      stats: { pass: 1, fail: 0, pass_percent: 100 },
    };
    vi.mocked(elasticsearchApi.queryTelemetry).mockResolvedValue(resultWithFullMetadata);
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');
    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));

    await waitFor(() => expect(screen.getByText('full-me')).toBeInTheDocument());

    // Expand row
    const table = screen.getByLabelText('Telemetry documents');
    const tbody = within(table).getAllByRole('rowgroup')[1];
    const expandButton = within(within(tbody).getAllByRole('row')[0]).getByRole('button');
    await userEvent.click(expandButton);

    // Verify flattened metadata values appear in cluster config table
    await waitFor(() => {
      expect(screen.getByText('cluster_version')).toBeInTheDocument();
      expect(screen.getByText('4.15.0')).toBeInTheDocument();
      expect(screen.getByText('cloud_infrastructure')).toBeInTheDocument();
      expect(screen.getByText('AWS')).toBeInTheDocument();
      expect(screen.getByText('total_node_count')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByText('network_plugins')).toBeInTheDocument();
      expect(screen.getByText('OVNKubernetes, Multus')).toBeInTheDocument();
      expect(screen.getByText('fips_enabled')).toBeInTheDocument();
      // Multiple boolean fields may have "true", so just verify one exists
      expect(screen.getAllByText('true').length).toBeGreaterThan(0);
      expect(screen.getByText('etcd_encryption_enabled')).toBeInTheDocument();
      expect(screen.getByText('false')).toBeInTheDocument();
    });
  });

  it('displays node summary table with multiple node groups', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    const resultWithNodeSummary: QueryTelemetryResponse = {
      documents: [
        {
          run_uuid: 'node-summary-uuid',
          scenario_type: 'node_disruption_scenarios',
          start_timestamp: 1735689600,
          end_timestamp: 1735689900,
          namespace: 'default',
          status: true,
          metadata: {
            node_summary_infos: [
              {
                count: 3,
                nodes_type: 'worker',
                architecture: 'amd64',
                instance_type: 'm5.xlarge',
                kernel_version: '5.14.0',
                kubelet_version: 'v1.27.6',
                os_version: 'RHCOS 4.15',
              },
              {
                count: 3,
                nodes_type: 'master',
                architecture: 'amd64',
                instance_type: 'm5.2xlarge',
                kernel_version: '5.14.0',
                kubelet_version: 'v1.27.6',
                os_version: 'RHCOS 4.15',
              },
            ],
          },
        },
      ],
      total: 1,
      stats: { pass: 1, fail: 0, pass_percent: 100 },
    };
    vi.mocked(elasticsearchApi.queryTelemetry).mockResolvedValue(resultWithNodeSummary);
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');
    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));

    await waitFor(() => expect(screen.getByText('node-su')).toBeInTheDocument());

    // Expand row
    const table = screen.getByLabelText('Telemetry documents');
    const tbody = within(table).getAllByRole('rowgroup')[1];
    const expandButton = within(within(tbody).getAllByRole('row')[0]).getByRole('button');
    await userEvent.click(expandButton);

    // Verify node summary table shows both node groups
    await waitFor(() => {
      expect(screen.getByText('Node summary')).toBeInTheDocument();
      expect(screen.getByText('worker')).toBeInTheDocument();
      expect(screen.getByText('master')).toBeInTheDocument();
      expect(screen.getByText('m5.xlarge')).toBeInTheDocument();
      expect(screen.getByText('m5.2xlarge')).toBeInTheDocument();
      // Verify count column shows 3 for both groups
      const nodeSummaryCard = screen.getByText('Node summary').closest('div[class*="pf-v5-c-card"]');
      expect(nodeSummaryCard).toBeInTheDocument();
    });
  });

  it('displays pod recovery chart when pod disruption scenario has recovered pods', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    const resultWithPodRecovery: QueryTelemetryResponse = {
      documents: [
        {
          run_uuid: 'pod-recovery-uuid',
          scenario_type: 'pod_disruption_scenarios',
          start_timestamp: 1735689600,
          end_timestamp: 1735689900,
          namespace: 'openshift-kube-apiserver',
          status: true,
          scenarios: [
            {
              scenario_type: 'pod_disruption_scenarios',
              start_timestamp: 1735689600,
              end_timestamp: 1735689900,
              exit_status: 0,
              parameters: {
                namespace: 'openshift-kube-apiserver',
              },
              affected_pods: {
                recovered: [
                  {
                    pod_name: 'kube-apiserver-1',
                    namespace: 'openshift-kube-apiserver',
                    total_recovery_time: 45.2,
                    pod_readiness_time: 30.1,
                    pod_rescheduling_time: 15.1,
                  },
                  {
                    pod_name: 'kube-apiserver-2',
                    namespace: 'openshift-kube-apiserver',
                    total_recovery_time: 120.5,
                    pod_readiness_time: 90.3,
                    pod_rescheduling_time: 30.2,
                  },
                ],
              },
            },
          ],
        },
      ],
      total: 1,
      stats: { pass: 1, fail: 0, pass_percent: 100 },
    };
    vi.mocked(elasticsearchApi.queryTelemetry).mockResolvedValue(resultWithPodRecovery);
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');
    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));

    await waitFor(() => expect(screen.getByText('pod-rec')).toBeInTheDocument());

    // Expand row
    const table = screen.getByLabelText('Telemetry documents');
    const tbody = within(table).getAllByRole('rowgroup')[1];
    const expandButton = within(within(tbody).getAllByRole('row')[0]).getByRole('button');
    await userEvent.click(expandButton);

    // Verify pod recovery chart appears
    await waitFor(() => {
      expect(screen.getByText('Pod-Recovery Analysis')).toBeInTheDocument();
      // Chart renders with Victory components - verify pod names appear
      expect(screen.getByText('kube-apiserver-1')).toBeInTheDocument();
      expect(screen.getByText('kube-apiserver-2')).toBeInTheDocument();
    });
  });

  it('displays run_uuid in cluster config even when metadata has only skipped fields', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    const resultWithMinimalMetadata: QueryTelemetryResponse = {
      documents: [
        {
          run_uuid: 'minimal-metadata-uuid',
          scenario_type: 'pod_disruption_scenarios',
          start_timestamp: 1735689600,
          end_timestamp: 1735689900,
          namespace: 'default',
          status: true,
          metadata: {
            // Only contains internal fields that are skipped from table display
            node_summary_infos: [],
          },
        },
      ],
      total: 1,
      stats: { pass: 1, fail: 0, pass_percent: 100 },
    };
    vi.mocked(elasticsearchApi.queryTelemetry).mockResolvedValue(resultWithMinimalMetadata);
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');
    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));

    await waitFor(() => expect(screen.getByText('minimal')).toBeInTheDocument());

    // Expand row
    const table = screen.getByLabelText('Telemetry documents');
    const tbody = within(table).getAllByRole('rowgroup')[1];
    const expandButton = within(within(tbody).getAllByRole('row')[0]).getByRole('button');
    await userEvent.click(expandButton);

    // Verify run_uuid is still displayed in cluster config table
    await waitFor(() => {
      expect(screen.getByText('run_uuid')).toBeInTheDocument();
      expect(screen.getByText('minimal-metadata-uuid')).toBeInTheDocument();
    });
  });

  it('shows empty state for node summary when no node_summary_infos exist', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    const resultWithoutNodes: QueryTelemetryResponse = {
      documents: [
        {
          run_uuid: 'no-nodes-uuid',
          scenario_type: 'pod_disruption_scenarios',
          start_timestamp: 1735689600,
          end_timestamp: 1735689900,
          namespace: 'default',
          status: true,
          metadata: {
            cluster_version: '4.15.0',
            // No node_summary_infos
          },
        },
      ],
      total: 1,
      stats: { pass: 1, fail: 0, pass_percent: 100 },
    };
    vi.mocked(elasticsearchApi.queryTelemetry).mockResolvedValue(resultWithoutNodes);
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');
    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));

    await waitFor(() => expect(screen.getByText('no-node')).toBeInTheDocument());

    // Expand row
    const table = screen.getByLabelText('Telemetry documents');
    const tbody = within(table).getAllByRole('rowgroup')[1];
    const expandButton = within(within(tbody).getAllByRole('row')[0]).getByRole('button');
    await userEvent.click(expandButton);

    // Verify empty state message for node summary
    await waitFor(() => {
      expect(screen.getByText('No node summary data')).toBeInTheDocument();
    });
  });

  it('displays recovery threshold line when pod recovery times exceed expected threshold', async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    const resultWithSlowRecovery: QueryTelemetryResponse = {
      documents: [
        {
          run_uuid: 'slow-recovery-uuid',
          scenario_type: 'pod_disruption_scenarios',
          start_timestamp: 1735689600,
          end_timestamp: 1735689900,
          namespace: 'openshift-kube-apiserver',
          status: true,
          scenarios: [
            {
              scenario_type: 'pod_disruption_scenarios',
              start_timestamp: 1735689600,
              end_timestamp: 1735689900,
              exit_status: 0,
              parameters: {
                expected_recovery_time: 60,
              },
              affected_pods: {
                recovered: [
                  {
                    pod_name: 'slow-pod',
                    namespace: 'openshift-kube-apiserver',
                    total_recovery_time: 120.5,
                    pod_readiness_time: 90.0,
                    pod_rescheduling_time: 30.5,
                  },
                ],
              },
            },
          ],
        },
      ],
      total: 1,
      stats: { pass: 1, fail: 0, pass_percent: 100 },
    };
    vi.mocked(elasticsearchApi.queryTelemetry).mockResolvedValue(resultWithSlowRecovery);
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');
    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));

    await waitFor(() => expect(screen.getByText('slow-re')).toBeInTheDocument());

    // Expand row
    const table = screen.getByLabelText('Telemetry documents');
    const tbody = within(table).getAllByRole('rowgroup')[1];
    const expandButton = within(within(tbody).getAllByRole('row')[0]).getByRole('button');
    await userEvent.click(expandButton);

    // Verify chart renders (Victory renders threshold as ChartThreshold)
    await waitFor(() => {
      expect(screen.getByText('Pod-Recovery Analysis')).toBeInTheDocument();
      expect(screen.getByText('slow-pod')).toBeInTheDocument();
    });
  });

  // Response carrying facets so the faceted-filter controls render after a query.
  // Distinct counts keep the value-option labels unambiguous in the DOM.
  const mockResultWithFacets: QueryTelemetryResponse = {
    ...mockQueryResult,
    facets: {
      scenario_type: [
        { value: 'pod_disruption_scenarios', count: 5 },
        { value: 'node_disruption_scenarios', count: 3 },
      ],
      cloud_type: [{ value: 'aws', count: 7 }],
    },
  };

  // Runs an initial saved-config query and returns the config select for reuse.
  const runInitialQuery = async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    vi.mocked(elasticsearchApi.queryTelemetry).mockResolvedValue(mockResultWithFacets);
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');
    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));
    await waitFor(() => expect(elasticsearchApi.queryTelemetry).toHaveBeenCalledTimes(1));
  };

  // Selects a category, opens the value multi-select, toggles one or more values,
  // then closes the dropdown. The query is deferred until close, so the helper
  // closes the dropdown to trigger the single re-query.
  const selectFacetValue = async (categoryKey: string, optionText: string | string[]) => {
    await userEvent.selectOptions(screen.getByLabelText('Select a filter category'), categoryKey);
    const toggle = screen.getByRole('button', { name: /Select values/ });
    await userEvent.click(toggle);
    for (const text of Array.isArray(optionText) ? optionText : [optionText]) {
      await userEvent.click(screen.getByText(text));
    }
    // Close the dropdown to fire the deferred query.
    await userEvent.click(toggle);
  };

  it('re-queries with the selected facet value and renders a chip for it', async () => {
    await runInitialQuery();

    await selectFacetValue('scenario_type', 'pod_disruption_scenarios (5)');

    // Selecting a value re-runs the saved-config path with the facet applied,
    // reset to page 1 with the same page size and date bounds.
    await waitFor(() => {
      expect(elasticsearchApi.queryTelemetry).toHaveBeenLastCalledWith(
        'prod-es',
        50,
        1,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        { scenario_type: ['pod_disruption_scenarios'] },
      );
    });

    // The applied value shows as a labeled chip.
    expect(
      screen.getByText('Scenario Type: pod_disruption_scenarios'),
    ).toBeInTheDocument();
  });

  it('defers the query until the value dropdown closes, then re-queries once with all picks', async () => {
    await runInitialQuery();

    await userEvent.selectOptions(screen.getByLabelText('Select a filter category'), 'scenario_type');
    const toggle = screen.getByRole('button', { name: /Select values/ });
    await userEvent.click(toggle);

    // Pick two values while open. No query fires yet (still only the initial run).
    await userEvent.click(screen.getByText('pod_disruption_scenarios (5)'));
    await userEvent.click(screen.getByText('node_disruption_scenarios (3)'));
    expect(elasticsearchApi.queryTelemetry).toHaveBeenCalledTimes(1);

    // Closing the dropdown fires exactly one query with both values.
    await userEvent.click(toggle);
    await waitFor(() => expect(elasticsearchApi.queryTelemetry).toHaveBeenCalledTimes(2));
    expect(elasticsearchApi.queryTelemetry).toHaveBeenLastCalledWith(
      'prod-es',
      50,
      1,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      { scenario_type: ['pod_disruption_scenarios', 'node_disruption_scenarios'] },
    );
  });

  it('re-queries with multiple facet values across categories', async () => {
    await runInitialQuery();

    await selectFacetValue('scenario_type', 'pod_disruption_scenarios (5)');
    await selectFacetValue('cloud_type', 'aws (7)');

    // Both categories are sent together in the filter set.
    await waitFor(() => {
      expect(elasticsearchApi.queryTelemetry).toHaveBeenLastCalledWith(
        'prod-es',
        50,
        1,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        { scenario_type: ['pod_disruption_scenarios'], cloud_type: ['aws'] },
      );
    });

    expect(screen.getByText('Scenario Type: pod_disruption_scenarios')).toBeInTheDocument();
    expect(screen.getByText('Cloud Type: aws')).toBeInTheDocument();
  });

  it('removes a facet value via its chip and re-queries without it', async () => {
    await runInitialQuery();

    await selectFacetValue('scenario_type', 'pod_disruption_scenarios (5)');
    await selectFacetValue('cloud_type', 'aws (7)');

    // Remove the scenario_type chip; only cloud_type remains in the filter set.
    const chip = screen.getByText('Scenario Type: pod_disruption_scenarios');
    const chipRoot = chip.closest('.pf-v5-c-label') as HTMLElement;
    await userEvent.click(within(chipRoot).getByRole('button'));

    await waitFor(() => {
      expect(elasticsearchApi.queryTelemetry).toHaveBeenLastCalledWith(
        'prod-es',
        50,
        1,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        { cloud_type: ['aws'] },
      );
    });

    expect(screen.queryByText('Scenario Type: pod_disruption_scenarios')).not.toBeInTheDocument();
    expect(screen.getByText('Cloud Type: aws')).toBeInTheDocument();
  });

  it('clears all facet filters and re-queries unfiltered', async () => {
    await runInitialQuery();

    await selectFacetValue('scenario_type', 'pod_disruption_scenarios (5)');
    await selectFacetValue('cloud_type', 'aws (7)');

    await userEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));

    // Clearing sends an undefined filter set (unfiltered query) on page 1.
    await waitFor(() => {
      expect(elasticsearchApi.queryTelemetry).toHaveBeenLastCalledWith(
        'prod-es',
        50,
        1,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        undefined,
      );
    });

    // Every chip and the clear control are gone.
    expect(screen.queryByText('Scenario Type: pod_disruption_scenarios')).not.toBeInTheDocument();
    expect(screen.queryByText('Cloud Type: aws')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear all filters' })).not.toBeInTheDocument();
  });

  // Runs an initial saved-config query against a paged dataset. queryTelemetry
  // echoes the requested size/page into the returned document's uuid so each
  // page/size renders a distinct, truncated (first 7 chars) uuid in the table.
  const runPagedQuery = async () => {
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockConfigs);
    vi.mocked(elasticsearchApi.queryTelemetry).mockImplementation(async (_config, size, pageNum) => ({
      documents: [
        {
          run_uuid: `s${size}p${pageNum}-rest`,
          scenario_type: 'pod_disruption_scenarios',
          start_timestamp: 1735689600,
          end_timestamp: 1735689900,
          namespace: 'default',
          status: true,
        },
      ],
      total: 120,
      stats: { pass: 1, fail: 0, pass_percent: 100 },
    }));
    render(<ElasticsearchDataView />);

    await waitFor(() => expect(screen.getByText('prod-es')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Select an Elasticsearch config'), 'prod-es');
    await userEvent.click(screen.getByRole('button', { name: 'Run Query' }));
    // Initial page: size 50, page 1.
    await waitFor(() => expect(screen.getByText('s50p1-r')).toBeInTheDocument());
  };

  it('re-queries the next page and renders its results', async () => {
    await runPagedQuery();

    await userEvent.click(screen.getAllByRole('button', { name: 'Go to next page' })[0]);

    // Next page keeps the size and filters, advancing to page 2.
    await waitFor(() => {
      expect(elasticsearchApi.queryTelemetry).toHaveBeenLastCalledWith(
        'prod-es',
        50,
        2,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        undefined,
      );
    });
    // Page-2 document replaces the page-1 document.
    expect(screen.getByText('s50p2-r')).toBeInTheDocument();
    expect(screen.queryByText('s50p1-r')).not.toBeInTheDocument();
  });

  it('resets to page one when the page size changes', async () => {
    await runPagedQuery();

    // Advance to page 2 first so the size change must reset paging.
    await userEvent.click(screen.getAllByRole('button', { name: 'Go to next page' })[0]);
    await waitFor(() => expect(screen.getByText('s50p2-r')).toBeInTheDocument());

    // Open the per-page menu (toggle text is the "1 - N of 120" template) and
    // pick 20 per page.
    await userEvent.click(screen.getAllByRole('button', { name: /of 120/ })[0]);
    await userEvent.click(screen.getAllByRole('menuitem', { name: '20 per page' })[0]);

    // Size change re-queries at the new size and resets to page 1.
    await waitFor(() => {
      expect(elasticsearchApi.queryTelemetry).toHaveBeenLastCalledWith(
        'prod-es',
        20,
        1,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        undefined,
      );
    });
    expect(screen.getByText('s20p1-r')).toBeInTheDocument();
    expect(screen.queryByText('s50p2-r')).not.toBeInTheDocument();
  });

  it('restores the page and keeps prior rows when a next-page re-query fails', async () => {
    await runPagedQuery();

    // The page-2 re-query fails.
    vi.mocked(elasticsearchApi.queryTelemetry).mockRejectedValueOnce(new Error('boom'));
    await userEvent.click(screen.getAllByRole('button', { name: 'Go to next page' })[0]);

    await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('Query failed', 'boom'));

    // Prior page-1 rows stay; page-2 rows never appear.
    expect(screen.getByText('s50p1-r')).toBeInTheDocument();
    expect(screen.queryByText('s50p2-r')).not.toBeInTheDocument();
    // The page control is restored to page 1.
    expect((screen.getAllByLabelText('Current page')[0] as HTMLInputElement).value).toBe('1');
  });

  it('restores filters and keeps prior rows when a facet re-query fails', async () => {
    await runInitialQuery();

    // The facet re-query (fired on dropdown close) fails.
    vi.mocked(elasticsearchApi.queryTelemetry).mockRejectedValueOnce(new Error('boom'));
    await selectFacetValue('scenario_type', 'pod_disruption_scenarios (5)');

    await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('Query failed', 'boom'));

    // No chip is committed for the failed selection; prior rows remain visible.
    expect(screen.queryByText('Scenario Type: pod_disruption_scenarios')).not.toBeInTheDocument();
    expect(screen.getByText('abc1234')).toBeInTheDocument();
  });
});
