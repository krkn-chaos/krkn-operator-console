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
} from '@patternfly/react-core';
import { ClusterMultiSelector } from '../ClusterMultiSelector';
import { graphRunsApi } from '../../services';
import { useNotifications } from '../../hooks';
import type { SelectedCluster, CreateGraphRunRequest } from '../../types/api';
import { useStudioContext } from './StudioContext';

interface RunWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetFetchState: {
    status: 'idle' | 'creating_target' | 'polling' | 'fetching_clusters' | 'ready' | 'error';
    uuid?: string;
    clusters?: { [operatorName: string]: any[] };
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
  const { exportWorkflow } = useStudioContext();
  const { showSuccess, showError } = useNotifications();
  const [selectedClusters, setSelectedClusters] = useState<SelectedCluster[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset selected clusters when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedClusters([]);
    }
  }, [isOpen]);

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

  const handleSubmit = async () => {
    if (targetFetchState.status !== 'ready' || !targetFetchState.uuid) {
      showError('Missing target request', 'Target request ID is not available');
      return;
    }

    if (selectedClusters.length === 0) {
      showError('No clusters selected', 'Please select at least one cluster');
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

    const request: CreateGraphRunRequest = {
      graph: exportResult.graph,
      targetRequestId: targetFetchState.uuid,
      targetClusters,
    };

    setIsSubmitting(true);

    try {
      const graphRun = await graphRunsApi.createGraphRun(request);
      showSuccess('Workflow started', `GraphRun ${graphRun.name} created successfully`);
      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create GraphRun';
      showError('Failed to run workflow', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render loading state
  if (targetFetchState.status === 'creating_target') {
    return (
      <Modal
        variant={ModalVariant.medium}
        title="Run Workflow"
        isOpen={isOpen}
        onClose={onClose}
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spinner size="lg" />
          <p style={{ marginTop: '1rem' }}>Creating target request...</p>
        </div>
      </Modal>
    );
  }

  if (targetFetchState.status === 'polling') {
    return (
      <Modal
        variant={ModalVariant.medium}
        title="Run Workflow"
        isOpen={isOpen}
        onClose={onClose}
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spinner size="lg" />
          <p style={{ marginTop: '1rem' }}>
            Polling target status... (attempt {targetFetchState.attempts || 0})
          </p>
        </div>
      </Modal>
    );
  }

  if (targetFetchState.status === 'fetching_clusters') {
    return (
      <Modal
        variant={ModalVariant.medium}
        title="Run Workflow"
        isOpen={isOpen}
        onClose={onClose}
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spinner size="lg" />
          <p style={{ marginTop: '1rem' }}>Loading clusters...</p>
        </div>
      </Modal>
    );
  }

  if (targetFetchState.status === 'error') {
    return (
      <Modal
        variant={ModalVariant.medium}
        title="Run Workflow"
        isOpen={isOpen}
        onClose={onClose}
        actions={[
          <Button key="close" variant="primary" onClick={onClose}>
            Close
          </Button>,
        ]}
      >
        <Alert variant="danger" isInline title="Error">
          {targetFetchState.error}
        </Alert>
      </Modal>
    );
  }

  // Render cluster selector when ready
  return (
    <Modal
      variant={ModalVariant.large}
      title="Run Workflow"
      isOpen={isOpen}
      onClose={onClose}
      actions={[
        <Button
          key="run"
          variant="primary"
          onClick={handleSubmit}
          isDisabled={selectedClusters.length === 0 || isSubmitting}
          isLoading={isSubmitting}
        >
          {isSubmitting ? 'Running...' : `Run Workflow${selectedClusters.length > 0 ? ` on ${selectedClusters.length} cluster${selectedClusters.length === 1 ? '' : 's'}` : ''}`}
        </Button>,
        <Button key="cancel" variant="link" onClick={onClose} isDisabled={isSubmitting}>
          Cancel
        </Button>,
      ]}
    >
      {targetFetchState.status === 'ready' && targetFetchState.clusters && (
        <ClusterMultiSelector
          clusters={targetFetchState.clusters}
          selectedClusters={selectedClusters}
          onToggle={handleToggleCluster}
          onProceed={handleSubmit}
          onCancel={onClose}
          showActions={false}
        />
      )}
    </Modal>
  );
}
