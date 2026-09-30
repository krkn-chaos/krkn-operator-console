import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RunWorkflowModal } from './RunWorkflowModal';
import { useStudioContext } from './StudioContext';
import { useNotifications } from '../../hooks';
import { graphRunsApi } from '../../services';
import type { StudioNode } from '../../types/api';

const signatureState = vi.hoisted(() => ({
  enabled: true as boolean | null,
  error: null as string | null,
  isLoading: false,
}));

vi.mock('./StudioContext', () => ({ useStudioContext: vi.fn() }));
vi.mock('../../hooks', () => ({ useNotifications: vi.fn() }));
vi.mock('../../hooks/useSignatureVerification', () => ({
  useSignatureVerification: () => ({ ...signatureState, updateSettings: vi.fn() }),
}));
vi.mock('../../services', () => ({
  graphRunsApi: { createGraphRun: vi.fn() },
  operatorApi: { deleteTargetRequest: vi.fn() },
}));
vi.mock('./studioAutosave', () => ({ clearAutosave: vi.fn() }));
vi.mock('../ClusterMultiSelector', () => ({
  ClusterMultiSelector: ({ onToggle, onProceed }: { onToggle: (cluster: unknown) => void; onProceed: () => void }) => (
    <>
      <button onClick={() => onToggle({ operatorName: 'operator', clusterName: 'cluster' })}>Select cluster</button>
      <button onClick={onProceed}>Submit clusters</button>
    </>
  ),
}));
vi.mock('../ResiliencyScoreModal', () => ({ ResiliencyScoreModal: () => null }));

const signedNode: StudioNode = {
  nodeId: 'node-1',
  status: 'configured' as const,
  position: { x: 0, y: 0 },
  config: {
    registryType: 'public' as const,
    registryConfig: {},
    scenarioName: 'signed-scenario',
    scenarioImage: 'quay.io/example:signed-scenario',
    signature_status: 'signed' as const,
    scenarioFormValues: {},
  },
};

const unsignedNode: StudioNode = {
  ...signedNode,
  config: {
    registryType: 'public',
    registryConfig: {},
    scenarioName: 'unsigned-scenario',
    scenarioImage: 'quay.io/example:unsigned-scenario',
    signature_status: 'unsigned',
    scenarioFormValues: {},
  },
};

function renderModal(node = unsignedNode) {
  vi.mocked(useStudioContext).mockReturnValue({
    workflow: { nodes: [node], edges: [], nextNodeNumber: 2 },
    exportWorkflow: vi.fn().mockReturnValue({ graph: {}, metadata: {} }),
  } as unknown as ReturnType<typeof useStudioContext>);
  vi.mocked(useNotifications).mockReturnValue({ showSuccess: vi.fn(), showError: vi.fn() } as unknown as ReturnType<typeof useNotifications>);

  return render(
    <RunWorkflowModal
      isOpen
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      targetFetchState={{
        status: 'ready',
        uuid: 'target-1',
        clusters: { operator: [{ 'cluster-name': 'cluster', 'cluster-api-url': 'https://cluster.example', online: true }] },
      }}
    />
  );
}

describe('RunWorkflowModal signature gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signatureState.enabled = true;
    signatureState.error = null;
    signatureState.isLoading = false;
  });

  it('blocks workflows containing an unsigned node when verification is enabled', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Select cluster' }));

    expect(screen.getByRole('button', { name: /Run Workflow on/ })).toBeDisabled();
    expect(screen.getByText('Workflow cannot run with unsigned images')).toBeInTheDocument();
    expect(screen.getByText('unsigned-scenario: select a signed image before running.')).toBeInTheDocument();
  });

  it('allows unsigned nodes with an explicit override warning when disabled', async () => {
    signatureState.enabled = false;
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Select cluster' }));

    expect(screen.getByRole('button', { name: /Run Workflow on/ })).not.toBeDisabled();
    expect(screen.getByText('Image signature verification override is active')).toBeInTheDocument();
    expect(screen.getByText('unsigned-scenario: image is not signed and will run because verification is overridden.')).toBeInTheDocument();
  });

  it('does not block a workflow whose configured node is signed', async () => {
    renderModal(signedNode);
    await userEvent.click(screen.getByRole('button', { name: 'Select cluster' }));

    expect(screen.getByRole('button', { name: /Run Workflow on/ })).not.toBeDisabled();
    expect(screen.queryByText('Workflow cannot run with unsigned images')).not.toBeInTheDocument();
  });
});

describe('RunWorkflowModal retry configuration', () => {
  const showError = vi.fn();
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    signatureState.enabled = true;
    signatureState.error = null;
    signatureState.isLoading = false;
    vi.mocked(useStudioContext).mockReturnValue({
      workflow: { nodes: [], edges: [], nextNodeNumber: 1 },
      exportWorkflow: vi.fn(() => ({ graph: { node: { name: 'scenario' } }, metadata: {} })),
    } as unknown as ReturnType<typeof useStudioContext>);
    vi.mocked(useNotifications).mockReturnValue({ showSuccess: vi.fn(), showError } as unknown as ReturnType<typeof useNotifications>);
    vi.mocked(graphRunsApi.createGraphRun).mockResolvedValue({ name: 'graph-run-1' } as never);
  });

  const renderRetryModal = (isOpen = true) => render(
    <RunWorkflowModal
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      targetFetchState={{ status: 'ready', uuid: 'target-1', clusters: { operator: [{ 'cluster-name': 'cluster-1', 'cluster-api-url': 'https://cluster' }] } }}
    />
  );

  it('serializes a customized retry count', async () => {
    const user = userEvent.setup();
    renderRetryModal();
    await user.click(screen.getByRole('button', { name: 'Select cluster' }));
    const input = screen.getByRole('spinbutton', { name: /Maximum retries/i });
    await user.clear(input);
    await user.type(input, '7');
    await user.click(screen.getByRole('button', { name: /Run Workflow on 1 cluster/i }));

    await waitFor(() => {
      expect(graphRunsApi.createGraphRun).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 7 }), expect.anything());
    });
  });

  it('sends only currently visible selected categories with the GraphRun', async () => {
    const user = userEvent.setup();
    vi.mocked(useStudioContext).mockReturnValue({
      workflow: { nodes: [], edges: [], nextNodeNumber: 1 },
      exportWorkflow: vi.fn(() => ({ graph: { node: { name: 'scenario' } }, metadata: {} })),
      selectedCategories: ['network', 'hidden'],
      visibleCategories: [{ name: 'network', color: '#d40078', availableToAll: true }],
      categoryLoadStatus: 'ready',
    } as unknown as ReturnType<typeof useStudioContext>);
    renderRetryModal();
    await user.click(screen.getByRole('button', { name: 'Select cluster' }));
    await user.click(screen.getByRole('button', { name: /Run Workflow on 1 cluster/i }));

    await waitFor(() => {
      expect(graphRunsApi.createGraphRun).toHaveBeenCalledWith(
        expect.objectContaining({ categories: ['network'] }),
        expect.anything(),
      );
    });
  });

  it('sends selected categories even while the catalog is still loading', async () => {
    const user = userEvent.setup();
    vi.mocked(useStudioContext).mockReturnValue({
      workflow: { nodes: [], edges: [], nextNodeNumber: 1 },
      exportWorkflow: vi.fn(() => ({ graph: { node: { name: 'scenario' } }, metadata: {} })),
      selectedCategories: ['network'],
      visibleCategories: [],
      categoryLoadStatus: 'loading',
    } as unknown as ReturnType<typeof useStudioContext>);
    renderRetryModal();
    await user.click(screen.getByRole('button', { name: 'Select cluster' }));
    await user.click(screen.getByRole('button', { name: /Run Workflow on 1 cluster/i }));

    await waitFor(() => {
      expect(graphRunsApi.createGraphRun).toHaveBeenCalledWith(
        expect.objectContaining({ categories: ['network'] }),
        expect.anything(),
      );
    });
  });

  it('rejects fractional retries without submitting', async () => {
    const user = userEvent.setup();
    renderRetryModal();
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
    const { rerender } = renderRetryModal();
    const input = screen.getByRole('spinbutton', { name: /Maximum retries/i });
    await user.clear(input);
    await user.type(input, '8');
    rerender(<RunWorkflowModal isOpen={false} onClose={onClose} onSuccess={onSuccess} targetFetchState={{ status: 'ready', uuid: 'target-1', clusters: {} }} />);
    rerender(<RunWorkflowModal isOpen onClose={onClose} onSuccess={onSuccess} targetFetchState={{ status: 'ready', uuid: 'target-1', clusters: { operator: [{ 'cluster-name': 'cluster-1', 'cluster-api-url': 'https://cluster' }] } }} />);
    expect(screen.getByRole('spinbutton', { name: /Maximum retries/i })).toHaveValue(3);
  });
});
