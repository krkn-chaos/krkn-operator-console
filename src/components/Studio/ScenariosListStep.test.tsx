import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { ScenariosListStep } from './ScenariosListStep';

const signatureState = vi.hoisted(() => ({ enabled: false as boolean | null, error: null as string | null, isLoading: false }));

vi.mock('../../hooks/useSignatureVerification', () => ({
  useSignatureVerification: () => ({ ...signatureState, isReady: signatureState.enabled !== null, updateSettings: vi.fn() }),
}));

describe('ScenariosListStep', () => {
  beforeEach(() => {
    signatureState.enabled = false;
    signatureState.error = null;
    signatureState.isLoading = false;
  });

  it('shows retry UI when scenario fetch fails', async () => {
    const onRetry = vi.fn();
    render(
      <ScenariosListStep
        scenarios={[]}
        selectedScenario={null}
        onSelectScenario={vi.fn()}
        error="Failed to load scenarios"
        onRetry={onRetry}
      />
    );

    expect(screen.getByText('Failed to Load Scenarios')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('lists node-scenarios when scenarios are available', () => {
    render(
      <ScenariosListStep
        scenarios={[{ name: 'node-scenarios', digest: 'sha256:abc', size: 1 }]}
        selectedScenario={null}
        onSelectScenario={vi.fn()}
      />
    );

    expect(screen.getByText('node-scenarios')).toBeInTheDocument();
  });

  it('allows signed scenarios and blocks unsigned scenarios when verification is enabled', async () => {
    signatureState.enabled = true;
    const onSelectScenario = vi.fn();
    render(
      <ScenariosListStep
        scenarios={[
          { name: 'signed-scenario', signature_status: 'signed' },
          { name: 'unsigned-scenario', signature_status: 'unsigned' },
        ]}
        selectedScenario={null}
        onSelectScenario={onSelectScenario}
      />
    );

    await userEvent.click(screen.getByText('signed-scenario'));
    expect(onSelectScenario).toHaveBeenCalledWith('signed-scenario', 'signed');
    expect(screen.getByText('Selection disabled: image must be signed.')).toBeInTheDocument();
    expect(screen.getByText('unsigned-scenario').closest('[aria-disabled="true"]')).toBeInTheDocument();
  });

  it('shows the override warning for unsigned scenarios when verification is disabled', () => {
    render(
      <ScenariosListStep
        scenarios={[{ name: 'unsigned-scenario', signature_status: 'unsigned' }]}
        selectedScenario={null}
        onSelectScenario={vi.fn()}
      />
    );

    expect(screen.getByText('Override active: this image is not signed.')).toBeInTheDocument();
  });
});
