import { Modal, ModalVariant } from '@patternfly/react-core';
import { ComponentVersionsCard } from './ComponentVersionsCard';

interface ComponentVersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Shows published operator versions to any authenticated console user. */
export function ComponentVersionsModal({ isOpen, onClose }: ComponentVersionsModalProps) {
  return (
    <Modal
      variant={ModalVariant.medium}
      title="Component Versions"
      isOpen={isOpen}
      onClose={onClose}
    >
      {isOpen && <ComponentVersionsCard />}
    </Modal>
  );
}
