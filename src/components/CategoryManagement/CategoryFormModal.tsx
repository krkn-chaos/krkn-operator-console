import { FormModal } from '../FormModal';
import { CategoryForm } from './CategoryForm';
import type { CategoryResponse } from '../../types/api';

interface CategoryFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: CategoryResponse;
  onClose: () => void;
  onSuccess: () => void;
}

/** Modal containing the category create and edit form. */
export function CategoryFormModal({
  isOpen,
  mode,
  initialData,
  onClose,
  onSuccess,
}: CategoryFormModalProps) {
  return (
    <FormModal
      title={mode === 'create' ? 'Create Category' : 'Edit Category'}
      description="Category name cannot be changed after creation."
      isOpen={isOpen}
      onClose={onClose}
    >
      <CategoryForm
        key={`${isOpen}-${mode}-${initialData?.name || 'new'}`}
        mode={mode}
        initialData={initialData}
        onSuccess={onSuccess}
        onCancel={onClose}
      />
    </FormModal>
  );
}
