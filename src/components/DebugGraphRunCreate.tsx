/**
 * DebugGraphRunCreate - Debug component for testing GraphRun creation
 *
 * Multi-step wizard:
 * 1. Create target request
 * 2. Poll until ready
 * 3. Select clusters
 * 4. Input graph JSON
 * 5. Create GraphRun
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  ModalVariant,
  Button,
  Form,
  FormGroup,
  TextArea,
  Alert,
  Spinner,
  Card,
  CardBody,
  Checkbox,
  EmptyState,
  EmptyStateIcon,
  Title,
} from '@patternfly/react-core';
import { CubesIcon, CheckCircleIcon } from '@patternfly/react-icons';
import { graphRunsApi } from '../services';
import { operatorApi } from '../services/operatorApi';
import type { ClustersResponse, SelectedCluster } from '../types/api';

interface DebugGraphRunCreateProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'init' | 'polling' | 'select_clusters' | 'input_graph' | 'creating' | 'success' | 'error';

export function DebugGraphRunCreate({ isOpen, onClose, onSuccess }: DebugGraphRunCreateProps) {
  // State
  const [step, setStep] = useState<Step>('init');
  const [targetUuid, setTargetUuid] = useState<string | null>(null);
  const [pollAttempts, setPollAttempts] = useState(0);
  const [clusters, setClusters] = useState<ClustersResponse['targetData'] | null>(null);
  const [selectedClusters, setSelectedClusters] = useState<SelectedCluster[]>([]);
  const [graphJson, setGraphJson] = useState(`{
  "node1": {
    "name": "pod-scenarios",
    "image": "quay.io/krkn-chaos/krkn-hub:pod-scenarios",
    "env": {
      "SCENARIO_TYPE": "pod_delete",
      "NAMESPACE": "default"
    }
  },
  "node2": {
    "name": "network-chaos",
    "image": "quay.io/krkn-chaos/krkn-hub:network-chaos",
    "depends_on": "node1",
    "env": {
      "SCENARIO_TYPE": "network_chaos"
    }
  }
}`);
  const [error, setError] = useState<string | null>(null);
  const [createdGraphRunName, setCreatedGraphRunName] = useState<string | null>(null);

  // Step 1: Create target request
  const handleCreateTarget = async () => {
    setStep('init');
    setError(null);

    try {
      const response = await operatorApi.createTargetRequest();
      setTargetUuid(response.uuid);
      setStep('polling');
      setPollAttempts(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create target request');
      setStep('error');
    }
  };

  // Step 2: Poll until target ready
  useEffect(() => {
    if (step !== 'polling' || !targetUuid) return;

    let mounted = true;
    const pollInterval = setInterval(async () => {
      if (!mounted) return;

      setPollAttempts(prev => prev + 1);

      try {
        const status = await operatorApi.getTargetStatus(targetUuid);

        if (status === 200) {
          // Ready - fetch clusters
          if (!mounted) return;

          const clustersData = await operatorApi.getClusters(targetUuid);
          setClusters(clustersData.targetData);
          setStep('select_clusters');
          clearInterval(pollInterval);
        } else if (status === 202) {
          // Still pending - continue polling
        } else {
          throw new Error(`Unexpected status: ${status}`);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Polling failed');
        setStep('error');
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds

    // Timeout after 60 seconds
    const timeout = setTimeout(() => {
      if (mounted && step === 'polling') {
        setError('Polling timeout - target took too long to become ready');
        setStep('error');
        clearInterval(pollInterval);
      }
    }, 60000);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [step, targetUuid]);

  // Toggle cluster selection
  const handleToggleCluster = (operatorName: string, clusterName: string, clusterApiUrl: string) => {
    const isSelected = selectedClusters.some(
      c => c.operatorName === operatorName && c.clusterName === clusterName
    );

    if (isSelected) {
      setSelectedClusters(selectedClusters.filter(
        c => !(c.operatorName === operatorName && c.clusterName === clusterName)
      ));
    } else {
      setSelectedClusters([...selectedClusters, { operatorName, clusterName, clusterApiUrl }]);
    }
  };

  // Step 4: Create GraphRun
  const handleCreateGraphRun = async () => {
    if (!targetUuid) return;

    setStep('creating');
    setError(null);

    try {
      // Parse graph JSON
      const graph = JSON.parse(graphJson);

      // Build targetClusters map
      const targetClusters: { [providerName: string]: string[] } = {};
      selectedClusters.forEach(cluster => {
        if (!targetClusters[cluster.operatorName]) {
          targetClusters[cluster.operatorName] = [];
        }
        targetClusters[cluster.operatorName].push(cluster.clusterName);
      });

      // Create graph run
      const result = await graphRunsApi.createGraphRun({
        graph,
        targetRequestId: targetUuid,
        targetClusters,
      });

      setCreatedGraphRunName(result.name);
      setStep('success');
      onSuccess?.();

      // Auto-close after 3 seconds
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create graph run');
      setStep('error');
    }
  };

  const handleClose = () => {
    // Reset state
    setStep('init');
    setTargetUuid(null);
    setPollAttempts(0);
    setClusters(null);
    setSelectedClusters([]);
    setError(null);
    setCreatedGraphRunName(null);
    onClose();
  };

  // Render cluster list
  const renderClusterSelection = () => {
    if (!clusters) return null;

    const allClusters = Object.entries(clusters).flatMap(([operatorName, clusterList]) =>
      clusterList.map(cluster => ({
        operatorName,
        clusterName: cluster['cluster-name'],
        clusterApiUrl: cluster['cluster-api-url'],
      }))
    );

    if (allClusters.length === 0) {
      return (
        <EmptyState>
          <EmptyStateIcon icon={CubesIcon} />
          <Title headingLevel="h2" size="lg">
            No Clusters Available
          </Title>
        </EmptyState>
      );
    }

    return (
      <div>
        <div style={{ marginBottom: '1rem', fontWeight: 'bold' }}>
          Select target clusters ({selectedClusters.length} selected):
        </div>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {Object.entries(clusters).map(([operatorName, clusterList]) => (
            <Card key={operatorName} isCompact style={{ marginBottom: '1rem' }}>
              <CardBody>
                <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--pf-v5-global--primary-color--100)' }}>
                  Provider: {operatorName}
                </div>
                {clusterList.map(cluster => {
                  const isSelected = selectedClusters.some(
                    c => c.operatorName === operatorName && c.clusterName === cluster['cluster-name']
                  );
                  return (
                    <Checkbox
                      key={cluster['cluster-name']}
                      label={
                        <div>
                          <div style={{ fontWeight: 'bold' }}>{cluster['cluster-name']}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--pf-v5-global--Color--200)' }}>
                            {cluster['cluster-api-url']}
                          </div>
                        </div>
                      }
                      isChecked={isSelected}
                      onChange={() => handleToggleCluster(operatorName, cluster['cluster-name'], cluster['cluster-api-url'])}
                      id={`cluster-${operatorName}-${cluster['cluster-name']}`}
                      style={{ marginBottom: '0.5rem' }}
                    />
                  );
                })}
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  // Wizard steps content
  const getStepContent = () => {
    switch (step) {
      case 'init':
        return (
          <div>
            <Alert variant="info" isInline title="Step 1: Initialize Target Request" style={{ marginBottom: '1rem' }}>
              Create a target request to discover available clusters.
            </Alert>
            <Button variant="primary" onClick={handleCreateTarget} size="lg">
              Start Discovery
            </Button>
          </div>
        );

      case 'polling':
        return (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spinner size="xl" />
            <div style={{ marginTop: '1rem', fontSize: '1.1rem' }}>
              Discovering clusters... (attempt {pollAttempts})
            </div>
            <div style={{ marginTop: '0.5rem', color: 'var(--pf-v5-global--Color--200)' }}>
              Target UUID: {targetUuid}
            </div>
          </div>
        );

      case 'select_clusters':
        return (
          <div>
            <Alert variant="info" isInline title="Step 2: Select Target Clusters" style={{ marginBottom: '1rem' }}>
              Select one or more clusters where the graph scenarios will run.
            </Alert>
            {renderClusterSelection()}
            <div style={{ marginTop: '1rem' }}>
              <Button
                variant="primary"
                onClick={() => setStep('input_graph')}
                isDisabled={selectedClusters.length === 0}
              >
                Continue to Graph Definition ({selectedClusters.length} clusters selected)
              </Button>
              <Button variant="link" onClick={handleClose} style={{ marginLeft: '1rem' }}>
                Cancel
              </Button>
            </div>
          </div>
        );

      case 'input_graph':
        return (
          <div>
            <Alert variant="info" isInline title="Step 3: Define Graph Workflow" style={{ marginBottom: '1rem' }}>
              Paste JSON defining the scenario dependency graph. Use "depends_on" to create dependencies.
            </Alert>
            <Form>
              <FormGroup label="Graph JSON" isRequired>
                <TextArea
                  value={graphJson}
                  onChange={(_event, value) => setGraphJson(value)}
                  rows={16}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
                <div style={{ fontSize: '11px', color: 'var(--pf-v5-global--Color--200)', marginTop: '0.5rem' }}>
                  Map of nodeId → GraphScenarioNode. Example: {`{"node1": {"name": "...", "image": "...", "env": {...}}, "node2": {"depends_on": "node1", ...}}`}
                </div>
              </FormGroup>
            </Form>
            <div style={{ marginTop: '1rem' }}>
              <Button variant="primary" onClick={handleCreateGraphRun}>
                Create Graph Run
              </Button>
              <Button variant="link" onClick={() => setStep('select_clusters')} style={{ marginLeft: '1rem' }}>
                Back
              </Button>
            </div>
          </div>
        );

      case 'creating':
        return (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spinner size="xl" />
            <div style={{ marginTop: '1rem', fontSize: '1.1rem' }}>
              Creating graph run...
            </div>
          </div>
        );

      case 'success':
        return (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <CheckCircleIcon color="var(--pf-v5-global--success-color--100)" style={{ fontSize: '4rem' }} />
            <div style={{ marginTop: '1rem', fontSize: '1.2rem', fontWeight: 'bold' }}>
              Graph Run Created Successfully!
            </div>
            <div style={{ marginTop: '0.5rem', color: 'var(--pf-v5-global--Color--200)' }}>
              Name: <code>{createdGraphRunName}</code>
            </div>
            <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
              Closing in 3 seconds...
            </div>
          </div>
        );

      case 'error':
        return (
          <div>
            <Alert variant="danger" isInline title="Error" style={{ marginBottom: '1rem' }}>
              {error}
            </Alert>
            <Button variant="primary" onClick={handleCreateTarget}>
              Retry
            </Button>
            <Button variant="link" onClick={handleClose} style={{ marginLeft: '1rem' }}>
              Close
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      variant={ModalVariant.large}
      title="🚧 DEBUG: Create Graph Run"
      isOpen={isOpen}
      onClose={handleClose}
      showClose={step !== 'creating' && step !== 'success'}
    >
      <Alert
        variant="warning"
        isInline
        title="Debug Tool"
        style={{ marginBottom: '1rem' }}
      >
        Temporary testing tool with full cluster discovery workflow.
      </Alert>

      {getStepContent()}
    </Modal>
  );
}
