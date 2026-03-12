import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ClusterConflictWarning } from './ClusterConflictWarning';

describe('ClusterConflictWarning', () => {
  const mockOnCancel = vi.fn();
  const mockOnContinue = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal when isOpen is true', () => {
    render(
      <ClusterConflictWarning
        isOpen={true}
        clusterName="cluster1"
        existingRuns={['run1']}
        onCancel={mockOnCancel}
        onContinue={mockOnContinue}
      />
    );

    expect(screen.getByText('Cluster Already in Use')).toBeInTheDocument();
  });

  it('should not render modal when isOpen is false', () => {
    render(
      <ClusterConflictWarning
        isOpen={false}
        clusterName="cluster1"
        existingRuns={['run1']}
        onCancel={mockOnCancel}
        onContinue={mockOnContinue}
      />
    );

    expect(screen.queryByText('Cluster Already in Use')).not.toBeInTheDocument();
  });

  it('should display singular message for one existing run', () => {
    render(
      <ClusterConflictWarning
        isOpen={true}
        clusterName="test-cluster"
        existingRuns={['run1']}
        onCancel={mockOnCancel}
        onContinue={mockOnContinue}
      />
    );

    // Text is split across elements, so check for key parts
    expect(screen.getByText(/There is already/)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/scenario running against cluster/)).toBeInTheDocument();
    expect(screen.getByText('test-cluster')).toBeInTheDocument();
  });

  it('should display plural message for multiple existing runs', () => {
    render(
      <ClusterConflictWarning
        isOpen={true}
        clusterName="test-cluster"
        existingRuns={['run1', 'run2', 'run3']}
        onCancel={mockOnCancel}
        onContinue={mockOnContinue}
      />
    );

    // Text is split across elements, so check for key parts
    expect(screen.getByText(/There are already/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/scenarios running against cluster/)).toBeInTheDocument();
    expect(screen.getByText('test-cluster')).toBeInTheDocument();
  });

  it('should display all existing run names', () => {
    const existingRuns = ['run1', 'run2', 'run3'];

    render(
      <ClusterConflictWarning
        isOpen={true}
        clusterName="cluster1"
        existingRuns={existingRuns}
        onCancel={mockOnCancel}
        onContinue={mockOnContinue}
      />
    );

    existingRuns.forEach((run) => {
      expect(screen.getByText(run)).toBeInTheDocument();
    });
  });

  it('should call onCancel when Cancel button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <ClusterConflictWarning
        isOpen={true}
        clusterName="cluster1"
        existingRuns={['run1']}
        onCancel={mockOnCancel}
        onContinue={mockOnContinue}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnContinue).not.toHaveBeenCalled();
  });

  it('should call onContinue when Continue button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <ClusterConflictWarning
        isOpen={true}
        clusterName="cluster1"
        existingRuns={['run1']}
        onCancel={mockOnCancel}
        onContinue={mockOnContinue}
      />
    );

    const continueButton = screen.getByRole('button', { name: /continue/i });
    await user.click(continueButton);

    expect(mockOnContinue).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it('should show title with warning text', () => {
    render(
      <ClusterConflictWarning
        isOpen={true}
        clusterName="cluster1"
        existingRuns={['run1']}
        onCancel={mockOnCancel}
        onContinue={mockOnContinue}
      />
    );

    // Verify the modal title is displayed
    expect(screen.getByText('Cluster Already in Use')).toBeInTheDocument();
  });

  it('should display performance warning message', () => {
    render(
      <ClusterConflictWarning
        isOpen={true}
        clusterName="cluster1"
        existingRuns={['run1']}
        onCancel={mockOnCancel}
        onContinue={mockOnContinue}
      />
    );

    // Check for the warning message (may be split across elements)
    expect(
      screen.getByText(/Running additional scenarios/)
    ).toBeInTheDocument();
  });
});
