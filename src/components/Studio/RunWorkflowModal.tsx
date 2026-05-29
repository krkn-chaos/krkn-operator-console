/**
 * RunWorkflowModal - Modal for selecting clusters and running the workflow
 *
 * Uses ClusterMultiSelector to let users choose target clusters,
 * then submits the workflow as a GraphRun.
 */

import { useState } from 'react';
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
import type { Cluster, SelectedCluster, CreateGraphRunRequest } from '../../types/api';
import { useStudioContext } from './StudioContext';

interface RunWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusters: { [operatorName: string]: Cluster[] } | null;
  targetRequestId: string | null;
}

export function RunWorkflowModal({
  isOpen,
  onClose,
  clusters,
  targetRequestId,
}: RunWorkflowModalProps) {
  const { exportWorkflow } = useStudioContext();
  const { showSuccess, showError } = useNotifications();
  const [selectedClusters, setSelectedClusters] = useState<SelectedCluster[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!targetRequestId) {
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
      targetRequestId,
      targetClusters,
    };

    setIsSubmitting(true);

    try {
      const graphRun = await graphRunsApi.createGraphRun(request);
      showSuccess('Workflow started', `GraphRun ${graphRun.metadata.name} created successfully`);
      setSelectedClusters([]);
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create GraphRun';
      showError('Failed to run workflow', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setSelectedClusters([]);
    onClose();
  };

  return (
    <Modal
      variant={ModalVariant.large}
      title="Run Workflow"
      isOpen={isOpen}
      onClose={handleCancel}
      actions={[
        <Button
          key="run"
          variant="primary"
          onClick={handleSubmit}
          isDisabled={selectedClusters.length === 0 || isSubmitting}
          isLoading={isSubmitting}
        >
          {isSubmitting ? 'Running...' : 'Run Workflow'}
        </Button>,
        <Button key="cancel" variant="link" onClick={handleCancel} isDisabled={isSubmitting}>
          Cancel
        </Button>,
      ]}
    >
      {!targetRequestId && (
        <Alert variant="warning" isInline title="Target request not available" style={{ marginBottom: '1rem' }}>
          Cannot run workflow without a valid target request. Please navigate to the home page to initialize a target request.
        </Alert>
      )}

      {!clusters && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spinner size="lg" />
          <p style={{ marginTop: '1rem' }}>Loading clusters...</p>
        </div>
      )}

      {clusters && targetRequestId && (
        <ClusterMultiSelector
          clusters={clusters}
          selectedClusters={selectedClusters}
          onToggle={handleToggleCluster}
          onProceed={handleSubmit}
          onCancel={handleCancel}
        />
      )}
    </Modal>
  );
}
