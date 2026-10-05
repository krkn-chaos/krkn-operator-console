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
        phase: 'Running',
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
        phase: 'Completed',
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
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getAllByText('labels.component:').length).toBeGreaterThan(0);
    expect(screen.getAllByText('apiserver').length).toBeGreaterThan(0);
    expect(elasticsearchApi.queryAlerts).toHaveBeenCalledWith('prod-es', 50, '2026-09-20', '2026-09-29');
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

    await user.selectOptions(screen.getByLabelText('Filter'), 'severity');
    await user.type(screen.getByLabelText('Value'), 'critical');
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

    await user.selectOptions(screen.getByLabelText('Filter'), 'run_uuid');
    await user.type(screen.getByLabelText('Value'), 'run-2');
    await user.click(screen.getByRole('button', { name: 'Add filter' }));

    expect(screen.getByText('NodeFilesystemAlmostFull')).toBeInTheDocument();
    expect(screen.queryByText('KubeAPIServerLatencyHigh')).not.toBeInTheDocument();
    expect(screen.getByText('UUID: run-2')).toBeInTheDocument();
  });
});
