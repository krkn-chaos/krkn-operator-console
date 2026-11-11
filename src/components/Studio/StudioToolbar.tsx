import { useState, useRef } from 'react';
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
import { PlusCircleIcon, DownloadIcon, UploadIcon, SaveIcon, TrashIcon, ExclamationCircleIcon, ExclamationTriangleIcon } from '@patternfly/react-icons';
import { HiOutlineRocketLaunch } from 'react-icons/hi2';
import { useStudioContext } from './StudioContext';
import { useNotifications } from '../../hooks';
import { SaveWorkflowModal } from './SaveWorkflowModal';
import { SaveWorkflowConfirmModal } from './SaveWorkflowConfirmModal';
import { parseImportedWorkflow, assembleExportFile } from './studioImport';
import { downloadJson } from '../../utils/downloadJson';

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
  const { addNode, exportWorkflow, clearWorkflow, importWorkflow, workflow, savedWorkflow, saveWorkflowToCluster, isDirty, isEditingDetails } = useStudioContext();
  const { showError, showSuccess, showWarning } = useNotifications();
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState(false);
  const [isSavingBeforeRun, setIsSavingBeforeRun] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const result = exportWorkflow();

    if ('error' in result) {
      alert(result.error);
      return;
    }

    // Write a krknctl-compatible file: the top level is the flat executable
    // graph, with Studio state embedded under `_studioLayout`/`_metadata` so the
    // file both runs in krknctl and re-imports losslessly via "Import JSON".
    const file = assembleExportFile(result.graph, result.studioLayout, result.metadata);
    downloadJson(file, `chaos-workflow-${Date.now()}.json`);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input so selecting the same file again re-fires onChange.
    event.target.value = '';
    if (!file) return;

    const hasUnsavedChanges = (savedWorkflow && isDirty) || (!savedWorkflow && workflow.nodes.length > 0);
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Importing a workflow will discard them. Continue?')) {
        return;
      }
    }

    try {
      const text = await file.text();
      const { workflow: imported, lossy } = parseImportedWorkflow(text);
      importWorkflow(imported);
      if (lossy) {
        showWarning(
          'Workflow imported with limited detail',
          'This file only contained the executable graph. Positions were auto-arranged and some node settings (registry, global values) may need to be reviewed.'
        );
      } else {
        showSuccess('Workflow imported', `Imported ${imported.nodes.length} node(s) successfully`);
      }
    } catch (err) {
      showError('Import failed', err instanceof Error ? err.message : 'Failed to import workflow');
    }
  };

  const handleSave = () => {
    if (savedWorkflow) {
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

    if (savedWorkflow && isDirty) {
      setIsUnsavedModalOpen(true);
      return;
    }
    onRunWorkflow();
  };

  const handleSaveAndRun = async () => {
    if (!savedWorkflow) return;
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
              icon={<UploadIcon />}
              onClick={handleImportClick}
            >
              Import JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
              aria-label="Import workflow JSON file"
            />
          </ToolbarItem>

          <ToolbarItem>
            <Button
              variant="secondary"
              icon={<SaveIcon />}
              onClick={handleSave}
              isDisabled={workflow.nodes.length === 0 || isEditingDetails}
            >
              {savedWorkflow && isDirty ? 'Update Workflow' : 'Save Workflow'}
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
          The workflow <strong>&laquo;{savedWorkflow?.workflowName}&raquo;</strong> has unsaved changes.
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
