/**
 * RobotConfirmModal component
 *
 * Shared small confirmation modal for destructive or disruptive robot
 * actions (rotate, revoke, disable, enable, delete). Copy is per-action and
 * comes from the approved design review. Delete additionally requires typing
 * the robot's name.
 *
 * Danger-variant buttons appear ONLY inside confirmation modals like this one.
 *
 * @component
 */

import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  FormGroup,
  Modal,
  ModalVariant,
  TextInput,
} from '@patternfly/react-core';

export type RobotConfirmAction = 'rotate' | 'revoke' | 'disable' | 'enable' | 'delete';

interface RobotConfirmModalProps {
  /** Which action is being confirmed */
  action: RobotConfirmAction;
  /** Name of the target robot */
  robotName: string;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Whether the action is currently submitting */
  isSubmitting: boolean;
  /** Inline error message from the failed action, if any */
  error?: string | null;
  /** Called when the modal is dismissed */
  onClose: () => void;
  /** Called when the action is confirmed */
  onConfirm: () => void;
}

const TITLES: Record<RobotConfirmAction, string> = {
  rotate: 'Rotate token',
  revoke: 'Revoke token',
  disable: 'Disable robot',
  enable: 'Enable robot',
  delete: 'Delete robot',
};

const CONFIRM_LABELS: Record<RobotConfirmAction, string> = {
  rotate: 'Rotate token',
  revoke: 'Revoke token',
  disable: 'Disable robot',
  enable: 'Enable robot',
  delete: 'Delete robot',
};

/** Confirm button variant — danger/warning variants are confined to confirm modals */
const CONFIRM_VARIANTS: Record<RobotConfirmAction, 'danger' | 'warning' | 'primary'> = {
  rotate: 'warning',
  revoke: 'danger',
  disable: 'warning',
  enable: 'primary',
  delete: 'danger',
};

function bodyFor(action: RobotConfirmAction, robotName: string): string {
  switch (action) {
    case 'rotate':
      return `The current token for "${robotName}" stops working immediately; agents using it get 401 until updated.`;
    case 'revoke':
      return `Permanently invalidates the token for "${robotName}". This cannot be undone, but you can issue a new one later. Revocation works even while the robot is disabled.`;
    case 'disable':
      return `Blocks all MCP requests from "${robotName}" immediately. The token is kept and works again if you re-enable the robot (unless expired). Revoke the token instead for permanent invalidation.`;
    case 'enable':
      return `If "${robotName}" still has an unexpired token, it becomes valid again immediately.`;
    case 'delete':
      return `Deletes the robot "${robotName}" and its token. Runs it created remain. A new robot with the same name does not inherit the token but is treated as owner of this robot's existing runs.`;
  }
}

export function RobotConfirmModal({
  action,
  robotName,
  isOpen,
  isSubmitting,
  error,
  onClose,
  onConfirm,
}: RobotConfirmModalProps) {
  const [typedName, setTypedName] = useState('');

  // Reset the type-the-name confirmation each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setTypedName('');
    }
  }, [isOpen]);

  const nameConfirmed = action !== 'delete' || typedName === robotName;

  return (
    <Modal
      variant={ModalVariant.small}
      title={TITLES[action]}
      isOpen={isOpen}
      onClose={onClose}
      actions={[
        <Button
          key="confirm"
          variant={CONFIRM_VARIANTS[action]}
          onClick={onConfirm}
          isLoading={isSubmitting}
          isDisabled={isSubmitting || !nameConfirmed}
        >
          {CONFIRM_LABELS[action]}
        </Button>,
        <Button key="cancel" variant="link" onClick={onClose} isDisabled={isSubmitting}>
          Cancel
        </Button>,
      ]}
    >
      <p>{bodyFor(action, robotName)}</p>

      {action === 'delete' && (
        <FormGroup
          label={`Type the robot name "${robotName}" to confirm`}
          fieldId="robot-confirm-name"
          style={{ marginTop: '1rem' }}
        >
          <TextInput
            id="robot-confirm-name"
            value={typedName}
            onChange={(_event, value) => setTypedName(value)}
            placeholder={robotName}
            isDisabled={isSubmitting}
            autoComplete="off"
          />
        </FormGroup>
      )}

      {error && (
        <Alert variant="danger" title={error} isInline style={{ marginTop: '1rem' }} />
      )}
    </Modal>
  );
}
