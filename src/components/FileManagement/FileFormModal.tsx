/**
 * FileFormModal - Standalone modal for file create/edit
 *
 * Child modal opened on top of FileManagementModal
 * No tabs, just the form
 */

import { Modal, ModalVariant } from '@patternfly/react-core';
import { FileForm } from './FileForm';
import type { FileInfo, FileTypeResponse } from '../../types/api';

interface FileFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: FileInfo;
  availableFileTypes: FileTypeResponse[];
  onClose: () => void;
  onSuccess: () => void;
  onRequestNewFileType: () => void;
}

export function FileFormModal({
  isOpen,
  mode,
  initialData,
  availableFileTypes,
  onClose,
  onSuccess,
  onRequestNewFileType,
}: FileFormModalProps) {
  return (
    <Modal
      variant={ModalVariant.medium}
      title={mode === 'create' ? 'Create File' : 'Edit File'}
      isOpen={isOpen}
      onClose={onClose}
      description="ConfigMap-based file configuration"
    >
      <FileForm
        mode={mode}
        initialData={initialData}
        availableFileTypes={availableFileTypes}
        onSuccess={onSuccess}
        onCancel={onClose}
        onRequestNewFileType={onRequestNewFileType}
      />
    </Modal>
  );
}
