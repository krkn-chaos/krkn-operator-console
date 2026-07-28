import { useState } from 'react';
import {
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Button,
} from '@patternfly/react-core';
import { PlusCircleIcon, DownloadIcon, SaveIcon, TrashIcon } from '@patternfly/react-icons';
import { HiOutlineRocketLaunch } from 'react-icons/hi2';
import { operatorApi } from '../../services/operatorApi';
import { useStudioContext } from './StudioContext';
import { useNotifications } from '../../hooks';
import { SaveWorkflowModal } from './SaveWorkflowModal';
import { SaveWorkflowConfirmModal } from './SaveWorkflowConfirmModal';

interface StudioToolbarProps {
  onRunWorkflow: () => void;
}

export function StudioToolbar({ onRunWorkflow }: StudioToolbarProps) {
  const { addNode, exportWorkflow, clearWorkflow, workflow, savedFile, setSavedFile, isDirty, isEditingDetails } = useStudioContext();
  const { showError } = useNotifications();
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

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

  const handleRunWithGuard = async () => {
    if (savedFile && isDirty) {
      if (confirm('You have unsaved changes. Save before running?')) {
        try {
          await operatorApi.updateFile(savedFile.fileId, {
            fileName: savedFile.fileName,
            content: JSON.stringify(workflow),
            description: savedFile.description,
            availableToAll: savedFile.availableToAll,
            groups: savedFile.groups,
            filePurpose: 'workflow-template',
          });
          setSavedFile({ ...savedFile, savedAt: new Date().toISOString() });
        } catch (err) {
          showError('Save failed', err instanceof Error ? err.message : 'Failed to save workflow');
          return;
        }
      }
    }
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
              Save to Cluster
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
    </>
  );
}
