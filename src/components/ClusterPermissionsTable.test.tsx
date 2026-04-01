/**
 * ClusterPermissionsTable Component Tests
 *
 * Tests for the ClusterPermissionsTable component including:
 * - Empty state rendering
 * - Cluster list rendering
 * - Checkbox functionality
 * - Orphaned cluster handling
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
});
