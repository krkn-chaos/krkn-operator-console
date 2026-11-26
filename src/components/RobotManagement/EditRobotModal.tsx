/**
 * EditRobotModal component
 *
 * Edits a robot's description only (PATCH {description}). The name and token
 * are immutable.
 *
 * @component
 */

import { useEffect, useState } from 'react';
import {
  ActionGroup,
  Alert,
  Button,
  Form,
  FormGroup,
  Modal,
  ModalVariant,
  TextArea,
} from '@patternfly/react-core';
import { robotsApi } from '../../services/robotsApi';
import { useNotifications } from '../../hooks/useNotifications';
import type { RobotDetails } from '../../types/api';

interface EditRobotModalProps {
  /** Robot being edited */
  robot: RobotDetails;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when the modal is dismissed */
  onClose: () => void;
  /** Called after the description is saved */
  onSuccess: () => void;
}

export function EditRobotModal({ robot, isOpen, onClose, onSuccess }: EditRobotModalProps) {
  const { showSuccess } = useNotifications();
  const [description, setDescription] = useState(robot.description || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form from the robot each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setDescription(robot.description || '');
      setError(null);
    }
  }, [isOpen, robot]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await robotsApi.updateRobot(robot.name, { description: description.trim() });
      showSuccess('Robot updated', `Robot "${robot.name}" has been updated`);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update robot');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      variant={ModalVariant.small}
      title={`Edit Robot: ${robot.name}`}
      isOpen={isOpen}
      onClose={onClose}
    >
      <Form>
        <FormGroup label="Name" fieldId="edit-robot-name">
          <span id="edit-robot-name">{robot.name}</span>
          <p style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)', color: 'var(--pf-v5-global--Color--200)' }}>
            The robot name cannot be changed.
          </p>
        </FormGroup>

        <FormGroup label="Description" fieldId="edit-robot-description">
          <TextArea
            id="edit-robot-description"
            value={description}
            onChange={(_event, value) => setDescription(value)}
            isDisabled={submitting}
            rows={3}
          />
        </FormGroup>

        {error && <Alert variant="danger" title={error} isInline />}

        <ActionGroup>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={submitting}
            isDisabled={submitting}
          >
            Save
          </Button>
          <Button variant="link" onClick={onClose} isDisabled={submitting}>
            Cancel
          </Button>
        </ActionGroup>
      </Form>
    </Modal>
  );
}
