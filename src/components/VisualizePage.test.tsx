import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { VisualizePage } from './VisualizePage';
import { visualizeApi } from '../services/visualizeApi';
import type { GrafanaDashboard, VisualizeConfig } from '../types/api';

vi.mock('../services/visualizeApi');
vi.mock('../hooks', () => ({
  useNotifications: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

const mockInstances: VisualizeConfig[] = [
  {
    name: 'prod-visualize',
    targetCluster: 'cluster1',
    namespace: 'krkn-visualize',
    status: 'Ready',
    grafanaUrl: 'https://grafana.cluster1.example.com',
  },
  {
    name: 'dev-visualize',
    targetCluster: 'cluster2',
    namespace: 'krkn-visualize',
    status: 'Ready',
    grafanaUrl: 'https://grafana.cluster2.example.com',
  },
  {
    name: 'pending-visualize',
    targetCluster: 'cluster3',
    namespace: 'krkn-visualize',
    status: 'Installing',
  },
];

const mockDashboards: GrafanaDashboard[] = [
  {
    uid: 'pod-scenarios',
    title: 'Pod Scenarios - Chaos Engineering',
    url: '/d/pod-scenarios/pod-scenarios',
    folderTitle: 'Chaos',
    type: 'dash-db',
  },
  {
    uid: 'node-overview',
    title: 'Node Overview',
    url: '/d/node-overview/node-overview',
    folderTitle: 'General',
    type: 'dash-db',
  },
];

describe('VisualizePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(visualizeApi.listInstances).mockResolvedValue(mockInstances);
    vi.mocked(visualizeApi.listDashboards).mockResolvedValue(mockDashboards);
  });

  it('prompts for instance selection before any panels load', async () => {
    render(<VisualizePage />);

    await waitFor(() => {
      expect(visualizeApi.listInstances).toHaveBeenCalled();
    });

    expect(screen.getByText('Select an instance to visualize')).toBeInTheDocument();
    // No dashboard request until an instance is selected.
    expect(visualizeApi.listDashboards).not.toHaveBeenCalled();
  });

  it('loads dashboards and embeds the first dashboard when an instance is selected', async () => {
    const user = userEvent.setup();
    render(<VisualizePage />);

    await waitFor(() => {
      expect(screen.getByText('Select instance')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Select krkn-visualize instance' }));
    await user.click(screen.getByRole('option', { name: /prod-visualize/ }));

    expect(await screen.findByTitle('Pod Scenarios - Chaos Engineering dashboard')).toBeInTheDocument();
    expect(visualizeApi.listDashboards).toHaveBeenCalledWith('prod-visualize');

    // First dashboard is auto-selected; the picker shows its title.
    expect(screen.getByRole('button', { name: 'Select dashboard' }).textContent).toContain(
      'Pod Scenarios - Chaos Engineering'
    );
  });

  it('builds the embed URL from the instance Grafana URL and dashboard path', async () => {
    const user = userEvent.setup();
    render(<VisualizePage />);

    await waitFor(() => {
      expect(screen.getByText('Select instance')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Select krkn-visualize instance' }));
    await user.click(screen.getByRole('option', { name: /dev-visualize/ }));

    const frame = await screen.findByTitle('Pod Scenarios - Chaos Engineering dashboard');
    expect(frame).toHaveAttribute(
      'src',
      'https://grafana.cluster2.example.com/d/pod-scenarios/pod-scenarios?kiosk=1&scenes=1&orgId=1'
    );
  });

  it('switches the embedded dashboard when another is selected', async () => {
    const user = userEvent.setup();
    render(<VisualizePage />);

    await waitFor(() => {
      expect(screen.getByText('Select instance')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Select krkn-visualize instance' }));
    await user.click(screen.getByRole('option', { name: /prod-visualize/ }));
    await screen.findByTitle('Pod Scenarios - Chaos Engineering dashboard');

    await user.click(screen.getByRole('button', { name: 'Select dashboard' }));
    await user.click(screen.getByRole('option', { name: 'Node Overview' }));

    expect(await screen.findByTitle('Node Overview dashboard')).toHaveAttribute(
      'src',
      expect.stringContaining('/d/node-overview/node-overview')
    );
  });

  it('only offers ready instances for selection', async () => {
    const user = userEvent.setup();
    render(<VisualizePage />);

    await waitFor(() => {
      expect(screen.getByText('Select instance')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Select krkn-visualize instance' }));

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(screen.queryByRole('option', { name: /pending-visualize/ })).not.toBeInTheDocument();
  });

  it('shows an empty state when no instances exist', async () => {
    vi.mocked(visualizeApi.listInstances).mockResolvedValue([]);

    render(<VisualizePage />);

    expect(
      await screen.findByText('No krkn-visualize instances')
    ).toBeInTheDocument();
    expect(visualizeApi.listDashboards).not.toHaveBeenCalled();
  });

  it('shows a not-ready empty state when no instance is Ready', async () => {
    vi.mocked(visualizeApi.listInstances).mockResolvedValue([mockInstances[2]]);

    render(<VisualizePage />);

    expect(
      await screen.findByText('No krkn-visualize instances are ready')
    ).toBeInTheDocument();
  });

  it('shows a retryable error state when listing instances fails', async () => {
    vi.mocked(visualizeApi.listInstances).mockRejectedValue(new Error('backend down'));

    render(<VisualizePage />);

    expect(await screen.findByText('Failed to load krkn-visualize instances')).toBeInTheDocument();
    expect(screen.getByText('backend down')).toBeInTheDocument();
  });

  it('shows an inline error when loading dashboards fails', async () => {
    vi.mocked(visualizeApi.listDashboards).mockRejectedValue(new Error('grafana unreachable'));

    const user = userEvent.setup();
    render(<VisualizePage />);

    await waitFor(() => {
      expect(screen.getByText('Select instance')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Select krkn-visualize instance' }));
    await user.click(screen.getByRole('option', { name: /prod-visualize/ }));

    expect(await screen.findByText('Failed to load dashboards')).toBeInTheDocument();
    expect(screen.getByText('grafana unreachable')).toBeInTheDocument();
  });
});
