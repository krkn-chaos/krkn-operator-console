/**
 * StudioRecoveryModal - Autosave recovery modal
 *
 * Shown when autosave data is found on page load.
 * Allows user to resume or discard the saved workflow.
 */

import {
  Modal,
  ModalVariant,
  Button,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';

interface StudioRecoveryModalProps {
  isOpen: boolean;
  timestamp: number;
  onResume: () => void;
  onDiscard: () => void;
}

export function StudioRecoveryModal({
  isOpen,
  timestamp,
  onResume,
  onDiscard,
}: StudioRecoveryModalProps) {
  const formatTimestamp = (ts: number): string => {
    try {
      const date = new Date(ts);
      return date.toLocaleString();
    } catch {
      return 'Unknown time';
    }
  };

  return (
    <Modal
      variant={ModalVariant.small}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ExclamationTriangleIcon style={{ color: 'var(--pf-v5-global--warning-color--100)' }} />
          <span>Unsaved Workflow Found</span>
        </div>
      }
      isOpen={isOpen}
      onClose={onDiscard}
      actions={[
        <Button key="resume" variant="primary" onClick={onResume}>
          Resume
        </Button>,
        <Button key="discard" variant="link" onClick={onDiscard}>
          Discard
        </Button>,
      ]}
    >
      <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
        <FlexItem>
          <p>
            An autosaved workflow was found from:
          </p>
          <p style={{ fontWeight: 'bold', marginTop: '0.5rem' }}>
            {formatTimestamp(timestamp)}
          </p>
        </FlexItem>

        <FlexItem>
          <p>
            Would you like to resume working on it, or start fresh?
          </p>
        </FlexItem>
      </Flex>
    </Modal>
  );
}
