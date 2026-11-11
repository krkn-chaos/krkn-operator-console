import type { ReactNode } from 'react';
import { Modal, ModalVariant } from '@patternfly/react-core';

interface FormModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Shared medium-sized modal shell for standalone create and edit forms. */
export function FormModal({ isOpen, title, description, onClose, children }: FormModalProps) {
  return (
    <Modal
      variant={ModalVariant.medium}
      title={title}
      description={description}
      isOpen={isOpen}
      onClose={onClose}
    >
      {children}
    </Modal>
  );
}
