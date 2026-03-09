import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ActiveRunsModal } from './ActiveRunsModal';
import type { ActiveRunsResponse } from '../types/api';

describe('ActiveRunsModal', () => {
  const mockOnClose = vi.fn();

  it('should render modal when isOpen is true', () => {
    const activeRuns: ActiveRunsResponse = {
      totalActiveRuns: 1,
      totalClusters: 1,
      clusterRuns: { 'cluster1': ['run1'] },
    };

    render(
      <ActiveRunsModal isOpen={true} onClose={mockOnClose} activeRuns={activeRuns} />
    );

    expect(screen.getByText('Active Scenario Runs by Cluster')).toBeInTheDocument();
  });

  it('should not render modal when isOpen is false', () => {
    const activeRuns: ActiveRunsResponse = {
      totalActiveRuns: 1,
      totalClusters: 1,
      clusterRuns: { 'cluster1': ['run1'] },
    };

    render(
      <ActiveRunsModal isOpen={false} onClose={mockOnClose} activeRuns={activeRuns} />
    );

    expect(screen.queryByText('Active Scenario Runs by Cluster')).not.toBeInTheDocument();
  });

  it('should render empty state when no active runs', () => {
    const activeRuns: ActiveRunsResponse = {
      totalActiveRuns: 0,
      totalClusters: 0,
      clusterRuns: {},
    };

    render(
      <ActiveRunsModal isOpen={true} onClose={mockOnClose} activeRuns={activeRuns} />
    );

    expect(screen.getByText('No Active Runs')).toBeInTheDocument();
    expect(screen.getByText('There are currently no active scenario runs.')).toBeInTheDocument();
  });

  it('should render tree structure with cluster and runs', () => {
    const activeRuns: ActiveRunsResponse = {
      totalActiveRuns: 3,
      totalClusters: 2,
      clusterRuns: {
        'cluster1': ['run1', 'run2'],
        'cluster2': ['run3'],
      },
    };

    render(
      <ActiveRunsModal isOpen={true} onClose={mockOnClose} activeRuns={activeRuns} />
    );

    // Check cluster names
    expect(screen.getByText('cluster1')).toBeInTheDocument();
    expect(screen.getByText('cluster2')).toBeInTheDocument();

    // Check run names
    expect(screen.getByText('run1')).toBeInTheDocument();
    expect(screen.getByText('run2')).toBeInTheDocument();
    expect(screen.getByText('run3')).toBeInTheDocument();
  });

  it('should call onClose when modal is closed', async () => {
    const user = userEvent.setup();
    const activeRuns: ActiveRunsResponse = {
      totalActiveRuns: 1,
      totalClusters: 1,
      clusterRuns: { 'cluster1': ['run1'] },
    };

    render(
      <ActiveRunsModal isOpen={true} onClose={mockOnClose} activeRuns={activeRuns} />
    );

    const closeButton = screen.getByLabelText('Close');
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should handle null activeRuns', () => {
    render(
      <ActiveRunsModal isOpen={true} onClose={mockOnClose} activeRuns={null} />
    );

    expect(screen.getByText('No Active Runs')).toBeInTheDocument();
  });
});
