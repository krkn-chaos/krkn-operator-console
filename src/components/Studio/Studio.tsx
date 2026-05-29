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
  PageSection,
  Title,
  Card,
  CardBody,
} from '@patternfly/react-core';
import { StudioProvider, loadAutosave, clearAutosave, useStudioContext } from './StudioContext';
import { StudioToolbar } from './StudioToolbar';
import { StudioCanvas } from './StudioCanvas';
import { StudioRecoveryModal } from './StudioRecoveryModal';
import { StudioNodeEditorModal } from './StudioNodeEditorModal';
import type { StudioWorkflow, StudioNode } from '../../types/api';

function StudioContent() {
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

  return (
    <>
      <PageSection variant="light">
        <Title headingLevel="h1" size="2xl">
          Chaos Scenario Studio
        </Title>
        <p style={{ marginTop: '0.5rem', color: 'var(--pf-v5-global--Color--200)' }}>
          Design complex chaos workflows with visual dependency graphs
        </p>
      </PageSection>

      <PageSection isFilled>
        <Card isFlat>
          <CardBody>
            {/* Toolbar */}
            <StudioToolbar />

            {/* Canvas */}
            <div style={{ marginTop: '1rem' }}>
              <StudioCanvas onNodeClick={handleNodeClick} />
            </div>
          </CardBody>
        </Card>
      </PageSection>

      {/* Node Editor Modal */}
      <StudioNodeEditorModal
        isOpen={isEditorOpen}
        node={selectedNode}
        onClose={handleEditorClose}
        onSave={handleEditorSave}
      />
    </>
  );
}

export function Studio() {
  const [initialWorkflow, setInitialWorkflow] = useState<StudioWorkflow | undefined>(undefined);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [autosaveData, setAutosaveData] = useState<{ workflow: StudioWorkflow; timestamp: number } | null>(null);

  // Check for autosave on mount
  useEffect(() => {
    const autosave = loadAutosave();
    if (autosave) {
      setAutosaveData({
        workflow: autosave.workflow,
        timestamp: autosave.timestamp,
      });
      setShowRecoveryModal(true);
    }
  }, []);

  // Handle recovery modal actions
  const handleResumeAutosave = () => {
    if (autosaveData) {
      setInitialWorkflow(autosaveData.workflow);
    }
    setShowRecoveryModal(false);
  };

  const handleDiscardAutosave = () => {
    clearAutosave();
    setShowRecoveryModal(false);
    setAutosaveData(null);
  };

  return (
    <StudioProvider initialWorkflow={initialWorkflow}>
      <StudioContent />

      {/* Recovery Modal */}
      <StudioRecoveryModal
        isOpen={showRecoveryModal}
        timestamp={autosaveData?.timestamp || 0}
        onResume={handleResumeAutosave}
        onDiscard={handleDiscardAutosave}
      />
    </StudioProvider>
  );
}
