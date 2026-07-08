/**
 * RunWorkflowModal - Modal for selecting clusters and running the workflow
 *
 * Uses ClusterMultiSelector to let users choose target clusters,
 * then submits the workflow as a GraphRun.
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  ModalVariant,
  Button,
  Alert,
  Spinner,
  Checkbox,
} from '@patternfly/react-core';
import { ClusterMultiSelector } from '../ClusterMultiSelector';
import { ResiliencyScoreModal } from '../ResiliencyScoreModal';
import { graphRunsApi, operatorApi } from '../../services';
import { useNotifications } from '../../hooks';
import type { SelectedCluster, CreateGraphRunRequest, Cluster, ResiliencyScoreConfig } from '../../types/api';
import { useStudioContext } from './StudioContext';
import { clearAutosave } from './studioAutosave';

interface RunWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetFetchState: {
    status: 'idle' | 'creating_target' | 'polling' | 'fetching_clusters' | 'ready' | 'error';
    uuid?: string;
    clusters?: { [operatorName: string]: Cluster[] };
    error?: string;
    attempts?: number;
  };
}

export function RunWorkflowModal({
  isOpen,
  onClose,
  onSuccess,
  targetFetchState,
}: RunWorkflowModalProps) {
  const { exportWorkflow, workflow } = useStudioContext();
  const { showSuccess, showError } = useNotifications();
  const [selectedClusters, setSelectedClusters] = useState<SelectedCluster[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enableResiliencyScore, setEnableResiliencyScore] = useState(false);
  const [showResiliencyModal, setShowResiliencyModal] = useState(false);
  const [resiliencyConfig, setResiliencyConfig] = useState<ResiliencyScoreConfig | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedClusters([]);
      setEnableResiliencyScore(false);
      setShowResiliencyModal(false);
      setResiliencyConfig(null);
    }
  }, [isOpen]);

  const handleCancel = () => {
    // Delete target request if exists
    if (targetFetchState.uuid) {
      operatorApi.deleteTargetRequest(targetFetchState.uuid).catch(() => {
        // Silently handle cleanup failures
      });
    }
    onClose();
  };

  const handleToggleCluster = (cluster: SelectedCluster) => {
    setSelectedClusters((prev) => {
      const exists = prev.some(
        (c) => c.operatorName === cluster.operatorName && c.clusterName === cluster.clusterName
      );

      if (exists) {
        return prev.filter(
          (c) => !(c.operatorName === cluster.operatorName && c.clusterName === cluster.clusterName)
        );
      } else {
        return [...prev, cluster];
      }
    });
  };

  const handleSubmit = async (providedConfig?: ResiliencyScoreConfig) => {
    if (targetFetchState.status !== 'ready' || !targetFetchState.uuid) {
      showError('Missing target request', 'Target request ID is not available');
      return;
    }

    if (selectedClusters.length === 0) {
      showError('No clusters selected', 'Please select at least one cluster');
      return;
    }

    // Use provided config or state config
    const configToUse = providedConfig || resiliencyConfig;

    // If resiliency score enabled but not configured, open modal
    if (enableResiliencyScore && !configToUse) {
      setShowResiliencyModal(true);
      return;
    }

    // Export workflow
    const exportResult = exportWorkflow();
    if ('error' in exportResult) {
      showError('Cannot run workflow', exportResult.error);
      return;
    }

    // Build targetClusters map: { operatorName: [clusterName1, clusterName2] }
    const targetClusters: { [operatorName: string]: string[] } = {};
    selectedClusters.forEach((cluster) => {
      if (!targetClusters[cluster.operatorName]) {
        targetClusters[cluster.operatorName] = [];
      }
      targetClusters[cluster.operatorName].push(cluster.clusterName);
    });

    // Apply resiliency score file mappings to graph nodes
    const graph = { ...exportResult.graph };
    if (configToUse) {
      Object.keys(graph).forEach((nodeId) => {
        const node = graph[nodeId];

        // Determine fileId for this node
        let fileId: string | undefined;
        if (configToUse.fileId) {
          // Same file for all nodes
          fileId = configToUse.fileId;
        } else if (configToUse.perNodeFiles && configToUse.perNodeFiles[nodeId]) {
          // Per-node file selection
          fileId = configToUse.perNodeFiles[nodeId];
        }

        // Add to volumes if fileId exists
        if (fileId) {
          graph[nodeId] = {
            ...node,
            volumes: {
              ...(node.volumes || {}),
              [fileId]: configToUse.mountPath,
            },
          };
        }
      });
    }

    const request: CreateGraphRunRequest = {
      graph,
      targetRequestId: targetFetchState.uuid,
      targetClusters,
    };

    setIsSubmitting(true);

    try {
      // Build headers for resiliency score
      const headers: Record<string, string> = {};
      if (configToUse) {
        headers['X-Resiliency-Score'] = 'true';
        headers['X-Resiliency-Baseline'] = configToUse.baseline.toString();
        headers['X-Resiliency-Mount-Path'] = configToUse.mountPath;
      }

      const graphRun = await graphRunsApi.createGraphRun(request, headers);
      showSuccess('Workflow started', `GraphRun ${graphRun.name} created successfully`);
      // Clear autosave since workflow was successfully submitted
      clearAutosave();
      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create GraphRun';
      showError('Failed to run workflow', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResiliencyConfigConfirm = (config: ResiliencyScoreConfig) => {
    setResiliencyConfig(config);
    setShowResiliencyModal(false);
    // Automatically proceed with submission, passing config directly to avoid race condition
    handleSubmit(config);
  };

  // Render loading state
  if (targetFetchState.status === 'creating_target') {
    return (
      <Modal
        variant={ModalVariant.medium}
        isOpen={isOpen}
        onClose={handleCancel}
        showClose={false}
        aria-label="Creating target request"
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spinner size="lg" />
          <p style={{ marginTop: '1rem' }}>Creating target request...</p>
        </div>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
          <Button variant="secondary" onClick={handleCancel} size="lg">
            Cancel
          </Button>
        </div>
      </Modal>
    );
  }

  if (targetFetchState.status === 'polling') {
    return (
      <Modal
        variant={ModalVariant.medium}
        isOpen={isOpen}
        onClose={handleCancel}
        showClose={false}
        aria-label="Polling target status"
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spinner size="lg" />
          <p style={{ marginTop: '1rem' }}>
            Polling target status... (attempt {targetFetchState.attempts || 0})
          </p>
        </div>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
          <Button variant="secondary" onClick={handleCancel} size="lg">
            Cancel
          </Button>
        </div>
      </Modal>
    );
  }

  if (targetFetchState.status === 'fetching_clusters') {
    return (
      <Modal
        variant={ModalVariant.medium}
        isOpen={isOpen}
        onClose={handleCancel}
        showClose={false}
        aria-label="Loading clusters"
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spinner size="lg" />
          <p style={{ marginTop: '1rem' }}>Loading clusters...</p>
        </div>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
          <Button variant="secondary" onClick={handleCancel} size="lg">
            Cancel
          </Button>
        </div>
      </Modal>
    );
  }

  if (targetFetchState.status === 'error') {
    return (
      <Modal
        variant={ModalVariant.medium}
        isOpen={isOpen}
        onClose={handleCancel}
        showClose={false}
        aria-label="Error loading clusters"
      >
        <Alert variant="danger" isInline title="Error">
          {targetFetchState.error}
        </Alert>
        <div style={{ marginTop: '1.5rem' }}>
          <Button variant="primary" onClick={handleCancel}>
            Close
          </Button>
        </div>
      </Modal>
    );
  }

  // Render cluster selector when ready
  return (
    <Modal
      variant={ModalVariant.medium}
      isOpen={isOpen}
      onClose={onClose}
      showClose={false}
      aria-label="Select clusters to run workflow"
    >
      {targetFetchState.status === 'ready' && targetFetchState.clusters && (
        <>
          <ClusterMultiSelector
            clusters={targetFetchState.clusters}
            selectedClusters={selectedClusters}
            onToggle={handleToggleCluster}
            onProceed={handleSubmit}
            onCancel={onClose}
            showActions={false}
          />

          {/* Resiliency Score option */}
          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)', borderRadius: '4px' }}>
            <Checkbox
              id="enable-resiliency-score"
              label="Calculate Resiliency Score"
              description="Enable resiliency score calculation for this workflow execution"
              isChecked={enableResiliencyScore}
              onChange={(_event, checked) => {
                setEnableResiliencyScore(checked);
                if (!checked) {
                  // Clear config when disabled
                  setResiliencyConfig(null);
                }
              }}
            />
            {enableResiliencyScore && resiliencyConfig && (
              <Alert
                variant="info"
                isInline
                isPlain
                title={`Baseline: ${resiliencyConfig.baseline}, Mount: ${resiliencyConfig.mountPath}`}
                style={{ marginTop: '0.5rem' }}
              />
            )}
          </div>

          {/* Custom actions aligned left */}
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
            <Button
              variant="primary"
              onClick={() => handleSubmit()}
              isDisabled={selectedClusters.length === 0 || isSubmitting}
              isLoading={isSubmitting}
              size="lg"
            >
              {isSubmitting ? 'Running...' : `Run Workflow${selectedClusters.length > 0 ? ` on ${selectedClusters.length} cluster${selectedClusters.length === 1 ? '' : 's'}` : ''}`}
            </Button>
            <Button variant="secondary" onClick={handleCancel} isDisabled={isSubmitting} size="lg">
              Cancel
            </Button>
          </div>
        </>
      )}

      {/* Resiliency Score Configuration Modal */}
      <ResiliencyScoreModal
        isOpen={showResiliencyModal}
        nodeIds={workflow.nodes.map(n => n.nodeId)}
        onClose={() => setShowResiliencyModal(false)}
        onConfirm={handleResiliencyConfigConfirm}
      />
    </Modal>
  );
}
