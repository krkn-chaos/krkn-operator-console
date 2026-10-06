/**
 * WizardStepper - Custom wizard stepper component
 *
 * Replaces PatternFly Wizard to avoid infinite render loop bug.
 * Provides a simple multi-step form with navigation controls.
 *
 * A step may mark its Next button as loading via `isNextLoading`: the button
 * shows a spinner with a "Loading…" label and blocks advancing (including the
 * Enter key) until loading clears. Use it for steps that fetch data on enter so
 * the disabled Next button reads as "busy" rather than broken.
 *
 * @example
 * function Example() {
 *   const [scenarios, setScenarios] = useState<string[]>([]);
 *   const [loading, setLoading] = useState(false);
 *
 *   const loadScenarios = () => {
 *     setLoading(true);
 *     fetchScenarios().then((list) => {
 *       setScenarios(list);
 *       setLoading(false);
 *     });
 *   };
 *
 *   const steps: WizardStepConfig[] = [
 *     {
 *       id: 'registry',
 *       name: 'Registry',
 *       component: <RegistryStep />,
 *     },
 *     {
 *       id: 'scenario',
 *       name: 'Scenario',
 *       component: <ScenarioList scenarios={scenarios} />,
 *       onEnter: loadScenarios,
 *       // While loading: spinner + "Loading…", Next blocked.
 *       isNextLoading: loading,
 *       // After loading: enabled once a scenario is chosen (normal continuation).
 *       isNextDisabled: loading || scenarios.length === 0,
 *     },
 *   ];
 *
 *   return (
 *     <WizardStepper
 *       isOpen
 *       title="Configure Scenario"
 *       steps={steps}
 *       onClose={handleClose}
 *       onSave={handleSave}
 *     />
 *   );
 * }
 */

import { useState, useEffect, ReactNode, KeyboardEvent } from 'react';
import {
  Modal,
  ModalVariant,
  Button,
  Title,
  Text,
  ProgressStepper,
  ProgressStep,
  Alert,
} from '@patternfly/react-core';
import { runOnEnterFromFormControl } from '../../utils/keyboard';

export interface WizardStepConfig {
  id: string;
  name: string;
  component: ReactNode;
  isNextDisabled?: boolean;
  isNextLoading?: boolean;
  isStepDisabled?: boolean;
  onEnter?: () => void;
}

interface WizardStepperProps {
  isOpen: boolean;
  title: string;
  description?: string;
  steps: WizardStepConfig[];
  validationWarnings?: string[];
  onClose: () => void;
  onSave: () => void;
  onCancel?: () => void;
}

export function WizardStepper({
  isOpen,
  title,
  description,
  steps,
  validationWarnings = [],
  onClose,
  onSave,
  onCancel,
}: WizardStepperProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);

  const currentStep = steps[activeStepIndex];
  const isFirstStep = activeStepIndex === 0;
  const isLastStep = activeStepIndex === steps.length - 1;

  // Remove focus from ReactFlow nodes when modal opens to prevent aria-hidden warning
  useEffect(() => {
    if (isOpen) {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement !== document.body) {
        activeElement.blur();
      }
    } else {
      setActiveStepIndex(0);
    }
  }, [isOpen]);

  const handleNext = () => {
    if (currentStep.isNextDisabled || currentStep.isNextLoading) return;
    if (!isLastStep) {
      const nextStepIndex = activeStepIndex + 1;
      setActiveStepIndex(nextStepIndex);
      steps[nextStepIndex]?.onEnter?.();
    } else {
      onSave();
    }
  };

  const handleContentKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    runOnEnterFromFormControl(event, handleNext);
  };

  const handleBack = () => {
    if (!isFirstStep) {
      const previousStepIndex = activeStepIndex - 1;
      setActiveStepIndex(previousStepIndex);
      steps[previousStepIndex]?.onEnter?.();
    }
  };

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex === activeStepIndex || steps[stepIndex]?.isStepDisabled) return;
    setActiveStepIndex(stepIndex);
    steps[stepIndex]?.onEnter?.();
  };

  const handleCancelClick = () => {
    setShowCancelConfirmation(true);
  };

  const handleCancelConfirm = () => {
    setShowCancelConfirmation(false);
    setActiveStepIndex(0);
    if (onCancel) {
      onCancel();
    } else {
      onClose();
    }
  };

  const handleCancelDismiss = () => {
    setShowCancelConfirmation(false);
  };

  const handleModalClose = () => {
    // Clicking X on modal shows confirmation
    setShowCancelConfirmation(true);
  };

  const getStepVariant = (stepIndex: number) => {
    if (stepIndex < activeStepIndex) return 'success';
    if (stepIndex === activeStepIndex) return 'info';
    return 'pending';
  };

  return (
    <>
      <Modal
        variant={ModalVariant.large}
        isOpen={isOpen && !showCancelConfirmation}
        onClose={handleModalClose}
        aria-label={title}
      >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '80vh',
        maxHeight: '800px'
      }}>
        {/* Header - Fixed */}
        <div style={{
          padding: '1.5rem 1.5rem 0 1.5rem',
          borderBottom: '1px solid var(--pf-v5-global--BorderColor--100)'
        }}>
          <Title headingLevel="h1" size="2xl">
            {title}
          </Title>
          {description && (
            <Text component="p" style={{ marginTop: '0.5rem', color: 'var(--pf-v5-global--Color--200)' }}>
              {description}
            </Text>
          )}

          {/* Progress Stepper */}
          <ProgressStepper style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
            {steps.map((step, stepIndex) => (
              <ProgressStep
                key={step.id}
                variant={getStepVariant(stepIndex)}
                id={step.id}
                titleId={`${step.id}-title`}
                aria-label={step.name}
                aria-disabled={step.isStepDisabled || undefined}
                isCurrent={stepIndex === activeStepIndex}
                onClick={() => handleStepClick(stepIndex)}
              >
                {step.name}
              </ProgressStep>
            ))}
          </ProgressStepper>
        </div>

        {/* Step Content - Scrollable */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem'
        }} onKeyDown={handleContentKeyDown}>
          {/* Validation Warnings */}
          {validationWarnings.length > 0 && (
            <Alert
              variant="warning"
              title="Warning"
              style={{ marginBottom: '1.5rem' }}
            >
              <ul>
                {validationWarnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </Alert>
          )}

          {currentStep.component}
        </div>

        {/* Footer - Fixed */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--pf-v5-global--BorderColor--100)',
          display: 'flex',
          gap: '1rem',
          justifyContent: 'flex-end'
        }}>
          <Button variant="tertiary" onClick={handleCancelClick}>
            Cancel
          </Button>
          {!isFirstStep && (
            <Button variant="secondary" onClick={handleBack}>
              Back
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleNext}
            isLoading={currentStep.isNextLoading}
            isDisabled={currentStep.isNextDisabled || currentStep.isNextLoading}
          >
            {currentStep.isNextLoading
              ? 'Loading…'
              : isLastStep
                ? 'Save Configuration'
                : 'Next'}
          </Button>
        </div>
      </div>
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Cancel configuration?"
        isOpen={showCancelConfirmation}
        onClose={handleCancelDismiss}
        actions={[
          <Button key="confirm" variant="danger" onClick={handleCancelConfirm}>
            Yes, cancel
          </Button>,
          <Button key="dismiss" variant="link" onClick={handleCancelDismiss}>
            No, continue editing
          </Button>,
        ]}
      >
        <p>
          Are you sure you want to cancel? All unsaved changes will be lost and you will return to the scenario runs list.
        </p>
      </Modal>
    </>
  );
}
