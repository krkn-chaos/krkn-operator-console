import { useState } from 'react';
import {
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Button,
  Modal,
  ModalVariant,
  List,
  ListItem,
  Spinner,
} from '@patternfly/react-core';
import { PlusCircleIcon, DownloadIcon, SaveIcon, TrashIcon, ExclamationCircleIcon, ExclamationTriangleIcon } from '@patternfly/react-icons';
import { HiOutlineRocketLaunch } from 'react-icons/hi2';
import { useStudioContext } from './StudioContext';
import { useNotifications } from '../../hooks';
import { SaveWorkflowModal } from './SaveWorkflowModal';
import { SaveWorkflowConfirmModal } from './SaveWorkflowConfirmModal';

interface StudioToolbarProps {
  onRunWorkflow: () => void;
}

/**
 * Toolbar for Chaos Studio canvas actions.
 *
 * Provides buttons for: Add Scenario, Run Workflow, Export JSON, Save Workflow,
 * and Clear All. Includes pre-run validation (blocks unconfigured nodes) and an
 * unsaved-changes guard with Save & Run / Run without saving options.
 *
 * The save button label changes dynamically:
 * - "Save Workflow" for new workflows or clean saved workflows.
 * - "Update Workflow" when a saved workflow has pending changes.
 *
 * @example
 * ```tsx
 * <StudioToolbar onRunWorkflow={() => openRunModal()} />
 * ```
 */
export function StudioToolbar({ onRunWorkflow }: StudioToolbarProps) {
  const { addNode, exportWorkflow, clearWorkflow, workflow, savedFile, saveWorkflowToCluster, isDirty, isEditingDetails } = useStudioContext();
  const { showError } = useNotifications();
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState(false);
  const [isSavingBeforeRun, setIsSavingBeforeRun] = useState(false);

  const handleExport = () => {
    const result = exportWorkflow();

    if ('error' in result) {
      alert(result.error);
      return;
    }

    const blob = new Blob([JSON.stringify(result.graph, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chaos-workflow-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (savedFile) {
      setIsConfirmModalOpen(true);
    } else {
      setIsSaveModalOpen(true);
    }
  };

  const validateWorkflow = (): string[] => {
    const errors: string[] = [];

    const unconfigured = workflow.nodes.filter(n => n.status !== 'configured');
    if (unconfigured.length > 0) {
      errors.push(
        `${unconfigured.length} node(s) not configured: ${unconfigured.map(n => n.nodeId).join(', ')}`
      );
    }

    return errors;
  };

  const handleRunWithGuard = () => {
    const errors = validateWorkflow();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (savedFile && isDirty) {
      setIsUnsavedModalOpen(true);
      return;
    }
    onRunWorkflow();
  };

  const handleSaveAndRun = async () => {
    if (!savedFile) return;
    setIsSavingBeforeRun(true);
    try {
      await saveWorkflowToCluster();
      setIsUnsavedModalOpen(false);
      onRunWorkflow();
    } catch (err) {
      showError('Save failed', err instanceof Error ? err.message : 'Failed to save workflow');
    } finally {
      setIsSavingBeforeRun(false);
    }
  };

  const handleRunWithoutSaving = () => {
    setIsUnsavedModalOpen(false);
    onRunWorkflow();
  };

  const handleClearAll = () => {
    if (workflow.nodes.length === 0) return;

    if (confirm('Are you sure you want to clear the entire workflow? This cannot be undone.')) {
      clearWorkflow();
    }
  };

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <Button
              variant="primary"
              icon={<PlusCircleIcon />}
              onClick={addNode}
            >
              Add Scenario
            </Button>
          </ToolbarItem>

          <ToolbarItem>
            <Button
              variant="primary"
              icon={<HiOutlineRocketLaunch />}
              onClick={handleRunWithGuard}
              isDisabled={workflow.nodes.length === 0}
            >
              Run Workflow
            </Button>
          </ToolbarItem>

          <ToolbarItem variant="separator" />

          <ToolbarItem>
            <Button
              variant="secondary"
              icon={<DownloadIcon />}
              onClick={handleExport}
              isDisabled={workflow.nodes.length === 0}
            >
              Export JSON
            </Button>
          </ToolbarItem>

          <ToolbarItem>
            <Button
              variant="secondary"
              icon={<SaveIcon />}
              onClick={handleSave}
              isDisabled={workflow.nodes.length === 0 || isEditingDetails}
            >
              {savedFile && isDirty ? 'Update Workflow' : 'Save Workflow'}
            </Button>
          </ToolbarItem>

          <ToolbarItem variant="separator" />

          <ToolbarItem>
            <Button
              variant="danger"
              icon={<TrashIcon />}
              onClick={handleClearAll}
              isDisabled={workflow.nodes.length === 0}
            >
              Clear All
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      <SaveWorkflowModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSuccess={() => setIsSaveModalOpen(false)}
      />

      <SaveWorkflowConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onSuccess={() => setIsConfirmModalOpen(false)}
      />

      <Modal
        variant={ModalVariant.small}
        title="Unsaved changes"
        titleIconVariant={ExclamationTriangleIcon}
        isOpen={isUnsavedModalOpen}
        onClose={() => !isSavingBeforeRun && setIsUnsavedModalOpen(false)}
        actions={[
          <Button
            key="save-run"
            variant="primary"
            icon={isSavingBeforeRun ? <Spinner size="sm" /> : <SaveIcon />}
            onClick={handleSaveAndRun}
            isDisabled={isSavingBeforeRun}
          >
            {isSavingBeforeRun ? 'Saving...' : 'Save & Run'}
          </Button>,
          <Button
            key="run"
            variant="secondary"
            onClick={handleRunWithoutSaving}
            isDisabled={isSavingBeforeRun}
          >
            Run without saving
          </Button>,
          <Button
            key="cancel"
            variant="link"
            onClick={() => setIsUnsavedModalOpen(false)}
            isDisabled={isSavingBeforeRun}
          >
            Cancel
          </Button>,
        ]}
      >
        <p>
          The workflow <strong>&laquo;{savedFile?.fileName}&raquo;</strong> has unsaved changes.
          Would you like to save before running?
        </p>
      </Modal>

      <Modal
        variant={ModalVariant.small}
        title="Cannot run workflow"
        titleIconVariant={ExclamationCircleIcon}
        isOpen={validationErrors.length > 0}
        onClose={() => setValidationErrors([])}
        actions={[
          <Button key="ok" variant="primary" onClick={() => setValidationErrors([])}>
            OK
          </Button>,
        ]}
      >
        <p style={{ marginBottom: '0.5rem' }}>Please fix the following issues before running:</p>
        <List>
          {validationErrors.map((err, i) => (
            <ListItem key={i}>{err}</ListItem>
          ))}
        </List>
      </Modal>
    </>
  );
}
