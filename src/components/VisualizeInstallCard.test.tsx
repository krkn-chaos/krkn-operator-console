import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { VisualizeInstallCard } from './VisualizeInstallCard';
import { visualizeApi } from '../services/visualizeApi';
import { elasticsearchApi } from '../services/elasticsearchApi';
import { targetsApi } from '../services/targetsApi';
import type { VisualizeConfig, ElasticsearchConfig, TargetResponse } from '../types/api';

vi.mock('../services/visualizeApi');
vi.mock('../services/elasticsearchApi');
vi.mock('../services/targetsApi');
vi.mock('../hooks', () => ({
  useNotifications: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

describe('VisualizeInstallCard', () => {
  const mockInstances: VisualizeConfig[] = [
    {
      name: 'test-visualize',
      targetCluster: 'cluster1',
      namespace: 'krkn-visualize',
      status: 'Ready',
      grafanaUrl: 'https://grafana.example.com',
    },
  ];

  const mockESConfigs: ElasticsearchConfig[] = [
    {
      name: 'prod-es',
      host: 'elasticsearch.example.com',
      port: 9200,
    },
  ];

  const mockTargets: TargetResponse[] = [
    {
      uuid: 'target-1',
      clusterName: 'cluster1',
      clusterAPIURL: 'https://api.cluster1.example.com:6443',
      ready: true,
    },
    {
      uuid: 'target-2',
      clusterName: 'cluster2',
      clusterAPIURL: 'https://api.cluster2.example.com:6443',
      ready: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(visualizeApi.listInstances).mockResolvedValue(mockInstances);
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue(mockESConfigs);
    vi.mocked(targetsApi.listTargets).mockResolvedValue(mockTargets);
  });

  describe('Initial render and data loading', () => {
    it('should load and display instances, ES configs, and targets', async () => {
      render(<VisualizeInstallCard />);

      // Wait for data to load
      await waitFor(() => {
        expect(visualizeApi.listInstances).toHaveBeenCalled();
        expect(elasticsearchApi.listConfigs).toHaveBeenCalled();
        expect(targetsApi.listTargets).toHaveBeenCalled();
      });

      // Check instance is rendered
      expect(screen.getByText('test-visualize')).toBeInTheDocument();
    });

    it('should display empty state when no instances exist', async () => {
      vi.mocked(visualizeApi.listInstances).mockResolvedValue([]);

      render(<VisualizeInstallCard />);

      await waitFor(() => {
        expect(screen.getByText('No krkn-visualize Instances')).toBeInTheDocument();
      });
    });
  });

  describe('Install form submission', () => {
    it('should open install form when "Install krkn-visualize" button is clicked', async () => {
      const user = userEvent.setup();
      render(<VisualizeInstallCard />);

      const installButton = await screen.findByRole('button', { name: /Install krkn-visualize/i });
      await user.click(installButton);

      // Form should open
      expect(screen.getByText('Install krkn-visualize')).toBeInTheDocument();
      expect(screen.getByLabelText('Instance Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Target Clusters')).toBeInTheDocument();
    });

    it('should call createInstance with form data when submitting', async () => {
      const user = userEvent.setup();
      vi.mocked(visualizeApi.createInstance).mockResolvedValue(undefined);

      render(<VisualizeInstallCard />);

      // Open install modal
      const installButton = await screen.findByRole('button', { name: /Install krkn-visualize/i });
      await user.click(installButton);

      // Fill form
      const nameInput = screen.getByLabelText('Instance Name');
      await user.type(nameInput, 'my-visualize');

      // Select target cluster
      const clusterSelect = screen.getByLabelText('Target Clusters');
      await user.click(clusterSelect);
      const clusterOption = screen.getByText('cluster1');
      await user.click(clusterOption);

      // Select ES config
      const esSelect = screen.getByLabelText('Elasticsearch Configuration');
      await user.click(esSelect);
      const esOption = screen.getByText(/prod-es/);
      await user.click(esOption);

      // Enter password
      const passwordInput = screen.getByLabelText('Grafana Admin Password');
      await user.type(passwordInput, 'securePassword123');

      // Submit
      const submitButton = screen.getByRole('button', { name: /Install krkn-visualize/i });
      await user.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(visualizeApi.createInstance).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'my-visualize',
            targetClusters: ['cluster1'],
            elasticsearchConfigName: 'prod-es',
            grafanaPassword: 'securePassword123',
          })
        );
      });
    });

    it('should validate required fields before submitting', async () => {
      const user = userEvent.setup();
      render(<VisualizeInstallCard />);

      // Open install modal
      const installButton = await screen.findByRole('button', { name: /Install krkn-visualize/i });
      await user.click(installButton);

      // Try to submit without filling required fields
      const submitButton = screen.getByRole('button', { name: /Install krkn-visualize/i });
      await user.click(submitButton);

      // Should not call API
      expect(visualizeApi.createInstance).not.toHaveBeenCalled();

      // Should show error for missing fields
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
  });

  describe('Delete functionality', () => {
    it('should open delete confirmation modal when Delete button is clicked', async () => {
      const user = userEvent.setup();
      render(<VisualizeInstallCard />);

      await waitFor(() => {
        expect(screen.getByText('test-visualize')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /Delete/i });
      await user.click(deleteButton);

      // Confirmation modal should open
      expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    });

    it('should call deleteInstance when deletion is confirmed', async () => {
      const user = userEvent.setup();
      vi.mocked(visualizeApi.deleteInstance).mockResolvedValue(undefined);
      vi.mocked(visualizeApi.listInstances).mockResolvedValue([]); // Return empty after delete

      render(<VisualizeInstallCard />);

      // Wait for instance to load
      await waitFor(() => {
        expect(screen.getByText('test-visualize')).toBeInTheDocument();
      });

      // Click delete
      const deleteButton = screen.getByRole('button', { name: /Delete/i });
      await user.click(deleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /Delete/i });
      await user.click(confirmButton);

      // Verify API call
      await waitFor(() => {
        expect(visualizeApi.deleteInstance).toHaveBeenCalledWith('test-visualize');
      });
    });

    it('should close modal when cancelling deletion', async () => {
      const user = userEvent.setup();
      render(<VisualizeInstallCard />);

      await waitFor(() => {
        expect(screen.getByText('test-visualize')).toBeInTheDocument();
      });

      // Click delete
      const deleteButton = screen.getByRole('button', { name: /Delete/i });
      await user.click(deleteButton);

      // Cancel deletion
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      // Modal should be closed
      expect(screen.queryByText(/Are you sure you want to delete/i)).not.toBeInTheDocument();

      // API should not be called
      expect(visualizeApi.deleteInstance).not.toHaveBeenCalled();
    });
  });

  describe('Logs functionality', () => {
    it('should open logs modal and load logs when "View Logs" is clicked', async () => {
      const user = userEvent.setup();
      const mockLogs = {
        logs: '=== Grafana Resources ===\n✓ Deployment: 1/1 replicas ready',
        status: 'Ready',
      };
      vi.mocked(visualizeApi.getLogs).mockResolvedValue(mockLogs);

      render(<VisualizeInstallCard />);

      await waitFor(() => {
        expect(screen.getByText('test-visualize')).toBeInTheDocument();
      });

      // Click View Logs
      const viewLogsButton = screen.getByRole('button', { name: /View Logs/i });
      await user.click(viewLogsButton);

      // Logs modal should open
      expect(screen.getByText(/Installation Logs:/i)).toBeInTheDocument();

      // Wait for logs to load
      await waitFor(() => {
        expect(visualizeApi.getLogs).toHaveBeenCalledWith('test-visualize');
        expect(screen.getByText(/Grafana Resources/)).toBeInTheDocument();
      });
    });

    it('should display error when logs fail to load', async () => {
      const user = userEvent.setup();
      vi.mocked(visualizeApi.getLogs).mockRejectedValue(new Error('Failed to fetch logs'));

      render(<VisualizeInstallCard />);

      await waitFor(() => {
        expect(screen.getByText('test-visualize')).toBeInTheDocument();
      });

      const viewLogsButton = screen.getByRole('button', { name: /View Logs/i });
      await user.click(viewLogsButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load logs/i)).toBeInTheDocument();
      });
    });

    it('should refresh logs when Refresh button is clicked', async () => {
      const user = userEvent.setup();
      const mockLogs = {
        logs: 'Initial logs',
        status: 'Ready',
      };
      const mockUpdatedLogs = {
        logs: 'Updated logs with more content',
        status: 'Ready',
      };
      vi.mocked(visualizeApi.getLogs)
        .mockResolvedValueOnce(mockLogs)
        .mockResolvedValueOnce(mockUpdatedLogs);

      render(<VisualizeInstallCard />);

      // Open logs
      const viewLogsButton = await screen.findByRole('button', { name: /View Logs/i });
      await user.click(viewLogsButton);

      await waitFor(() => {
        expect(screen.getByText('Initial logs')).toBeInTheDocument();
      });

      // Refresh logs
      const refreshButton = screen.getByRole('button', { name: /Refresh/i });
      await user.click(refreshButton);

      // Updated logs should appear
      await waitFor(() => {
        expect(screen.getByText('Updated logs with more content')).toBeInTheDocument();
      });

      expect(visualizeApi.getLogs).toHaveBeenCalledTimes(2);
    });
  });

  describe('Auto-refresh polling', () => {
    it('should auto-refresh every 5 seconds when status is Installing', async () => {
      const installingInstance: VisualizeConfig[] = [
        {
          name: 'test-visualize',
          targetCluster: 'cluster1',
          namespace: 'krkn-visualize',
          status: 'Installing',
        },
      ];

      vi.mocked(visualizeApi.listInstances)
        .mockResolvedValueOnce(installingInstance)
        .mockResolvedValueOnce(installingInstance)
        .mockResolvedValueOnce([
          {
            ...installingInstance[0],
            status: 'Ready',
            grafanaUrl: 'https://grafana.example.com',
          },
        ]);

      vi.useFakeTimers();

      render(<VisualizeInstallCard />);

      // Initial load
      await waitFor(() => {
        expect(visualizeApi.listInstances).toHaveBeenCalledTimes(1);
      });

      // Advance time past first auto-refresh interval (5 seconds)
      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(visualizeApi.listInstances).toHaveBeenCalledTimes(2);
      });

      // Advance time past second interval
      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(visualizeApi.listInstances).toHaveBeenCalledTimes(3);
      });

      // Cleanup
      vi.useRealTimers();
    });

    it('should auto-refresh when status is Deleting', async () => {
      const deletingInstance: VisualizeConfig[] = [
        {
          name: 'test-visualize',
          targetCluster: 'cluster1',
          namespace: 'krkn-visualize',
          status: 'Deleting',
        },
      ];

      vi.mocked(visualizeApi.listInstances)
        .mockResolvedValueOnce(deletingInstance)
        .mockResolvedValueOnce(deletingInstance)
        .mockResolvedValueOnce([]); // Instance deleted

      vi.useFakeTimers();

      render(<VisualizeInstallCard />);

      await waitFor(() => {
        expect(visualizeApi.listInstances).toHaveBeenCalledTimes(1);
      });

      // Advance time
      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(visualizeApi.listInstances).toHaveBeenCalledTimes(2);
      });

      vi.useRealTimers();
    });

    it('should NOT auto-refresh when all instances are Ready', async () => {
      const readyInstance: VisualizeConfig[] = [
        {
          ...mockInstances[0],
          status: 'Ready',
        },
      ];

      vi.mocked(visualizeApi.listInstances).mockResolvedValue(readyInstance);

      vi.useFakeTimers();

      render(<VisualizeInstallCard />);

      await waitFor(() => {
        expect(visualizeApi.listInstances).toHaveBeenCalledTimes(1);
      });

      // Advance time
      vi.advanceTimersByTime(10000);

      // Should still only be called once (no auto-refresh)
      expect(visualizeApi.listInstances).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe('Transitional status display', () => {
    it('should show "Deleting" badge while instance is being deleted', async () => {
      const deletingInstance: VisualizeConfig[] = [
        {
          name: 'test-visualize',
          targetCluster: 'cluster1',
          namespace: 'krkn-visualize',
          status: 'Deleting',
        },
      ];

      vi.mocked(visualizeApi.listInstances).mockResolvedValue(deletingInstance);

      render(<VisualizeInstallCard />);

      await waitFor(() => {
        expect(screen.getByText('Deleting')).toBeInTheDocument();
      });
    });

    it('should show "Installing" badge while instance is being deployed', async () => {
      const installingInstance: VisualizeConfig[] = [
        {
          name: 'test-visualize',
          targetCluster: 'cluster1',
          namespace: 'krkn-visualize',
          status: 'Installing',
        },
      ];

      vi.mocked(visualizeApi.listInstances).mockResolvedValue(installingInstance);

      render(<VisualizeInstallCard />);

      await waitFor(() => {
        expect(screen.getByText('Installing')).toBeInTheDocument();
      });
    });

    it('should show error message when status is Failed', async () => {
      const failedInstance: VisualizeConfig[] = [
        {
          name: 'test-visualize',
          targetCluster: 'cluster1',
          namespace: 'krkn-visualize',
          status: 'Failed',
          errorMessage: 'Failed to create namespace: permission denied',
        },
      ];

      vi.mocked(visualizeApi.listInstances).mockResolvedValue(failedInstance);

      render(<VisualizeInstallCard />);

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument();
        expect(screen.getByText(/permission denied/)).toBeInTheDocument();
      });
    });
  });
});
