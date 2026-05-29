/**
 * RunWorkflowModal - Modal for selecting clusters and running the workflow
 *
 * Uses ClusterMultiSelector to let users choose target clusters,
 * then submits the workflow as a GraphRun.
 */

import { useState, useEffect, useRef } from 'react';
import {
  Modal,
  ModalVariant,
  Button,
  Alert,
  Spinner,
} from '@patternfly/react-core';
import { ClusterMultiSelector } from '../ClusterMultiSelector';
import { graphRunsApi, operatorApi } from '../../services';
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
  const wasOpenRef = useRef(false);
  const currentUuidRef = useRef<string | undefined>(undefined);

  // Track current UUID
  useEffect(() => {
    currentUuidRef.current = targetFetchState.uuid;
  }, [targetFetchState.uuid]);

  // Reset selected clusters when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedClusters([]);
    }
  }, [isOpen]);

  // Cleanup target request when modal closes
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;

    // Detect close event
    if (wasOpen && !isOpen) {
      // Delete the target request if exists
      const uuid = currentUuidRef.current;
      if (uuid) {
        operatorApi.deleteTargetRequest(uuid).catch(() => {
          // Silently handle cleanup failures
        });
      }
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
        isOpen={isOpen}
        onClose={onClose}
        showClose={false}
        aria-label="Creating target request"
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spinner size="lg" />
          <p style={{ marginTop: '1rem' }}>Creating target request...</p>
        </div>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
          <Button variant="secondary" onClick={onClose} size="lg">
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
        onClose={onClose}
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
          <Button variant="secondary" onClick={onClose} size="lg">
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
        onClose={onClose}
        showClose={false}
        aria-label="Loading clusters"
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spinner size="lg" />
          <p style={{ marginTop: '1rem' }}>Loading clusters...</p>
        </div>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
          <Button variant="secondary" onClick={onClose} size="lg">
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
        onClose={onClose}
        showClose={false}
        aria-label="Error loading clusters"
      >
        <Alert variant="danger" isInline title="Error">
          {targetFetchState.error}
        </Alert>
        <div style={{ marginTop: '1.5rem' }}>
          <Button variant="primary" onClick={onClose}>
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

          {/* Custom actions aligned left */}
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
            <Button
              variant="primary"
              onClick={handleSubmit}
              isDisabled={selectedClusters.length === 0 || isSubmitting}
              isLoading={isSubmitting}
              size="lg"
            >
              {isSubmitting ? 'Running...' : `Run Workflow${selectedClusters.length > 0 ? ` on ${selectedClusters.length} cluster${selectedClusters.length === 1 ? '' : 's'}` : ''}`}
            </Button>
            <Button variant="secondary" onClick={onClose} isDisabled={isSubmitting} size="lg">
              Cancel
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
