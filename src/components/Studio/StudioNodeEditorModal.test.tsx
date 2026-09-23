import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudioNodeEditorModal } from './StudioNodeEditorModal';
import { useStudioContext } from './StudioContext';
import { useScenariosFetch } from '../../hooks';
import type { StudioNode } from '../../types/api';

vi.mock('./StudioContext', () => ({ useStudioContext: vi.fn() }));
vi.mock('../../hooks', () => ({ useScenariosFetch: vi.fn() }));
vi.mock('./WizardStepper', () => ({
  WizardStepper: ({
    steps,
    validationWarnings,
    onSave,
  }: {
    steps: Array<{ component: ReactNode }>;
    validationWarnings: string[];
    onSave: () => void;
  }) => (
    <>
      {steps[3].component}
      <button onClick={onSave}>Save Configuration</button>
      {validationWarnings.map((warning) => <div key={warning}>{warning}</div>)}
    </>
  ),
}));
vi.mock('./RegistrySelectorStep', () => ({ RegistrySelectorStep: () => null }));
vi.mock('./ScenariosListStep', () => ({ ScenariosListStep: () => null }));
vi.mock('./ScenarioConfigStep', () => ({ ScenarioConfigStep: () => null }));
vi.mock('../FileSelector', () => ({ FileSelector: () => null }));

const configuredNode = (weight?: number): StudioNode => ({
  nodeId: 'node-one',
  status: 'configured',
  position: { x: 0, y: 0 },
  config: {
    registryType: 'public',
    registryConfig: {},
    scenarioName: 'pod-delete',
    scenarioImage: 'quay.io/example:pod-delete',
    scenarioFormValues: {},
    ...(weight === undefined ? {} : { resiliencyWeight: weight }),
  },
});

function renderEditor(node: StudioNode, onSave = vi.fn()) {
  vi.mocked(useStudioContext).mockReturnValue({
    validateNodeId: vi.fn(() => ({ valid: true })),
  } as unknown as ReturnType<typeof useStudioContext>);
  vi.mocked(useScenariosFetch).mockReturnValue({
    scenarios: [],
    loading: false,
    error: null,
    fetchScenarios: vi.fn(),
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

describe('StudioNodeEditorModal resiliency weight', () => {
  beforeEach(() => vi.clearAllMocks());

  it('initializes a saved weight and persists an edited valid weight', async () => {
    const onSave = renderEditor(configuredNode(2.5));
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

    await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'Resiliency weight' })).toHaveValue(1));
  });

  it('rejects a non-positive weight without saving', async () => {
    const onSave = renderEditor(configuredNode());
    const weightInput = await screen.findByRole('spinbutton', { name: 'Resiliency weight' });
    const user = userEvent.setup();

    await user.clear(weightInput);
    await user.type(weightInput, '0');
    await user.click(screen.getByRole('button', { name: 'Save Configuration' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Resiliency weight must be greater than 0.')).toBeInTheDocument();
  });
});
