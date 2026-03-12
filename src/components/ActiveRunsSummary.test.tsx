import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ActiveRunsSummary } from './ActiveRunsSummary';
import type { ActiveRunsResponse } from '../types/api';

describe('ActiveRunsSummary', () => {
  it('should not render when loading initially', () => {
    const { container } = render(
      <ActiveRunsSummary activeRuns={null} loading={true} error={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should not render when there is an error', () => {
    const { container } = render(
      <ActiveRunsSummary activeRuns={null} loading={false} error="Failed to fetch" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should not render when there are no active runs', () => {
    const activeRuns: ActiveRunsResponse = {
      totalActiveRuns: 0,
      totalClusters: 0,
      clusterRuns: {},
    };
    const { container } = render(
      <ActiveRunsSummary activeRuns={activeRuns} loading={false} error={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render singular message for 1 scenario', () => {
    const activeRuns: ActiveRunsResponse = {
      totalActiveRuns: 1,
      totalClusters: 1,
      clusterRuns: { 'cluster1': ['run1'] },
    };
    render(<ActiveRunsSummary activeRuns={activeRuns} loading={false} error={null} />);

    expect(screen.getByText("There's 1 scenario currently running")).toBeInTheDocument();
  });

  it('should render plural message for multiple scenarios', () => {
    const activeRuns: ActiveRunsResponse = {
      totalActiveRuns: 3,
      totalClusters: 2,
      clusterRuns: {
        'cluster1': ['run1', 'run2'],
        'cluster2': ['run3'],
      },
    };
    render(<ActiveRunsSummary activeRuns={activeRuns} loading={false} error={null} />);

    expect(screen.getByText('There are 3 scenarios currently running')).toBeInTheDocument();
  });

  it('should render warning Alert variant', () => {
    const activeRuns: ActiveRunsResponse = {
      totalActiveRuns: 1,
      totalClusters: 1,
      clusterRuns: { 'cluster1': ['run1'] },
    };
    const { container } = render(
      <ActiveRunsSummary activeRuns={activeRuns} loading={false} error={null} />
    );

    const alert = container.querySelector('.pf-v5-c-alert.pf-m-warning');
    expect(alert).toBeInTheDocument();
  });

  it('should show spinner when loading', () => {
    const activeRuns: ActiveRunsResponse = {
      totalActiveRuns: 1,
      totalClusters: 1,
      clusterRuns: { 'cluster1': ['run1'] },
    };
    const { container } = render(
      <ActiveRunsSummary activeRuns={activeRuns} loading={true} error={null} />
    );

    const spinner = container.querySelector('.pf-v5-c-spinner');
    expect(spinner).toBeInTheDocument();
  });

  it('should open modal when search icon is clicked', async () => {
    const user = userEvent.setup();
    const activeRuns: ActiveRunsResponse = {
      totalActiveRuns: 1,
      totalClusters: 1,
      clusterRuns: { 'cluster1': ['run1'] },
    };

    render(<ActiveRunsSummary activeRuns={activeRuns} loading={false} error={null} />);

    const searchIcon = screen.getByLabelText('View details');
    await user.click(searchIcon);

    // Modal should be visible
    expect(screen.getByText('Active Scenario Runs by Cluster')).toBeInTheDocument();
  });
});
