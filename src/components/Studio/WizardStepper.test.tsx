/**
 * Tests for WizardStepper component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WizardStepper, WizardStepConfig } from './WizardStepper';

describe('WizardStepper', () => {
  const mockSteps: WizardStepConfig[] = [
    {
      id: 'step1',
      name: 'Step 1',
      component: <div>Step 1 Content</div>,
    },
    {
      id: 'step2',
      name: 'Step 2',
      component: <div>Step 2 Content</div>,
    },
    {
      id: 'step3',
      name: 'Step 3',
      component: <div>Step 3 Content</div>,
    },
  ];

  const defaultProps = {
    isOpen: true,
    title: 'Test Wizard',
    description: 'Test wizard description',
    steps: mockSteps,
    onClose: vi.fn(),
    onSave: vi.fn(),
    onCancel: undefined,
  };

  it('renders the wizard with title and description', () => {
    render(<WizardStepper {...defaultProps} />);

    expect(screen.getByText('Test Wizard')).toBeInTheDocument();
    expect(screen.getByText('Test wizard description')).toBeInTheDocument();
  });

  it('displays all steps in the progress stepper', () => {
    render(<WizardStepper {...defaultProps} />);

    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
    expect(screen.getByText('Step 3')).toBeInTheDocument();
  });

  it('shows the cancel button on all steps', () => {
    render(<WizardStepper {...defaultProps} />);

    // Cancel button should be visible on first step
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

    // Navigate to next step
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Cancel button should still be visible
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows confirmation dialog when cancel is clicked', () => {
    render(<WizardStepper {...defaultProps} />);

    // Click cancel button
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // Confirmation dialog should appear
    expect(screen.getByText(/cancel configuration/i)).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to cancel/i)).toBeInTheDocument();
  });

  it('calls onCancel when cancel is confirmed and onCancel is provided', () => {
    const onCancel = vi.fn();
    const onClose = vi.fn();
    render(<WizardStepper {...defaultProps} onCancel={onCancel} onClose={onClose} />);

    // Click cancel button
    const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButtons[0]);

    // Click confirm in the confirmation dialog
    const confirmButton = screen.getAllByRole('button', { name: /yes, cancel/i, hidden: true })[0];
    fireEvent.click(confirmButton);

    // onCancel should be called instead of onClose
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when cancel is confirmed and onCancel is not provided', () => {
    const onClose = vi.fn();
    render(<WizardStepper {...defaultProps} onClose={onClose} />);

    // Click cancel button
    const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButtons[0]);

    // Click confirm in the confirmation dialog
    const confirmButton = screen.getAllByRole('button', { name: /yes, cancel/i, hidden: true })[0];
    fireEvent.click(confirmButton);

    // onClose should be called as fallback
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismisses confirmation dialog when user chooses to continue', () => {
    const onClose = vi.fn();
    render(<WizardStepper {...defaultProps} onClose={onClose} />);

    // Click cancel button
    const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButtons[0]);

    // Click "No, continue editing"
    const continueButton = screen.getAllByRole('button', { name: /no, continue editing/i, hidden: true })[0];
    fireEvent.click(continueButton);

    // Confirmation dialog should be dismissed
    expect(screen.queryByText(/cancel configuration/i)).not.toBeInTheDocument();

    // onClose should NOT be called
    expect(onClose).not.toHaveBeenCalled();
  });

  it('navigates between steps using Next and Back buttons', () => {
    render(<WizardStepper {...defaultProps} />);

    // Should start on step 1
    expect(screen.getByText('Step 1 Content')).toBeInTheDocument();

    // Click Next
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Should be on step 2
    expect(screen.getByText('Step 2 Content')).toBeInTheDocument();

    // Click Back
    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    // Should be back on step 1
    expect(screen.getByText('Step 1 Content')).toBeInTheDocument();
  });

  it('shows "Save Configuration" on the last step', () => {
    render(<WizardStepper {...defaultProps} />);

    // Navigate to last step
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Button should say "Save Configuration"
    expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument();
  });

  it('calls onSave when Save Configuration is clicked on last step', () => {
    const onSave = vi.fn();
    render(<WizardStepper {...defaultProps} onSave={onSave} />);

    // Navigate to last step
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Click Save Configuration
    fireEvent.click(screen.getByRole('button', { name: /save configuration/i }));

    // onSave should be called
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('disables Next button when step has isNextDisabled=true', () => {
    const stepsWithDisabled: WizardStepConfig[] = [
      {
        id: 'step1',
        name: 'Step 1',
        component: <div>Step 1 Content</div>,
        isNextDisabled: true,
      },
      {
        id: 'step2',
        name: 'Step 2',
        component: <div>Step 2 Content</div>,
      },
    ];

    render(<WizardStepper {...defaultProps} steps={stepsWithDisabled} />);

    // Next button should be disabled when step has isNextDisabled=true
    const nextButtons = screen.getAllByRole('button', { name: /next/i });
    expect(nextButtons[0]).toBeDisabled();
  });

  it('displays validation warnings when provided', () => {
    const warnings = ['Warning 1', 'Warning 2'];
    render(<WizardStepper {...defaultProps} validationWarnings={warnings} />);

    expect(screen.getByText('Warning 1')).toBeInTheDocument();
    expect(screen.getByText('Warning 2')).toBeInTheDocument();
  });
});
