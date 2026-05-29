/**
 * StudioNodeModals - Clone and Delete modals for nodes
 *
 * Separated from context menu to prevent unmounting issues.
 */

import { useState } from 'react';
import {
  Modal,
  ModalVariant,
  Form,
  FormGroup,
  TextInput,
  Button,
  Alert,
} from '@patternfly/react-core';
import { useStudioContext } from './StudioContext';
import type { StudioNode } from '../../types/api';

interface StudioNodeModalsProps {
  cloneNode: StudioNode | null;
  deleteNode: StudioNode | null;
  onCloseClone: () => void;
  onCloseDelete: () => void;
}

export function StudioNodeModals({
  cloneNode: cloneNodeData,
  deleteNode: deleteNodeData,
  onCloseClone,
  onCloseDelete,
}: StudioNodeModalsProps) {
  const { cloneNode, deleteNode, validateNodeId } = useStudioContext();
  const [cloneNodeId, setCloneNodeId] = useState('');
  const [cloneError, setCloneError] = useState<string | undefined>(undefined);

  const handleCloneNodeIdChange = (value: string) => {
    setCloneNodeId(value);
    const validation = validateNodeId(value);
    setCloneError(validation.valid ? undefined : validation.error);
  };

  const handleCloneConfirm = () => {
    if (!cloneNodeData || !cloneNodeId || cloneError) return;

    console.log('[handleCloneConfirm] Calling cloneNode', {
      source: cloneNodeData.nodeId,
      new: cloneNodeId,
    });
    cloneNode(cloneNodeData.nodeId, cloneNodeId);
    setCloneNodeId('');
    setCloneError(undefined);
    onCloseClone();
  };

  const handleDeleteConfirm = () => {
    if (!deleteNodeData) return;
    deleteNode(deleteNodeData.nodeId);
    onCloseDelete();
  };

  const handleCloseClone = () => {
    setCloneNodeId('');
    setCloneError(undefined);
    onCloseClone();
  };

  return (
    <>
      {/* Clone Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Clone Node"
        isOpen={!!cloneNodeData}
        onClose={handleCloseClone}
      >
        {cloneNodeData && (
          <>
            <Form>
              <FormGroup label="New Node ID" isRequired fieldId="clone-node-id">
                <TextInput
                  id="clone-node-id"
                  value={cloneNodeId}
                  onChange={(_event, value) => handleCloneNodeIdChange(value)}
                  validated={cloneError ? 'error' : 'default'}
                  placeholder="e.g., my-scenario-2"
                  autoFocus
                />
                {cloneError && (
                  <Alert variant="danger" isInline title={cloneError} style={{ marginTop: '0.5rem' }} />
                )}
                <div style={{ marginTop: '0.5rem', fontSize: 'var(--pf-v5-global--FontSize--sm)', color: 'var(--pf-v5-global--Color--200)' }}>
                  The cloned node will have the same configuration as "{cloneNodeData.nodeId}" but with a new ID.
                </div>
              </FormGroup>
            </Form>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <Button variant="link" onClick={handleCloseClone}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCloneConfirm}
                isDisabled={!cloneNodeId || !!cloneError}
              >
                Clone
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Delete Node"
        isOpen={!!deleteNodeData}
        onClose={onCloseDelete}
      >
        {deleteNodeData && (
          <>
            <p>
              Are you sure you want to delete node <strong>{deleteNodeData.nodeId}</strong>?
            </p>
            {deleteNodeData.status === 'configured' && (
              <p style={{ marginTop: '1rem', color: 'var(--pf-v5-global--warning-color--100)' }}>
                This node is configured with scenario <strong>{deleteNodeData.config?.scenarioName}</strong>.
                All connections will also be removed.
              </p>
            )}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <Button variant="link" onClick={onCloseDelete}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteConfirm}>
                Delete
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
