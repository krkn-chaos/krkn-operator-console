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

  it('calls the next step entry callback when Next advances', async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();

    render(
      <WizardStepper
        isOpen
        title="Test wizard"
        steps={[
          ...makeSteps(),
          { id: 'second', name: 'Second', component: <div>Second step</div>, onEnter },
        ]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Second step')).toBeInTheDocument();
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('calls the entered step callback when navigating by progress step', async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();

    render(
      <WizardStepper
        isOpen
        title="Test wizard"
        steps={[
          ...makeSteps(),
          { id: 'second', name: 'Second', component: <div>Second step</div>, onEnter },
        ]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByText('Second'));

    expect(screen.getByText('Second step')).toBeInTheDocument();
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('calls the previous step entry callback when Back returns to it', async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();

    render(
      <WizardStepper
        isOpen
        title="Test wizard"
        steps={[
          ...makeSteps(),
          { id: 'second', name: 'Second', component: <div>Second step</div>, onEnter },
          { id: 'third', name: 'Third', component: <div>Third step</div> },
        ]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByText('Second step')).toBeInTheDocument();
    expect(onEnter).toHaveBeenCalledTimes(2);
  });

  it('does not enter a disabled progress step', async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();

    render(
      <WizardStepper
        isOpen
        title="Test wizard"
        steps={[
          ...makeSteps(),
          {
            id: 'second',
            name: 'Second',
            component: <div>Second step</div>,
            isStepDisabled: true,
            onEnter,
          },
        ]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByText('Second'));

    expect(screen.getByLabelText('first input')).toBeInTheDocument();
    expect(screen.queryByText('Second step')).not.toBeInTheDocument();
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('resets to the first step when the modal is closed and reopened', async () => {
    const user = userEvent.setup();
    const props = {
      title: 'Test wizard',
      steps: [
        ...makeSteps(),
        { id: 'second', name: 'Second', component: <div>Second step</div> },
      ],
      onClose: vi.fn(),
      onSave: vi.fn(),
    };
    const { rerender } = render(<WizardStepper {...props} isOpen />);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Second step')).toBeInTheDocument();

    rerender(<WizardStepper {...props} isOpen={false} />);
    rerender(<WizardStepper {...props} isOpen />);

    expect(screen.getByLabelText('first input')).toBeInTheDocument();
    expect(screen.queryByText('Second step')).not.toBeInTheDocument();
  });
});
