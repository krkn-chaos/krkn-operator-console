import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RunWorkflowModal } from './RunWorkflowModal';
import { useStudioContext } from './StudioContext';
import { useNotifications } from '../../hooks';
import { graphRunsApi } from '../../services';

vi.mock('./StudioContext', () => ({ useStudioContext: vi.fn() }));
vi.mock('../../hooks', () => ({ useNotifications: vi.fn() }));
vi.mock('../../services', () => ({
  graphRunsApi: { createGraphRun: vi.fn() },
  operatorApi: { deleteTargetRequest: vi.fn() },
}));
vi.mock('../ClusterMultiSelector', () => ({
  ClusterMultiSelector: ({ onToggle, onProceed }: { onToggle: (cluster: unknown) => void; onProceed: () => void }) => (
    <>
      <button onClick={() => onToggle({ operatorName: 'operator', clusterName: 'cluster-1' })}>Select cluster</button>
      <button onClick={onProceed}>Submit workflow</button>
    </>
  ),
}));
vi.mock('../ResiliencyScoreModal', () => ({ ResiliencyScoreModal: () => null }));

describe('RunWorkflowModal retry configuration', () => {
  const showError = vi.fn();
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStudioContext).mockReturnValue({
      workflow: { nodes: [], edges: [], nextNodeNumber: 1 },
      exportWorkflow: vi.fn(() => ({ graph: { node: { name: 'scenario' } }, metadata: {} })),
    } as unknown as ReturnType<typeof useStudioContext>);
    vi.mocked(useNotifications).mockReturnValue({ showSuccess: vi.fn(), showError } as unknown as ReturnType<typeof useNotifications>);
    vi.mocked(graphRunsApi.createGraphRun).mockResolvedValue({ name: 'graph-run-1' } as never);
  });

  const renderModal = (isOpen = true) => render(
    <RunWorkflowModal
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      targetFetchState={{ status: 'ready', uuid: 'target-1', clusters: { operator: [{ 'cluster-name': 'cluster-1', 'cluster-api-url': 'https://cluster' }] } }}
    />
  );

  it('serializes a customized retry count', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: 'Select cluster' }));
    const input = screen.getByRole('spinbutton', { name: /Maximum retries/i });
    await user.clear(input);
    await user.type(input, '7');
    await user.click(screen.getByRole('button', { name: /Run Workflow on 1 cluster/i }));

    await waitFor(() => {
      expect(graphRunsApi.createGraphRun).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 7 }), expect.anything());
    });
  });

  it('rejects fractional retries without submitting', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: 'Select cluster' }));
    const input = screen.getByRole('spinbutton', { name: /Maximum retries/i });
    await user.clear(input);
    await user.type(input, '2.5');
    await user.click(screen.getByRole('button', { name: /Run Workflow on 1 cluster/i }));

    expect(showError).toHaveBeenCalledWith('Invalid retry count', 'Maximum retries must be a non-negative whole number');
    expect(graphRunsApi.createGraphRun).not.toHaveBeenCalled();
  });

  it('resets retries when closed and reopened', async () => {
    const user = userEvent.setup();
    const { rerender } = renderModal();
    const input = screen.getByRole('spinbutton', { name: /Maximum retries/i });
    await user.clear(input);
    await user.type(input, '8');
    rerender(<RunWorkflowModal isOpen={false} onClose={onClose} onSuccess={onSuccess} targetFetchState={{ status: 'ready', uuid: 'target-1', clusters: {} }} />);
    rerender(<RunWorkflowModal isOpen onClose={onClose} onSuccess={onSuccess} targetFetchState={{ status: 'ready', uuid: 'target-1', clusters: { operator: [{ 'cluster-name': 'cluster-1', 'cluster-api-url': 'https://cluster' }] } }} />);
    expect(screen.getByRole('spinbutton', { name: /Maximum retries/i })).toHaveValue(3);
  });
});
