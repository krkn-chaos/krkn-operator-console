/**
 * FileFormModal - Standalone modal for file create/edit
 *
 * Child modal opened on top of FileManagementModal
 * No tabs, just the form
 */

import { FormModal } from '../FormModal';
import { FileForm } from './FileForm';
import type { FileInfo } from '../../types/api';

interface FileFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: FileInfo;
  categoriesSupported?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function FileFormModal({
  isOpen,
  mode,
  initialData,
  categoriesSupported,
  onClose,
  onSuccess,
}: FileFormModalProps) {
  return (
    <FormModal
      title={mode === 'create' ? 'Create File' : 'Edit File'}
      isOpen={isOpen}
      onClose={onClose}
      description="ConfigMap-based file configuration"
    >
      <FileForm
        mode={mode}
        initialData={initialData}
        categoriesSupported={categoriesSupported}
        onSuccess={onSuccess}
        onCancel={onClose}
      />
    </FormModal>
  );
}
