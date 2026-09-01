import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VisualizeInstallCard } from '../VisualizeInstallCard';
import { visualizeApi } from '../../services/visualizeApi';
import { elasticsearchApi } from '../../services/elasticsearchApi';
import { targetsApi } from '../../services/targetsApi';
import type { VisualizeConfig, ElasticsearchConfig, TargetResponse } from '../../types/api';

// Mock the APIs
vi.mock('../../services/visualizeApi');
vi.mock('../../services/elasticsearchApi');
vi.mock('../../services/targetsApi');

// Mock the notification hook
vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

describe('VisualizeInstallCard', () => {
  const mockInstances: VisualizeConfig[] = [
    {
      name: 'test-visualize',
      targetCluster: 'test-cluster',
      namespace: 'krkn-visualize',
      grafanaPassword: 'secret',
      status: 'Ready',
      grafanaUrl: 'https://grafana.example.com',
    },
  ];

  const mockEsConfigs: ElasticsearchConfig[] = [
    {
      name: 'production-es',
      host: 'https://es.example.com',
      port: 9200,
      username: 'elastic',
    },
  ];

  const mockTargets: TargetResponse[] = [
    {
      uuid: 'target-1',
      clusterName: 'test-cluster',
      clusterAPIURL: 'https://api.test.com',
      secretType: 'kubeconfig',
      ready: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(visualizeApi.listInstances).mockResolvedValue(mockInstances);
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockEsConfigs);
    vi.mocked(targetsApi.listTargets).mockResolvedValue({ targets: mockTargets });
  });

  it('renders loading spinner initially', () => {
    vi.mocked(visualizeApi.listInstances).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    render(<VisualizeInstallCard />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays installed instances after loading', async () => {
    render(<VisualizeInstallCard />);

    await waitFor(() => {
      expect(screen.getByText('test-visualize')).toBeInTheDocument();
    });

    expect(screen.getByText('test-cluster')).toBeInTheDocument();
    expect(screen.getByText('krkn-visualize')).toBeInTheDocument();
  });

  it('shows empty state when no instances exist', async () => {
    vi.mocked(visualizeApi.listInstances).mockResolvedValue([]);

    render(<VisualizeInstallCard />);

    await waitFor(() => {
      expect(screen.getByText('No krkn-visualize Instances')).toBeInTheDocument();
    });
  });

  it('opens install modal when Install button is clicked', async () => {
    vi.mocked(visualizeApi.listInstances).mockResolvedValue([]);

    render(<VisualizeInstallCard />);

    await waitFor(() => {
      expect(screen.getByText('No krkn-visualize Instances')).toBeInTheDocument();
    });

    const installButton = screen.getByRole('button', { name: /Install krkn-visualize/i });
    fireEvent.click(installButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('displays status badge correctly', async () => {
    render(<VisualizeInstallCard />);

    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });
  });

  it('shows Grafana URL link when available', async () => {
    render(<VisualizeInstallCard />);

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /Open Dashboard/i });
      expect(link).toHaveAttribute('href', 'https://grafana.example.com');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  it('handles delete confirmation', async () => {
    render(<VisualizeInstallCard />);

    await waitFor(() => {
      expect(screen.getByText('test-visualize')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /Delete/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();
    });
  });
});
