/**
 * StudioNodeContextMenu - Context menu for node actions
 *
 * Provides Edit, Delete, and Clone actions for scenario nodes.
 */

import { useState } from 'react';
import {
  Dropdown,
  DropdownList,
  DropdownItem,
  MenuToggle,
  Modal,
  ModalVariant,
  Form,
  FormGroup,
  TextInput,
  Button,
  Alert,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { useStudioContext } from './StudioContext';
import type { StudioNode } from '../../types/api';

interface StudioNodeContextMenuProps {
  node: StudioNode;
  onEdit: (node: StudioNode) => void;
}

export function StudioNodeContextMenu({ node, onEdit }: StudioNodeContextMenuProps) {
  const { deleteNode, cloneNode, validateNodeId } = useStudioContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [cloneNodeId, setCloneNodeId] = useState('');
  const [cloneError, setCloneError] = useState<string | undefined>(undefined);

  const handleEdit = () => {
    setIsOpen(false);
    onEdit(node);
  };

  const handleDeleteClick = () => {
    setIsOpen(false);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    deleteNode(node.nodeId);
    setIsDeleteModalOpen(false);
  };

  const handleCloneClick = () => {
    setIsOpen(false);
    setIsCloneModalOpen(true);
    setCloneNodeId('');
    setCloneError(undefined);
  };

  const handleCloneNodeIdChange = (value: string) => {
    setCloneNodeId(value);
    const validation = validateNodeId(value);
    setCloneError(validation.valid ? undefined : validation.error);
  };

  const handleCloneConfirm = () => {
    if (!cloneNodeId || cloneError) return;

    cloneNode(node.nodeId, cloneNodeId);
    setIsCloneModalOpen(false);
    setCloneNodeId('');
    setCloneError(undefined);
  };

  const isConfigured = node.status === 'configured';

  return (
    <>
      <Dropdown
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        toggle={(toggleRef) => (
          <MenuToggle
            ref={toggleRef}
            onClick={() => setIsOpen(!isOpen)}
            variant="plain"
            aria-label="Node actions"
          >
            <EllipsisVIcon />
          </MenuToggle>
        )}
      >
        <DropdownList>
          <DropdownItem key="edit" onClick={handleEdit}>
            {isConfigured ? 'Edit' : 'Configure'}
          </DropdownItem>
          {isConfigured && (
            <DropdownItem key="clone" onClick={handleCloneClick}>
              Clone
            </DropdownItem>
          )}
          <DropdownItem key="delete" onClick={handleDeleteClick}>
            Delete
          </DropdownItem>
        </DropdownList>
      </Dropdown>

      {/* Clone Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Clone Node"
        isOpen={isCloneModalOpen}
        onClose={() => setIsCloneModalOpen(false)}
      >
        <Form>
          <FormGroup label="New Node ID" isRequired fieldId="clone-node-id">
            <TextInput
              id="clone-node-id"
              value={cloneNodeId}
              onChange={(_event, value) => handleCloneNodeIdChange(value)}
              validated={cloneError ? 'error' : 'default'}
              placeholder="e.g., my-scenario-2"
            />
            {cloneError && (
              <Alert variant="danger" isInline title={cloneError} style={{ marginTop: '0.5rem' }} />
            )}
            <div style={{ marginTop: '0.5rem', fontSize: 'var(--pf-v5-global--FontSize--sm)', color: 'var(--pf-v5-global--Color--200)' }}>
              The cloned node will have the same configuration as "{node.nodeId}" but with a new ID.
            </div>
          </FormGroup>
        </Form>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <Button variant="link" onClick={() => setIsCloneModalOpen(false)}>
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
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Delete Node"
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      >
        <p>
          Are you sure you want to delete node <strong>{node.nodeId}</strong>?
        </p>
        {isConfigured && (
          <p style={{ marginTop: '1rem', color: 'var(--pf-v5-global--warning-color--100)' }}>
            This node is configured with scenario <strong>{node.config?.scenarioName}</strong>.
            All connections will also be removed.
          </p>
        )}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <Button variant="link" onClick={() => setIsDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteConfirm}>
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
