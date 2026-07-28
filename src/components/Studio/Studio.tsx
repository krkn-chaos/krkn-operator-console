/**
 * Studio - Main container for Chaos Scenario Studio
 *
 * Visual workflow designer for creating complex chaos scenarios.
 * Features:
 * - Drag-and-drop node canvas
 * - Visual dependency management
 * - Configuration wizard for scenarios
 * - Export to GraphRunSpec JSON
 * - Autosave/Recovery
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Title,
  Card,
  CardBody,
  CardTitle,
  Button,
  Flex,
  FlexItem,
  Modal,
  ModalVariant,
  Spinner,
} from '@patternfly/react-core';
import { ArrowLeftIcon, PencilAltIcon, TrashIcon, ExclamationTriangleIcon, SaveIcon } from '@patternfly/react-icons';
import { useAppContext } from '../../context/AppContext';
import { useStudioTargetFetch } from '../../hooks/useStudioTargetFetch';
import { useNotifications } from '../../hooks';
import { operatorApi } from '../../services/operatorApi';
import { StudioProvider, useStudioContext } from './StudioContext';
import { loadAutosave, clearAutosave } from './studioAutosave';
import { StudioToolbar } from './StudioToolbar';
import { StudioCanvas } from './StudioCanvas';
import { StudioRecoveryModal } from './StudioRecoveryModal';
import { StudioNodeEditorModal } from './StudioNodeEditorModal';
import { RunWorkflowModal } from './RunWorkflowModal';
import { LoadWorkflowSelect } from './LoadWorkflowSelect';
import { WorkflowDetailsPanel } from './WorkflowDetailsPanel';
import { studioLeaveGuard } from './studioLeaveGuard';
import type { StudioWorkflow, StudioNode } from '../../types/api';

function StudioContent() {
  const { dispatch } = useAppContext();
  const { updateNode, workflow, savedFile, isDirty, saveWorkflowToCluster, clearSavedFile, clearWorkflow, isEditingDetails, setIsEditingDetails } = useStudioContext();
  const { showSuccess, showError } = useNotifications();
  const [selectedNode, setSelectedNode] = useState<StudioNode | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isRunWorkflowOpen, setIsRunWorkflowOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isSavingBeforeLeave, setIsSavingBeforeLeave] = useState(false);
  const [leaveReason, setLeaveReason] = useState<'dirty' | 'unsaved' | 'editing'>('dirty');
  const pendingLeaveAction = useRef<(() => void) | null>(null);
  const targetFetch = useStudioTargetFetch();

  const workflowRef = useRef(workflow);
  workflowRef.current = workflow;
  const savedFileRef = useRef(savedFile);
  savedFileRef.current = savedFile;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const isEditingDetailsRef = useRef(isEditingDetails);
  isEditingDetailsRef.current = isEditingDetails;

  useEffect(() => {
    studioLeaveGuard.current = (proceed: () => void) => {
      if (isEditingDetailsRef.current) {
        pendingLeaveAction.current = proceed;
        setLeaveReason('editing');
        setIsLeaveModalOpen(true);
        return false;
      }
      if (workflowRef.current.nodes.length === 0) return true;
      if (savedFileRef.current && isDirtyRef.current) {
        pendingLeaveAction.current = proceed;
        setLeaveReason('dirty');
        setIsLeaveModalOpen(true);
        return false;
      }
      if (!savedFileRef.current) {
        pendingLeaveAction.current = proceed;
        setLeaveReason('unsaved');
        setIsLeaveModalOpen(true);
        return false;
      }
      return true;
    };
    return () => { studioLeaveGuard.current = null; };
  }, []);

  const handleLeaveWithoutSaving = useCallback(() => {
    if (leaveReason === 'unsaved') clearAutosave();
    if (leaveReason === 'editing') setIsEditingDetails(false);
    setIsLeaveModalOpen(false);
    pendingLeaveAction.current?.();
    pendingLeaveAction.current = null;
  }, [leaveReason, setIsEditingDetails]);

  const handleSaveAndLeave = useCallback(async () => {
    setIsSavingBeforeLeave(true);
    try {
      await saveWorkflowToCluster();
      setIsLeaveModalOpen(false);
      pendingLeaveAction.current?.();
      pendingLeaveAction.current = null;
    } catch (err) {
      showError('Save failed', err instanceof Error ? err.message : 'Failed to save workflow');
    } finally {
      setIsSavingBeforeLeave(false);
    }
  }, [saveWorkflowToCluster, showError]);

  const handleCancelLeave = useCallback(() => {
    setIsLeaveModalOpen(false);
    pendingLeaveAction.current = null;
  }, []);

  const handleDeleteWorkflow = useCallback(async () => {
    if (!savedFile) return;
    setIsDeleting(true);
    try {
      await operatorApi.deleteFile(savedFile.fileId);
      showSuccess('Workflow deleted', `"${savedFile.fileName}" deleted from cluster`);
      setIsDeleteModalOpen(false);
      clearSavedFile();
      clearWorkflow();
    } catch (err) {
      showError('Delete failed', err instanceof Error ? err.message : 'Failed to delete workflow');
    } finally {
      setIsDeleting(false);
    }
  }, [savedFile, clearSavedFile, clearWorkflow, showSuccess, showError]);

  const handleNodeClick = useCallback((node: StudioNode) => {
    setSelectedNode(node);
    setIsEditorOpen(true);
  }, []);

  const handleEditorClose = useCallback(() => {
    setIsEditorOpen(false);
    setSelectedNode(null);
  }, []);

  const handleEditorSave = useCallback((nodeId: string, updates: Partial<StudioNode>) => {
    updateNode(nodeId, updates);
    setIsEditorOpen(false);
    setSelectedNode(null);
  }, [updateNode]);

  const handleBackToRuns = useCallback(() => {
    const proceed = () => dispatch({ type: 'JOBS_LIST_READY' });
    if (studioLeaveGuard.current && !studioLeaveGuard.current(proceed)) return;
    proceed();
  }, [dispatch]);

  const handleRunWorkflow = useCallback(() => {
    // Blur the active element to prevent aria-hidden warning
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsRunWorkflowOpen(true);
    targetFetch.startFetch();
  }, [targetFetch]);

  const handleRunWorkflowClose = useCallback(() => {
    setIsRunWorkflowOpen(false);
    targetFetch.reset();
  }, [targetFetch]);

  const handleRunWorkflowSuccess = useCallback(() => {
    setIsRunWorkflowOpen(false);
    targetFetch.reset();
    // Navigate to home to see the new GraphRun
    dispatch({ type: 'JOBS_LIST_READY' });
  }, [dispatch, targetFetch]);

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <Button
          variant="link"
          icon={<ArrowLeftIcon />}
          isInline
          onClick={handleBackToRuns}
          style={{ marginBottom: '0.5rem', paddingLeft: 0 }}
        >
          Back to Runs
        </Button>
        <Title headingLevel="h1" size="2xl">
          Chaos Studio
        </Title>
        <p style={{ marginTop: '0.5rem', color: 'var(--pf-v5-global--Color--200)' }}>
          Design complex chaos workflows with visual dependency graphs
        </p>
      </div>

      {/* Workflow load + details */}
      <Card style={{ marginBottom: '1rem' }}>
        <CardTitle>Workflow Templates</CardTitle>
        <CardBody>
          <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
            <FlexItem>
              <LoadWorkflowSelect />
            </FlexItem>
            {savedFile && !isEditingDetails && (
              <FlexItem>
                <Button
                  variant="plain"
                  icon={<PencilAltIcon />}
                  onClick={() => setIsEditingDetails(true)}
                  aria-label="Edit workflow details"
                  style={{ padding: '0.25rem' }}
                />
                <Button
                  variant="plain"
                  icon={<TrashIcon />}
                  onClick={() => setIsDeleteModalOpen(true)}
                  aria-label="Delete workflow"
                  style={{ color: 'var(--pf-v5-global--danger-color--100)', padding: '0.25rem' }}
                />
              </FlexItem>
            )}
          </Flex>
          <WorkflowDetailsPanel />
        </CardBody>
      </Card>

      {/* Delete Workflow Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Delete Workflow"
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        actions={[
          <Button
            key="delete"
            variant="danger"
            onClick={handleDeleteWorkflow}
            isDisabled={isDeleting}
            icon={isDeleting ? <Spinner size="sm" /> : undefined}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>,
          <Button key="cancel" variant="link" onClick={() => setIsDeleteModalOpen(false)} isDisabled={isDeleting}>
            Cancel
          </Button>,
        ]}
      >
        <p>
          Are you sure you want to delete the workflow <strong>&laquo;{savedFile?.fileName}&raquo;</strong> from the cluster?
          This will also clear the current canvas.
        </p>
      </Modal>

      {/* Leave Guard Modal */}
      <Modal
        variant={ModalVariant.small}
        title={leaveReason === 'editing' ? 'Editing in progress' : 'Unsaved changes'}
        titleIconVariant={ExclamationTriangleIcon}
        isOpen={isLeaveModalOpen}
        onClose={() => !isSavingBeforeLeave && handleCancelLeave()}
        actions={
          leaveReason === 'dirty'
            ? [
                <Button
                  key="save-leave"
                  variant="primary"
                  icon={isSavingBeforeLeave ? <Spinner size="sm" /> : <SaveIcon />}
                  onClick={handleSaveAndLeave}
                  isDisabled={isSavingBeforeLeave}
                >
                  {isSavingBeforeLeave ? 'Saving...' : 'Save & Leave'}
                </Button>,
                <Button key="leave" variant="secondary" onClick={handleLeaveWithoutSaving} isDisabled={isSavingBeforeLeave}>
                  Leave without saving
                </Button>,
                <Button key="cancel" variant="link" onClick={handleCancelLeave} isDisabled={isSavingBeforeLeave}>
                  Cancel
                </Button>,
              ]
            : [
                <Button key="leave" variant="primary" onClick={handleLeaveWithoutSaving}>
                  {leaveReason === 'editing' ? 'Discard & Leave' : 'Leave without saving'}
                </Button>,
                <Button key="cancel" variant="link" onClick={handleCancelLeave}>
                  Cancel
                </Button>,
              ]
        }
      >
        <p>
          {leaveReason === 'editing' && 'You are editing workflow details. Your changes will be lost.'}
          {leaveReason === 'dirty' && (
            <>The workflow <strong>&laquo;{savedFile?.fileName}&raquo;</strong> has unsaved changes.</>
          )}
          {leaveReason === 'unsaved' && 'You have an unsaved workflow on the canvas. It will be lost if you leave.'}
        </p>
      </Modal>

      {/* Content */}
      <Card>
        <CardBody>
          {/* Toolbar */}
          <StudioToolbar onRunWorkflow={handleRunWorkflow} />

          {/* Canvas */}
          <div style={{ marginTop: '1rem' }}>
            <StudioCanvas onNodeClick={handleNodeClick} />
          </div>
        </CardBody>
      </Card>

      {/* Node Editor Modal */}
      <StudioNodeEditorModal
        isOpen={isEditorOpen}
        node={selectedNode}
        onClose={handleEditorClose}
        onSave={handleEditorSave}
      />

      {/* Run Workflow Modal */}
      <RunWorkflowModal
        isOpen={isRunWorkflowOpen}
        onClose={handleRunWorkflowClose}
        onSuccess={handleRunWorkflowSuccess}
        targetFetchState={targetFetch.state}
      />
    </>
  );
}

export function Studio() {
  const [initialWorkflow, setInitialWorkflow] = useState<StudioWorkflow | undefined>(undefined);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [autosaveData, setAutosaveData] = useState<{ workflow: StudioWorkflow; timestamp: number } | null>(null);
  const [isReady, setIsReady] = useState(false); // Wait for user decision

  // Check for autosave on mount
  useEffect(() => {
    const autosave = loadAutosave();
    if (autosave) {
      setAutosaveData({
        workflow: autosave.workflow,
        timestamp: autosave.timestamp,
      });
      setShowRecoveryModal(true);
      // Don't set isReady yet - wait for user choice
    } else {
      // No autosave, ready to start fresh
      setIsReady(true);
    }
  }, []);

  // Handle recovery modal actions
  const handleResumeAutosave = () => {
    if (autosaveData) {
      setInitialWorkflow(autosaveData.workflow);
    }
    setShowRecoveryModal(false);
    setIsReady(true); // Now ready with autosave data
  };

  const handleDiscardAutosave = () => {
    clearAutosave();
    setShowRecoveryModal(false);
    setAutosaveData(null);
    setIsReady(true); // Now ready to start fresh
  };

  // Don't render StudioProvider until user has made autosave decision
  if (!isReady) {
    return (
      <>
        {/* Recovery Modal (shown while waiting for decision) */}
        <StudioRecoveryModal
          isOpen={showRecoveryModal}
          timestamp={autosaveData?.timestamp || 0}
          onResume={handleResumeAutosave}
          onDiscard={handleDiscardAutosave}
        />
      </>
    );
  }

  return (
    <StudioProvider initialWorkflow={initialWorkflow}>
      <StudioContent />
    </StudioProvider>
  );
}
