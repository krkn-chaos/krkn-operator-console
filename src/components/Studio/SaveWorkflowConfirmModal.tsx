import { useState } from 'react';
import {
  Modal,
  ModalVariant,
  Button,
  Spinner,
} from '@patternfly/react-core';
import { useStudioContext } from './StudioContext';
import { useNotifications } from '../../hooks';

interface SaveWorkflowConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SaveWorkflowConfirmModal({ isOpen, onClose, onSuccess }: SaveWorkflowConfirmModalProps) {
  const { savedFile, saveWorkflowToCluster } = useStudioContext();
  const { showSuccess, showError } = useNotifications();
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdate = async () => {
    if (!savedFile) return;

    setIsSaving(true);
    try {
      await saveWorkflowToCluster();
      showSuccess('Workflow updated', `"${savedFile.fileName}" updated successfully`);
      onClose();
      onSuccess();
    } catch (err) {
      showError('Update failed', err instanceof Error ? err.message : 'Failed to update workflow');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      variant={ModalVariant.small}
      title="Update Workflow"
      isOpen={isOpen}
      onClose={onClose}
      actions={[
        <Button
          key="update"
          variant="primary"
          onClick={handleUpdate}
          isDisabled={isSaving}
          icon={isSaving ? <Spinner size="sm" /> : undefined}
        >
          {isSaving ? 'Updating...' : 'Update'}
        </Button>,
        <Button key="cancel" variant="link" onClick={onClose} isDisabled={isSaving}>
          Cancel
        </Button>,
      ]}
    >
      <p>
        Are you sure you want to update the workflow <strong>&laquo;{savedFile?.fileName}&raquo;</strong>?
      </p>
    </Modal>
  );
}
