import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { WizardStepper, WizardStepConfig } from './WizardStepper';

function makeSteps(overrides: Partial<WizardStepConfig> = {}): WizardStepConfig[] {
  return [
    {
      id: 'first',
      name: 'First',
      component: <input aria-label="first input" />,
      ...overrides,
    },
  ];
}

describe('WizardStepper Enter handling', () => {
  it('saves when Enter is pressed in the final step', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <WizardStepper
        isOpen
        title="Test wizard"
        steps={makeSteps()}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await user.click(screen.getByLabelText('first input'));
    await user.keyboard('{Enter}');

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('advances to the next step when Enter is pressed', async () => {
    const user = userEvent.setup();

    render(
      <WizardStepper
        isOpen
        title="Test wizard"
        steps={[
          ...makeSteps(),
          { id: 'second', name: 'Second', component: <div>Second step</div> },
        ]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByLabelText('first input'));
    await user.keyboard('{Enter}');

    expect(screen.getByText('Second step')).toBeInTheDocument();
  });

  it('does not advance when the current step is disabled', async () => {
    const user = userEvent.setup();

    render(
      <WizardStepper
        isOpen
        title="Test wizard"
        steps={[
          ...makeSteps({ isNextDisabled: true }),
          { id: 'second', name: 'Second', component: <div>Second step</div> },
        ]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByLabelText('first input'));
    await user.keyboard('{Enter}');

    expect(screen.queryByText('Second step')).not.toBeInTheDocument();
  });

  it('does not advance for Shift+Enter', async () => {
    const user = userEvent.setup();

    render(
      <WizardStepper
        isOpen
        title="Test wizard"
        steps={[
          ...makeSteps(),
          { id: 'second', name: 'Second', component: <div>Second step</div> },
        ]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByLabelText('first input'));
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(screen.queryByText('Second step')).not.toBeInTheDocument();
  });

  it('does not advance for non-Enter keys', async () => {
    const user = userEvent.setup();

    render(
      <WizardStepper
        isOpen
        title="Test wizard"
        steps={[
          ...makeSteps(),
          { id: 'second', name: 'Second', component: <div>Second step</div> },
        ]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByLabelText('first input'));
    await user.keyboard('a');

    expect(screen.queryByText('Second step')).not.toBeInTheDocument();
  });

  it('advances when Enter is pressed on a select', async () => {
    const user = userEvent.setup();

    render(
      <WizardStepper
        isOpen
        title="Test wizard"
        steps={[
          {
            id: 'first',
            name: 'First',
            component: (
              <select aria-label="first select" defaultValue="one">
                <option value="one">One</option>
              </select>
            ),
          },
          { id: 'second', name: 'Second', component: <div>Second step</div> },
        ]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByLabelText('first select'));
    await user.keyboard('{Enter}');

    expect(screen.getByText('Second step')).toBeInTheDocument();
  });

  it('does not advance when Enter is pressed in a search input', async () => {
    const user = userEvent.setup();

    render(
      <WizardStepper
        isOpen
        title="Test wizard"
        steps={[
          {
            id: 'first',
            name: 'First',
            component: <input type="search" aria-label="search" />,
          },
          { id: 'second', name: 'Second', component: <div>Second step</div> },
        ]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByLabelText('search'));
    await user.keyboard('{Enter}');

    expect(screen.queryByText('Second step')).not.toBeInTheDocument();
  });
});
