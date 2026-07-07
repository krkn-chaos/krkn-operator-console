/**
 * WizardStepper - Custom wizard stepper component
 *
 * Replaces PatternFly Wizard to avoid infinite render loop bug.
 * Provides a simple multi-step form with navigation controls.
 */

import { useState, useEffect, ReactNode } from 'react';
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

export interface WizardStepConfig {
  id: string;
  name: string;
  component: ReactNode;
  isNextDisabled?: boolean;
}

interface WizardStepperProps {
  isOpen: boolean;
  title: string;
  description?: string;
  steps: WizardStepConfig[];
  validationWarnings?: string[];
  onClose: () => void;
  onSave: () => void;
}

export function WizardStepper({
  isOpen,
  title,
  description,
  steps,
  validationWarnings = [],
  onClose,
  onSave,
}: WizardStepperProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

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
    }
  }, [isOpen]);

  const handleNext = () => {
    if (!isLastStep) {
      setActiveStepIndex(prev => prev + 1);
    } else {
      onSave();
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setActiveStepIndex(prev => prev - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    setActiveStepIndex(stepIndex);
  };

  const handleModalClose = () => {
    setActiveStepIndex(0);
    onClose();
  };

  const getStepVariant = (stepIndex: number) => {
    if (stepIndex < activeStepIndex) return 'success';
    if (stepIndex === activeStepIndex) return 'info';
    return 'pending';
  };

  return (
    <Modal
      variant={ModalVariant.large}
      isOpen={isOpen}
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
        }}>
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
          <Button variant="link" onClick={handleModalClose}>
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
            isDisabled={currentStep.isNextDisabled}
          >
            {isLastStep ? 'Save Configuration' : 'Next'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
