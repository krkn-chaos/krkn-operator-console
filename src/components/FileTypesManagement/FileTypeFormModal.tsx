/**
 * FileTypeFormModal - Standalone modal for file type create/edit
 *
 * Child modal opened on top of FileManagementModal
 * No tabs, just the form
 */

import { Modal, ModalVariant } from '@patternfly/react-core';
import { FileTypeForm } from './FileTypeForm';
import type { FileTypeResponse } from '../../types/api';

interface FileTypeFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: FileTypeResponse;
  onClose: () => void;
  onSuccess: () => void;
}

export function FileTypeFormModal({
  isOpen,
  mode,
  initialData,
  onClose,
  onSuccess,
}: FileTypeFormModalProps) {
  return (
    <Modal
      variant={ModalVariant.small}
      title={mode === 'create' ? 'Create File Type' : 'Edit File Type'}
      isOpen={isOpen}
      onClose={onClose}
      description="File type metadata (color customization)"
    >
      <FileTypeForm
        mode={mode}
        initialData={initialData}
        onSuccess={onSuccess}
        onCancel={onClose}
      />
    </Modal>
  );
}
