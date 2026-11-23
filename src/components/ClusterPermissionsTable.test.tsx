/**
 * ClusterPermissionsTable Component Tests
 *
 * Tests for the ClusterPermissionsTable component including:
 * - Empty state rendering
 * - Cluster list rendering
 * - Checkbox functionality
 * - Orphaned cluster handling
 * - Offline cluster handling
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ClusterPermissionsTable } from './ClusterPermissionsTable';
import type { ClusterPermissions, TargetResponse } from '../types/api';

describe('ClusterPermissionsTable', () => {
  const mockOnChange = vi.fn();

  const mockTargets: TargetResponse[] = [
    {
      uuid: 'target-1',
      clusterName: 'cluster1',
      clusterAPIURL: 'https://api.cluster1.example.com',
      operatorSource: 'krkn-operator-acm',
      clusterStatus: 'unhealthy',
      secretType: 'token',
      ready: true,
    },
    {
      uuid: 'target-2',
      clusterName: 'cluster2',
      clusterAPIURL: 'https://api.cluster2.example.com',
      secretType: 'token',
      ready: true,
    },
  ];

  it('should render empty state when no targets available', () => {
    render(
      <ClusterPermissionsTable
        targets={[]}
        clusterPermissions={{}}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText(/No clusters available/i)).toBeInTheDocument();
  });

  it('should render table with cluster list', () => {
    render(
      <ClusterPermissionsTable
        targets={mockTargets}
        clusterPermissions={{}}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('cluster1')).toBeInTheDocument();
    expect(screen.getByText('cluster2')).toBeInTheDocument();
    expect(screen.getByText('https://api.cluster1.example.com')).toBeInTheDocument();
    expect(screen.getByText('https://api.cluster2.example.com')).toBeInTheDocument();
    expect(screen.getByLabelText('Cluster status: unhealthy')).toHaveClass('pf-m-red');
  });

  it('should display checkboxes for each action', () => {
    render(
      <ClusterPermissionsTable
        targets={mockTargets}
        clusterPermissions={{}}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByLabelText(/View permission for cluster1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Run permission for cluster1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cancel permission for cluster1/i)).toBeInTheDocument();
  });

  it('should pre-check boxes based on existing permissions', () => {
    const permissions: ClusterPermissions = {
      'https://api.cluster1.example.com': { actions: ['view', 'run'] },
      'https://api.cluster2.example.com': { actions: ['view'] },
    };

    render(
      <ClusterPermissionsTable
        targets={mockTargets}
        clusterPermissions={permissions}
        onChange={mockOnChange}
      />
    );

    const cluster1View = screen.getByLabelText(/View permission for cluster1/i) as HTMLInputElement;
    const cluster1Run = screen.getByLabelText(/Run permission for cluster1/i) as HTMLInputElement;
    const cluster1Cancel = screen.getByLabelText(/Cancel permission for cluster1/i) as HTMLInputElement;
    const cluster2View = screen.getByLabelText(/View permission for cluster2/i) as HTMLInputElement;

    expect(cluster1View.checked).toBe(true);
    expect(cluster1Run.checked).toBe(true);
    expect(cluster1Cancel.checked).toBe(false);
    expect(cluster2View.checked).toBe(true);
  });

  it('should call onChange when checkbox is toggled', async () => {
    const user = userEvent.setup();
    const permissions: ClusterPermissions = {};

    render(
      <ClusterPermissionsTable
        targets={mockTargets}
        clusterPermissions={permissions}
        onChange={mockOnChange}
      />
    );

    const cluster1View = screen.getByLabelText(/View permission for cluster1/i);
    await user.click(cluster1View);

    expect(mockOnChange).toHaveBeenCalledWith({
      'https://api.cluster1.example.com': { actions: ['view'] },
    });
  });

  it('should display orphaned clusters with warning badge when showOrphanedWarning is true', () => {
    const permissions: ClusterPermissions = {
      'https://api.cluster1.example.com': { actions: ['view'] },
      'https://api.removed-cluster.example.com': { actions: ['view', 'run'] },
    };

    render(
      <ClusterPermissionsTable
        targets={mockTargets}
        clusterPermissions={permissions}
        onChange={mockOnChange}
        showOrphanedWarning={true}
      />
    );

    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.getByText('https://api.removed-cluster.example.com')).toBeInTheDocument();
  });

  describe('offline clusters', () => {
    // One offline cluster in each render path: grouped by operator, and without a source.
    const offlineTargets: TargetResponse[] = [
      {
        uuid: 'offline-1',
        clusterName: 'offline-acm',
        clusterAPIURL: 'https://api.offline-acm.example.com',
        operatorSource: 'krkn-operator-acm',
        secretType: 'token',
        ready: true,
        online: false,
        checkedAt: '2026-11-04T13:00:00Z',
      },
      {
        uuid: 'offline-2',
        clusterName: 'offline-legacy',
        clusterAPIURL: 'https://api.offline-legacy.example.com',
        secretType: 'token',
        ready: true,
        online: false,
      },
    ];

    it('should allow granting Run on an offline cluster', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <ClusterPermissionsTable targets={offlineTargets} clusterPermissions={{}} onChange={onChange} />
      );

      for (const target of offlineTargets) {
        const run = screen.getByLabelText(`Run permission for ${target.clusterName}`);
        expect(run).toBeEnabled();
        await user.click(run);
        expect(onChange).toHaveBeenLastCalledWith({ [target.clusterAPIURL]: { actions: ['run'] } });
      }
    });

    it('should include offline clusters when selecting Run for all clusters', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const targets = [...mockTargets, ...offlineTargets];
      const runOn = (list: TargetResponse[]): ClusterPermissions =>
        Object.fromEntries(list.map((target) => [target.clusterAPIURL, { actions: ['run'] }]));

      // Only the online clusters have Run so far, so Run "All" still has work to do.
      const { rerender } = render(
        <ClusterPermissionsTable targets={targets} clusterPermissions={runOn(mockTargets)} onChange={onChange} showBulkActions />
      );

      // Bulk action buttons are ordered View, Run, Cancel.
      const runAll = screen.getAllByRole('button', { name: 'All' })[1];
      expect(runAll).toBeEnabled();
      await user.click(runAll);
      expect(onChange).toHaveBeenCalledWith(runOn(targets));

      rerender(
        <ClusterPermissionsTable targets={targets} clusterPermissions={runOn(targets)} onChange={onChange} showBulkActions />
      );
      expect(screen.getAllByRole('button', { name: 'All' })[1]).toBeDisabled();
    });

    it('should mark offline clusters with the last check time', () => {
      render(
        <ClusterPermissionsTable targets={[...mockTargets, ...offlineTargets]} clusterPermissions={{}} onChange={vi.fn()} />
      );

      expect(screen.getAllByLabelText(/^Cluster is offline\. Last checked:/)).toHaveLength(2);
    });

    it('should show the offline tooltip when the marker gets keyboard focus', async () => {
      const user = userEvent.setup();
      render(
        <ClusterPermissionsTable targets={[offlineTargets[1]]} clusterPermissions={{}} onChange={vi.fn()} />
      );

      // Tab through the table the way a keyboard user would.
      const marker = screen.getByRole('img', { name: /^Cluster is offline\. Last checked: unknown\.$/ });
      for (let i = 0; i < 10 && document.activeElement !== marker; i += 1) {
        await user.tab();
      }
      expect(marker).toHaveFocus();
      expect(await screen.findByText('Cluster is offline. Last checked: unknown.')).toBeInTheDocument();
    });
  });
});
