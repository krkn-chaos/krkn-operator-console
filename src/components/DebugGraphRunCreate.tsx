/**
 * DebugGraphRunCreate - Temporary component for testing GraphRun creation
 *
 * Simple text box to paste JSON and create GraphRuns without validation.
 * REMOVE THIS BEFORE PRODUCTION.
 */

import { useState } from 'react';
import {
  Modal,
  ModalVariant,
  Button,
  Form,
  FormGroup,
  TextInput,
  TextArea,
  Alert,
  Spinner,
} from '@patternfly/react-core';
import { graphRunsApi } from '../services';

interface DebugGraphRunCreateProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DebugGraphRunCreate({ isOpen, onClose, onSuccess }: DebugGraphRunCreateProps) {
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
  const [targetRequestId, setTargetRequestId] = useState('');
  const [targetClustersJson, setTargetClustersJson] = useState(`{
  "krkn-operator": ["cluster1"]
}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Parse JSON (no validation, just parse)
      const graph = JSON.parse(graphJson);
      const targetClusters = JSON.parse(targetClustersJson);

      // Create graph run
      const result = await graphRunsApi.createGraphRun({
        graph,
        targetRequestId,
        targetClusters,
      });

      setSuccess(`GraphRun created: ${result.name}`);
      onSuccess?.();

      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
        // Reset form
        setGraphJson('');
        setTargetRequestId('');
        setTargetClustersJson('');
        setSuccess(null);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create graph run');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(null);
    onClose();
  };

  return (
    <Modal
      variant={ModalVariant.large}
      title="🚧 DEBUG: Create Graph Run (Raw JSON)"
      isOpen={isOpen}
      onClose={handleClose}
      actions={[
        <Button
          key="create"
          variant="primary"
          onClick={handleSubmit}
          isDisabled={loading || !graphJson || !targetRequestId || !targetClustersJson}
        >
          {loading ? <Spinner size="sm" /> : 'Create Graph Run'}
        </Button>,
        <Button key="cancel" variant="link" onClick={handleClose}>
          Cancel
        </Button>,
      ]}
    >
      <Alert
        variant="warning"
        isInline
        title="Debug Tool - No Validation"
        style={{ marginBottom: '1rem' }}
      >
        This is a temporary testing tool. Paste raw JSON - no validation will be performed.
      </Alert>

      {error && (
        <Alert variant="danger" isInline title="Error" style={{ marginBottom: '1rem' }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" isInline title="Success" style={{ marginBottom: '1rem' }}>
          {success}
        </Alert>
      )}

      <Form>
        <FormGroup label="Graph (JSON)" isRequired>
          <TextArea
            value={graphJson}
            onChange={(_event, value) => setGraphJson(value)}
            rows={12}
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
            placeholder='{"node1": {"name": "scenario", "image": "...", "env": {...}}}'
          />
          <div style={{ fontSize: '11px', color: 'var(--pf-v5-global--Color--200)', marginTop: '0.25rem' }}>
            Map of nodeId → GraphScenarioNode. Use "depends_on" for dependencies.
          </div>
        </FormGroup>

        <FormGroup label="Target Request ID (UUID)" isRequired>
          <TextInput
            value={targetRequestId}
            onChange={(_event, value) => setTargetRequestId(value)}
            placeholder="e.g., target-abc123"
          />
          <div style={{ fontSize: '11px', color: 'var(--pf-v5-global--Color--200)', marginTop: '0.25rem' }}>
            UUID from KrknTargetRequest (use existing one or create via /targets endpoint)
          </div>
        </FormGroup>

        <FormGroup label="Target Clusters (JSON)" isRequired>
          <TextArea
            value={targetClustersJson}
            onChange={(_event, value) => setTargetClustersJson(value)}
            rows={4}
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
            placeholder='{"krkn-operator": ["cluster1", "cluster2"]}'
          />
          <div style={{ fontSize: '11px', color: 'var(--pf-v5-global--Color--200)', marginTop: '0.25rem' }}>
            Map of provider name → array of cluster names
          </div>
        </FormGroup>
      </Form>
    </Modal>
  );
}
