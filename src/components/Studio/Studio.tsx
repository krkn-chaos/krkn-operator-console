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

import { useState, useEffect, useCallback } from 'react';
import {
  Title,
  Card,
  CardBody,
} from '@patternfly/react-core';
import { useAppContext } from '../../context/AppContext';
import { operatorApi } from '../../services/operatorApi';
import { StudioProvider, loadAutosave, clearAutosave, useStudioContext } from './StudioContext';
import { StudioToolbar } from './StudioToolbar';
import { StudioCanvas } from './StudioCanvas';
import { StudioRecoveryModal } from './StudioRecoveryModal';
import { StudioNodeEditorModal } from './StudioNodeEditorModal';
import { RunWorkflowModal } from './RunWorkflowModal';
import type { StudioWorkflow, StudioNode } from '../../types/api';

function StudioContent() {
  const { state, dispatch } = useAppContext();
  const { updateNode } = useStudioContext();
  const [selectedNode, setSelectedNode] = useState<StudioNode | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

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

  const handleRunWorkflow = useCallback(async () => {
    // Start studio run workflow - creates target and polls
    dispatch({ type: 'INIT_STUDIO_RUN_START' });

    try {
      const response = await operatorApi.createTargetRequest();
      dispatch({
        type: 'INIT_SUCCESS',
        payload: { uuid: response.uuid },
      });
    } catch (error) {
      dispatch({
        type: 'INIT_ERROR',
        payload: {
          type: 'network',
          message: error instanceof Error ? error.message : 'Failed to create target',
        },
      });
    }
  }, [dispatch]);

  const handleRunWorkflowClose = useCallback(() => {
    dispatch({ type: 'CANCEL_STUDIO_RUN' });
  }, [dispatch]);

  // Auto-open run workflow modal when in selecting_clusters phase during studio run
  const isRunWorkflowOpen = state.phase === 'selecting_clusters' && state.studioRunMode;

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Title headingLevel="h1" size="2xl">
          Chaos Scenario Studio
        </Title>
        <p style={{ marginTop: '0.5rem', color: 'var(--pf-v5-global--Color--200)' }}>
          Design complex chaos workflows with visual dependency graphs
        </p>
      </div>

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
