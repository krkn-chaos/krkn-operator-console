import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClusterMultiSelector } from './ClusterMultiSelector';
import type { Cluster, SelectedCluster } from '../types/api';

const clusters: Record<string, Cluster[]> = {
  operator: [
    { 'cluster-name': 'healthy-cluster', 'cluster-api-url': 'https://healthy.example', 'cluster-status': 'healthy', online: true },
    { 'cluster-name': 'unhealthy-cluster', 'cluster-api-url': 'https://unhealthy.example', 'cluster-status': 'unhealthy', online: true },
    { 'cluster-name': 'unknown-health-cluster', 'cluster-api-url': 'https://unknown.example', 'cluster-status': 'unknown' },
    {
      'cluster-name': 'offline-cluster',
      'cluster-api-url': 'https://offline.example',
      online: false,
      'checked-at': '2026-09-09T08:00:00Z',
    },
    { 'cluster-name': 'legacy-cluster', 'cluster-api-url': 'https://legacy.example' },
  ],
};

function renderSelector(selectedClusters: SelectedCluster[] = []) {
  return render(
    <ClusterMultiSelector
      clusters={clusters}
      selectedClusters={selectedClusters}
      onToggle={vi.fn()}
      onProceed={vi.fn()}
      onCancel={vi.fn()}
    />
  );
}

describe('ClusterMultiSelector cluster health', () => {
  it('disables unhealthy and offline clusters while keeping healthy and unknown clusters selectable', () => {
    renderSelector();

    expect(screen.getByRole('checkbox', { name: /^healthy-cluster/ })).not.toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /^unhealthy-cluster/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /^unknown-health-cluster/ })).not.toBeDisabled();
    expect(screen.getByLabelText('Cluster status: healthy')).toHaveClass('pf-m-green');
    expect(screen.getByLabelText('Cluster status: unhealthy')).toHaveClass('pf-m-red');
    expect(screen.getByLabelText('Cluster status: unknown')).toHaveClass('pf-v5-c-label');
    expect(screen.getByLabelText('Cluster status: unknown')).not.toHaveClass('pf-m-red');
    expect(screen.getByLabelText('Cluster status: unknown')).not.toHaveClass('pf-m-green');
    expect(screen.getByRole('checkbox', { name: /legacy-cluster/i })).not.toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /offline-cluster/i })).toBeDisabled();
  });

  it('shows an accessible offline indicator with the last check time', () => {
    renderSelector();

    expect(screen.getByLabelText(/Cluster is offline\. Last checked:/)).toBeInTheDocument();
  });

  it('does not toggle unhealthy or offline clusters and Select All excludes both', () => {
    const onToggle = vi.fn();
    render(
      <ClusterMultiSelector
        clusters={clusters}
        selectedClusters={[]}
        onToggle={onToggle}
        onProceed={vi.fn()}
        onCancel={vi.fn()}
    />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /offline-cluster/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /unhealthy-cluster/i }));
    expect(onToggle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    expect(onToggle).toHaveBeenCalledTimes(3);
    expect(onToggle).not.toHaveBeenCalledWith(
      expect.objectContaining({ clusterName: 'offline-cluster' })
    );
    expect(onToggle).not.toHaveBeenCalledWith(
      expect.objectContaining({ clusterName: 'unhealthy-cluster' })
    );
    expect(onToggle).toHaveBeenCalledWith(
      expect.objectContaining({ clusterName: 'unknown-health-cluster' })
    );
    expect(onToggle).toHaveBeenCalledWith(
      expect.objectContaining({ clusterName: 'healthy-cluster' })
    );
  });

  it('removes a previously selected unhealthy cluster and explains the change', () => {
    renderSelector([{ operatorName: 'operator', clusterName: 'unhealthy-cluster', clusterApiUrl: 'https://unhealthy.example' }]);

    expect(screen.getByText('Unavailable clusters removed from this selection')).toBeInTheDocument();
    expect(screen.getByText(/unhealthy-cluster is offline or unhealthy and cannot be included/)).toBeInTheDocument();
  });

  it('removes a previously selected offline cluster and explains the change', () => {
    renderSelector([{ operatorName: 'operator', clusterName: 'offline-cluster', clusterApiUrl: 'https://offline.example' }]);

    expect(screen.getByText('Unavailable clusters removed from this selection')).toBeInTheDocument();
    expect(screen.getByText(/offline-cluster is offline or unhealthy and cannot be included/)).toBeInTheDocument();
  });
});
