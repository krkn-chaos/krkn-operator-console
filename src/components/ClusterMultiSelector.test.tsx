import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClusterMultiSelector } from './ClusterMultiSelector';
import type { SelectedCluster } from '../types/api';

const clusters = {
  operator: [
    { 'cluster-name': 'online-cluster', 'cluster-api-url': 'https://online.example', online: true },
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

describe('ClusterMultiSelector offline clusters', () => {
  it('keeps online and unknown clusters selectable', () => {
    renderSelector();

    expect(screen.getByRole('checkbox', { name: /online-cluster/i })).not.toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /legacy-cluster/i })).not.toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /offline-cluster/i })).toBeDisabled();
  });

  it('shows an accessible offline indicator with the last check time', () => {
    renderSelector();

    expect(screen.getByLabelText(/Cluster is offline\. Last checked:/)).toBeInTheDocument();
  });

  it('does not toggle an offline cluster and Select All excludes it', () => {
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
    expect(onToggle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle).not.toHaveBeenCalledWith(
      expect.objectContaining({ clusterName: 'offline-cluster' })
    );
  });
});
