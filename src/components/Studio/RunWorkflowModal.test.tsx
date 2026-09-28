import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RunWorkflowModal } from './RunWorkflowModal';
import { useStudioContext } from './StudioContext';
import { useNotifications } from '../../hooks';

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

const signedNode = {
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

const unsignedNode = {
  ...signedNode,
  config: { ...signedNode.config, scenarioName: 'unsigned-scenario', signature_status: 'unsigned' as const },
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
