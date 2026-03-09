/**
 * ClusterConflictWarning Component
 *
 * Warning modal shown when user tries to launch a scenario against a cluster
 * that already has active scenario runs.
 * Displays list of existing runs and allows user to Cancel or Continue.
 */

import {
  Modal,
  ModalVariant,
  Button,
} from '@patternfly/react-core';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';

interface ClusterConflictWarningProps {
  isOpen: boolean;
  clusterName: string;
  existingRuns: string[];
  onCancel: () => void;
  onContinue: () => void;
}

export function ClusterConflictWarning({
  isOpen,
  clusterName,
  existingRuns,
  onCancel,
  onContinue,
}: ClusterConflictWarningProps) {
  const runCount = existingRuns.length;
  const scenarioText = runCount === 1 ? 'scenario' : 'scenarios';

  return (
    <Modal
      variant={ModalVariant.small}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ExclamationTriangleIcon style={{ color: 'var(--pf-v5-global--warning-color--100)' }} />
          <span>Cluster Already in Use</span>
        </div>
      }
      isOpen={isOpen}
      onClose={onCancel}
      actions={[
        <Button key="continue" variant="primary" onClick={onContinue}>
          Continue
        </Button>,
        <Button key="cancel" variant="link" onClick={onCancel}>
          Cancel
        </Button>,
      ]}
    >
      <div>
        <p>
          There {runCount === 1 ? 'is' : 'are'} already <strong>{runCount}</strong> {scenarioText} running against cluster{' '}
          <strong>{clusterName}</strong>:
        </p>
        <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem' }}>
          {existingRuns.map((runName) => (
            <li key={runName}>{runName}</li>
          ))}
        </ul>
        <p style={{ marginTop: '1rem', color: 'var(--pf-v5-global--Color--200)' }}>
          Running additional scenarios against this cluster may impact performance or test results.
        </p>
      </div>
    </Modal>
  );
}
