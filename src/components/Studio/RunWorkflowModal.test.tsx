import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunWorkflowModal } from './RunWorkflowModal';
import { graphRunsApi } from '../../services';
import { useNotifications } from '../../hooks';
import { useStudioContext } from './StudioContext';
import { createNotificationsMock } from '../../test/notificationsMock';
import type { Cluster } from '../../types/api';

vi.mock('../../services');
vi.mock('../../hooks');
vi.mock('./StudioContext');

/**
 * Creates an ApiError compatible with isApiError() checks.
 * isApiError expects: err instanceof Error && typeof err.status === 'number'
 */
function createApiError(message: string, status: number, statusText: string): Error & { status: number; statusText: string } {
  return Object.assign(new Error(message), { status, statusText });
}

describe('RunWorkflowModal error handling', () => {
  const mockShowSuccess = vi.fn();
  const mockShowError = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  const clusters: { [operatorName: string]: Cluster[] } = {
    'krkn-operator': [
      { 'cluster-name': 'cluster1', 'cluster-api-url': 'https://api.cluster1.example.com:6443' },
    ],
  };

  const targetFetchState = {
    status: 'ready' as const,
    uuid: 'test-uuid-123',
    clusters,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useNotifications).mockReturnValue(
      createNotificationsMock({ showSuccess: mockShowSuccess, showError: mockShowError }),
    );

    vi.mocked(useStudioContext).mockReturnValue({
      workflow: { nodes: [], edges: [], nextNodeNumber: 1 },
      exportWorkflow: vi.fn().mockReturnValue({
        graph: {},
        metadata: { exportedAt: new Date().toISOString(), nodeCount: 0 },
      }),
    } as unknown as ReturnType<typeof useStudioContext>);
  });

  async function selectClusterAndSubmit(user: ReturnType<typeof userEvent.setup>) {
    render(
      <RunWorkflowModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        targetFetchState={targetFetchState}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Select All' }));
    await user.click(screen.getByRole('button', { name: /Run Workflow/i }));
  }

  it('shows a generic message and hides the raw backend message when createGraphRun returns a 500 ApiError', async () => {
    vi.mocked(graphRunsApi.createGraphRun).mockRejectedValueOnce(
      createApiError('internal error validating cluster access', 500, 'Internal Server Error'),
    );

    const user = userEvent.setup();
    await selectClusterAndSubmit(user);

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('Failed to run workflow', 'Internal error, please try again');
    });

    expect(mockShowError).not.toHaveBeenCalledWith(
      'Failed to run workflow',
      expect.stringContaining('internal error validating cluster access'),
    );
  });

  it('preserves the existing raw backend message for non-500 errors', async () => {
    vi.mocked(graphRunsApi.createGraphRun).mockRejectedValueOnce(
      createApiError('Target request expired', 410, 'Gone'),
    );

    const user = userEvent.setup();
    await selectClusterAndSubmit(user);

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('Failed to run workflow', 'Target request expired');
    });
  });
});
