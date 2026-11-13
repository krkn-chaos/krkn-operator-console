import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ElasticsearchAlertsTab } from './ElasticsearchAlertsTab';
import { elasticsearchApi } from '../services/elasticsearchApi';
import type { ElasticsearchConfig, QueryAlertsResponse } from '../types/api';

vi.mock('../services/elasticsearchApi');

const showError = vi.hoisted(() => vi.fn());
vi.mock('../hooks', () => ({
  useNotifications: () => ({ showError }),
}));

const config: ElasticsearchConfig = {
  name: 'prod-es',
  host: 'https://es.example.com',
  port: 9200,
  alertsIndex: 'krkn-alerts',
};

const result: QueryAlertsResponse = {
  documents: [
    {
      id: 'alert-1',
      source: {
        run_uuid: 'run-1',
        phase: 'during',
        created_at: '2026-09-25T14:32:18Z',
        severity: 'critical',
        alertname: 'KubeAPIServerLatencyHigh',
        labels: { component: 'apiserver' },
      },
    },
    {
      id: 'alert-2',
      source: {
        run_uuid: 'run-2',
        phase: 'post',
        created_at: '2026-09-24T09:15:42Z',
        severity: 'warning',
        alertname: 'NodeFilesystemAlmostFull',
        labels: { component: 'node-exporter' },
      },
    },
  ],
  total: 2,
};

function renderAlerts() {
  return render(
    <ElasticsearchAlertsTab
      configs={[config]}
      selectedConfig="prod-es"
      startDate="2026-09-20"
      onStartDateChange={vi.fn()}
      endDate="2026-09-29"
      onEndDateChange={vi.fn()}
      size="50"
      onSizeChange={vi.fn()}
    />,
  );
}

describe('ElasticsearchAlertsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(elasticsearchApi.queryAlerts).mockResolvedValue(result);
  });

  it('queries and renders formatted alert rows', async () => {
    const user = userEvent.setup();
    renderAlerts();

    await user.click(screen.getByRole('button', { name: 'Query Alerts' }));

    await waitFor(() => expect(screen.getByText('KubeAPIServerLatencyHigh')).toBeInTheDocument());
    expect(screen.getByText('run-1')).toBeInTheDocument();
    expect(screen.getByText('during')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getAllByText('labels.component:').length).toBeGreaterThan(0);
    expect(screen.getAllByText('apiserver').length).toBeGreaterThan(0);
    expect(elasticsearchApi.queryAlerts).toHaveBeenCalledWith('prod-es', 50, '2026-09-20', '2026-09-29');
  });

  it('queries the server with active filters when sorting', async () => {
    const user = userEvent.setup();
    vi.mocked(elasticsearchApi.queryAlerts).mockReset();
    const filteredAlert = {
      ...result.documents[0],
      source: { ...(result.documents[0].source as Record<string, unknown>), alertname: 'FilteredServerResult' },
    };
    vi.mocked(elasticsearchApi.queryAlerts).mockImplementation((...args) => {
      if (!args[4]) return Promise.resolve(result);
      const hasFilters = args.length === 6;
      return Promise.resolve({
        documents: [hasFilters ? filteredAlert : result.documents[1]],
        total: hasFilters ? 1 : 50,
        sortBy: args[4].sortBy,
        sortOrder: args[4].sortOrder,
      });
    });
    renderAlerts();
    await user.click(screen.getByRole('button', { name: 'Query Alerts' }));
    await screen.findByText('KubeAPIServerLatencyHigh');

    await user.selectOptions(screen.getByLabelText('Filter category'), 'phase');
    await user.selectOptions(screen.getByLabelText('Filter values'), 'during');
    await user.click(screen.getByRole('button', { name: 'Add filter' }));

    await user.click(screen.getByRole('button', { name: 'Sort by Phase' }));
    await waitFor(() => {
      expect(elasticsearchApi.queryAlerts).toHaveBeenLastCalledWith(
        'prod-es', 50, '2026-09-20', '2026-09-29',
        { sortBy: 'phase', sortOrder: 'asc' },
        [{ key: 'phase', value: 'during' }],
      );
    });
    await screen.findByText('FilteredServerResult');
    expect(elasticsearchApi.queryAlerts).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Phase: during')).toBeInTheDocument();
    expect(screen.queryByText('No alerts match the filters')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sort Phase descending' }));
    await waitFor(() => {
      expect(elasticsearchApi.queryAlerts).toHaveBeenLastCalledWith(
        'prod-es', 50, '2026-09-20', '2026-09-29',
        { sortBy: 'phase', sortOrder: 'desc' },
        [{ key: 'phase', value: 'during' }],
      );
    });
    expect(elasticsearchApi.queryAlerts).toHaveBeenCalledTimes(3);
    expect(screen.getByText('FilteredServerResult')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(await screen.findByText('NodeFilesystemAlmostFull')).toBeInTheDocument();
  });

  it('server-sorts by severity', async () => {
    const user = userEvent.setup();
    renderAlerts();
    await user.click(screen.getByRole('button', { name: 'Query Alerts' }));
    await screen.findByText('KubeAPIServerLatencyHigh');

    // Severity is the default active column (ascending), so the first click
    // toggles to descending.
    await user.click(screen.getByRole('button', { name: 'Sort Severity descending' }));
    await waitFor(() => {
      expect(elasticsearchApi.queryAlerts).toHaveBeenLastCalledWith(
        'prod-es', 50, '2026-09-20', '2026-09-29',
        { sortBy: 'severity', sortOrder: 'desc' },
      );
    });
  });

  it('offers sorting for UUID while leaving arbitrary Alert fields unsortable', async () => {
    const user = userEvent.setup();
    renderAlerts();
    await user.click(screen.getByRole('button', { name: 'Query Alerts' }));
    await screen.findByText('KubeAPIServerLatencyHigh');

    expect(screen.getByRole('button', { name: 'Sort by UUID' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sort by Alert fields/ })).not.toBeInTheDocument();
  });

  it('disables the query when the end date is in the future', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const futureDate = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, '0'),
      String(tomorrow.getDate()).padStart(2, '0'),
    ].join('-');

    render(
      <ElasticsearchAlertsTab
        configs={[config]}
        selectedConfig="prod-es"
        startDate="2026-09-20"
        onStartDateChange={vi.fn()}
        endDate={futureDate}
        onEndDateChange={vi.fn()}
        size="50"
        onSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Query Alerts' })).toBeDisabled();
    expect(elasticsearchApi.queryAlerts).not.toHaveBeenCalled();
  });

  it('filters results using an added field filter', async () => {
    const user = userEvent.setup();
    renderAlerts();
    await user.click(screen.getByRole('button', { name: 'Query Alerts' }));
    await screen.findByText('KubeAPIServerLatencyHigh');

    await user.selectOptions(screen.getByLabelText('Filter category'), 'severity');
    await user.selectOptions(screen.getByLabelText('Filter values'), 'critical');
    await user.click(screen.getByRole('button', { name: 'Add filter' }));

    expect(screen.getByText('KubeAPIServerLatencyHigh')).toBeInTheDocument();
    expect(screen.queryByText('NodeFilesystemAlmostFull')).not.toBeInTheDocument();
    expect(screen.getByText('Severity: critical')).toBeInTheDocument();
  });

  it('filters results by run_uuid', async () => {
    const user = userEvent.setup();
    renderAlerts();
    await user.click(screen.getByRole('button', { name: 'Query Alerts' }));
    await screen.findByText('KubeAPIServerLatencyHigh');

    await user.selectOptions(screen.getByLabelText('Filter category'), 'run_uuid');
    await user.type(screen.getByLabelText('Filter values'), 'run-2');
    await user.click(screen.getByRole('button', { name: 'Add filter' }));

    expect(screen.getByText('NodeFilesystemAlmostFull')).toBeInTheDocument();
    expect(screen.queryByText('KubeAPIServerLatencyHigh')).not.toBeInTheDocument();
    expect(screen.getByText('UUID: run-2')).toBeInTheDocument();
  });

  it('filters results by phase enum', async () => {
    const user = userEvent.setup();
    renderAlerts();
    await user.click(screen.getByRole('button', { name: 'Query Alerts' }));
    await screen.findByText('KubeAPIServerLatencyHigh');

    await user.selectOptions(screen.getByLabelText('Filter category'), 'phase');
    await user.selectOptions(screen.getByLabelText('Filter values'), 'post');
    await user.click(screen.getByRole('button', { name: 'Add filter' }));

    expect(screen.getByText('NodeFilesystemAlmostFull')).toBeInTheDocument();
    expect(screen.queryByText('KubeAPIServerLatencyHigh')).not.toBeInTheDocument();
    expect(screen.getByText('Phase: post')).toBeInTheDocument();
  });

  it('clears an enum value when switching filter fields', async () => {
    const user = userEvent.setup();
    renderAlerts();

    await user.selectOptions(screen.getByLabelText('Filter category'), 'severity');
    await user.selectOptions(screen.getByLabelText('Filter values'), 'critical');
    await user.selectOptions(screen.getByLabelText('Filter category'), 'phase');

    expect(screen.getByLabelText('Filter values')).toHaveValue('');
  });
});
