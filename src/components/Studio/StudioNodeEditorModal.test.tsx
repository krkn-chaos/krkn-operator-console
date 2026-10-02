import { useEffect, useState, type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudioNodeEditorModal } from './StudioNodeEditorModal';
import { useStudioContext } from './StudioContext';
import { useScenariosFetch } from '../../hooks';
import type { StudioNode } from '../../types/api';

const scenarioConfigMockState = vi.hoisted(() => ({
  loadStatus: 'loaded' as 'loading' | 'loaded' | 'error',
}));

vi.mock('./StudioContext', () => ({ useStudioContext: vi.fn() }));
vi.mock('../../hooks', () => ({ useScenariosFetch: vi.fn() }));
vi.mock('./WizardStepper', () => ({
  WizardStepper: ({
    steps,
    validationWarnings,
    onSave,
  }: {
    steps: Array<{
      component: ReactNode;
      isNextDisabled?: boolean;
      isNextLoading?: boolean;
      isStepDisabled?: boolean;
      onEnter?: () => void;
    }>;
    validationWarnings: string[];
    onSave: () => void;
  }) => {
    const [activeStep, setActiveStep] = useState(0);
    const currentStep = steps[activeStep];
    const isLastStep = activeStep === steps.length - 1;
    const handleNext = () => {
      if (currentStep.isNextDisabled || currentStep.isNextLoading) return;
      if (isLastStep) {
        onSave();
      } else {
        const nextStep = activeStep + 1;
        setActiveStep(nextStep);
        steps[nextStep]?.onEnter?.();
      }
    };

    return (
      <>
        {currentStep.component}
        {steps.map((step, index) => (
          <button
            key={index}
            aria-label={`Go to step ${index}`}
            disabled={step.isStepDisabled}
            onClick={() => {
              if (step.isStepDisabled) return;
              setActiveStep(index);
              step.onEnter?.();
            }}
          />
        ))}
        {activeStep > 0 && (
          <button
            onClick={() => {
              const previousStep = activeStep - 1;
              setActiveStep(previousStep);
              steps[previousStep]?.onEnter?.();
            }}
          >
            Back
          </button>
        )}
        <button
          onClick={handleNext}
          disabled={currentStep.isNextDisabled || currentStep.isNextLoading}
        >
          {currentStep.isNextLoading
            ? 'Loading…'
            : isLastStep
              ? 'Save Configuration'
              : 'Next'}
        </button>
        {validationWarnings.map((warning) => <div key={warning}>{warning}</div>)}
      </>
    );
  },
}));
vi.mock('./RegistrySelectorStep', () => ({ RegistrySelectorStep: () => null }));
vi.mock('./ScenariosListStep', () => ({ ScenariosListStep: () => null }));
vi.mock('./ScenarioConfigStep', () => ({
  ScenarioConfigStep: ({ onLoadStatusChange }: {
    onLoadStatusChange?: (status: 'loading' | 'loaded' | 'error') => void;
  }) => {
    useEffect(() => {
      onLoadStatusChange?.(scenarioConfigMockState.loadStatus);
    }, [onLoadStatusChange]);
    return null;
  },
}));
vi.mock('../FileSelector', () => ({ FileSelector: () => null }));

const configuredNode = (weight?: number, registryType: 'public' | 'private' = 'public', registryName = ''): StudioNode => ({
  nodeId: 'node-one',
  status: 'configured',
  position: { x: 0, y: 0 },
  config: {
    registryType,
    registryConfig: registryName ? { registryName } : {},
    scenarioName: 'pod-delete',
    scenarioImage: 'quay.io/example:pod-delete',
    scenarioFormValues: {},
    ...(weight === undefined ? {} : { resiliencyWeight: weight }),
  },
});

function renderEditor(
  node: StudioNode,
  onSave = vi.fn(),
  fetchScenarios = vi.fn(),
  loading = false,
  scenarios: Array<{ name: string }> = [{ name: 'pod-delete' }],
  loaded = scenarios.length > 0,
) {
  vi.mocked(useStudioContext).mockReturnValue({
    validateNodeId: vi.fn(() => ({ valid: true })),
  } as unknown as ReturnType<typeof useStudioContext>);
  vi.mocked(useScenariosFetch).mockReturnValue({
    scenarios,
    loading,
    error: null,
    loaded,
    fetchScenarios,
    resetScenarios: vi.fn(),
  } as unknown as ReturnType<typeof useScenariosFetch>);

  render(
    <StudioNodeEditorModal
      isOpen
      node={node}
      onClose={vi.fn()}
      onSave={onSave}
    />,
  );

  return onSave;
}

async function advanceEditorToNodeSettings() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Next' }));
  return user;
}

describe('StudioNodeEditorModal resiliency weight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scenarioConfigMockState.loadStatus = 'loaded';
  });

  it('initializes a saved weight and persists an edited valid weight', async () => {
    const onSave = renderEditor(configuredNode(2.5));
    await advanceEditorToNodeSettings();
    const weightInput = await screen.findByRole('spinbutton', { name: 'Resiliency weight' });

    await waitFor(() => expect(weightInput).toHaveValue(2.5));
    const user = userEvent.setup();
    await user.clear(weightInput);
    await user.type(weightInput, '4.5');
    await user.click(screen.getByRole('button', { name: 'Save Configuration' }));

    expect(onSave).toHaveBeenCalledWith('node-one', expect.objectContaining({
      config: expect.objectContaining({ resiliencyWeight: 4.5 }),
    }));
  });

  it('defaults a missing weight to one', async () => {
    renderEditor(configuredNode());
    await advanceEditorToNodeSettings();

    await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'Resiliency weight' })).toHaveValue(1));
  });

  it('rejects a non-positive weight without saving', async () => {
    const onSave = renderEditor(configuredNode());
    await advanceEditorToNodeSettings();
    const weightInput = await screen.findByRole('spinbutton', { name: 'Resiliency weight' });
    const user = userEvent.setup();

    await user.clear(weightInput);
    await user.type(weightInput, '0');
    await user.click(screen.getByRole('button', { name: 'Save Configuration' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Resiliency weight must be greater than 0.')).toBeInTheDocument();
  });

  it('loads scenarios from the selected registry only after advancing from registry selection', async () => {
    const fetchScenarios = vi.fn();
    renderEditor(configuredNode(undefined, 'private', 'corp-registry'), undefined, fetchScenarios, false, []);

    expect(fetchScenarios).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(fetchScenarios).toHaveBeenCalledWith({ registryName: 'corp-registry' });
  });

  it('does not refetch scenarios when they are already loaded for the registry', async () => {
    const fetchScenarios = vi.fn();
    // Non-empty scenarios simulate an already-loaded list for the current
    // registry. Navigating back and forth must not trigger a refetch.
    renderEditor(configuredNode(undefined, 'private', 'corp-registry'), undefined, fetchScenarios);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(fetchScenarios).not.toHaveBeenCalled();
  });

  it('does not refetch when a prior fetch returned no scenarios', async () => {
    const fetchScenarios = vi.fn();
    // Empty list but loaded === true: a completed fetch that found nothing must
    // not be mistaken for an un-fetched registry and refetched.
    renderEditor(configuredNode(undefined, 'private', 'corp-registry'), undefined, fetchScenarios, false, [], true);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Go to step 0' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(fetchScenarios).not.toHaveBeenCalled();
  });

  it('requires a registry selection before advancing in private mode', () => {
    renderEditor(configuredNode(undefined, 'private'));

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go to step 1' })).toBeDisabled();
  });

  it('keeps configured nodes on the scenario step while scenarios are loading', async () => {
    renderEditor(configuredNode(), undefined, vi.fn(), true);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();
  });

  it('does not allow configured nodes to advance before scenario details load', async () => {
    scenarioConfigMockState.loadStatus = 'loading';
    renderEditor(configuredNode());
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go to step 3' })).toBeDisabled();
  });

  it('shows the configuration step Next as loading and blocks advancing while it loads', async () => {
    scenarioConfigMockState.loadStatus = 'loading';
    renderEditor(configuredNode());
    const user = userEvent.setup();

    // Advance: registry -> scenario -> configuration.
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    const nextButton = screen.getByRole('button', { name: 'Loading…' });
    expect(nextButton).toBeDisabled();

    // Clicking the loading Next must not reach the node-settings step.
    await user.click(nextButton);
    expect(screen.queryByRole('spinbutton', { name: 'Resiliency weight' })).not.toBeInTheDocument();

    // Once the scenario config reports loaded, Next becomes available again.
    scenarioConfigMockState.loadStatus = 'loaded';
    await user.click(screen.getByRole('button', { name: 'Go to step 1' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
  });
});
