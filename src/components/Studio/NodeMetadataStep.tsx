/**
 * NodeMetadataStep - Node metadata configuration for wizard
 *
 * Allows configuration of:
 * - Node ID (required, validated)
 * - Volumes (optional, mock dropdown for now)
 * - Files (optional, mock dropdown for now)
 */

import { useMemo } from 'react';
import {
  Form,
  FormGroup,
  TextInput,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Alert,
  Switch,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { FileSelector } from '../FileSelector';
import { WorkspaceSelector } from '../WorkspaceSelector';
import type { FileReference, WorkspaceReference } from '../../types/api';

interface NodeMetadataStepProps {
  nodeId: string;
  onNodeIdChange: (nodeId: string) => void;
  nodeIdError?: string;
  currentNodeId?: string; // Current node ID (for validation exclusion)
  workspace?: WorkspaceReference;
  rollbackEnabled?: boolean;
  onRollbackEnabledChange?: (enabled: boolean) => void;
  onWorkspaceChange?: (workspace?: WorkspaceReference) => void;
  volumes?: { [fileId: string]: string }; // fileId -> mountPath mapping
  onVolumesChange?: (volumes: { [fileId: string]: string }) => void;
  onPendingChange?: (hasPending: boolean) => void;
  resiliencyWeight: number;
  onResiliencyWeightChange: (weight: number) => void;
}

export function NodeMetadataStep({
  nodeId,
  onNodeIdChange,
  nodeIdError,
  workspace,
  onWorkspaceChange,
  rollbackEnabled = false,
  onRollbackEnabledChange,
  volumes = {},
  onVolumesChange,
  onPendingChange,
  resiliencyWeight,
  onResiliencyWeightChange,
}: NodeMetadataStepProps) {
  const validated = nodeIdError ? 'error' : nodeId ? 'success' : 'default';

  // Convert volumes object to FileReference array for FileSelector
  const fileReferences = useMemo((): FileReference[] => {
    return Object.entries(volumes).map(([fileId, mountPath]) => ({ fileId, mountPath }));
  }, [volumes]);

  // Handle FileSelector change - convert FileReference[] back to volumes object
  const handleFileReferencesChange = (refs: FileReference[]) => {
    const newVolumes: { [fileId: string]: string } = {};
    refs.forEach(ref => {
      newVolumes[ref.fileId] = ref.mountPath;
    });
    onVolumesChange?.(newVolumes);
  };

  return (
    <Form>
      <Alert
        variant="info"
        isInline
        title="Node Identifier"
        style={{ marginBottom: '1rem' }}
      >
        The node ID is used as the key in the graph JSON export and must be unique across the workflow.
      </Alert>

      <FormGroup label="Node ID" isRequired>
        <TextInput
          value={nodeId}
          onChange={(_event, value) => onNodeIdChange(value)}
          validated={validated}
          aria-label="Node ID"
          placeholder="e.g., pod-delete-1"
        />
        {nodeIdError ? (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error" icon={<ExclamationCircleIcon />}>
                {nodeIdError}
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        ) : (
          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                Must be 5-25 characters: lowercase letters, numbers, and hyphens only (e.g., "pod-delete-1")
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      <FormGroup label="Resiliency Weight" isRequired>
        <TextInput
          type="number"
          min={0.000001}
          step={0.1}
          value={Number.isNaN(resiliencyWeight) ? '' : resiliencyWeight}
          onChange={(_event, value) => onResiliencyWeightChange(Number(value))}
          validated={Number.isFinite(resiliencyWeight) && resiliencyWeight > 0 ? 'success' : 'error'}
          aria-label="Resiliency weight"
        />
        <FormHelperText>
          <HelperText>
            <HelperTextItem>Positive multiplier used when calculating the graph resiliency score.</HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>

      <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
        <Switch id="node-rollback-enabled" label="Enable rollback" isChecked={rollbackEnabled} onChange={(_event, checked) => onRollbackEnabledChange?.(checked)} />
        <WorkspaceSelector id="node-workspace" value={workspace} onChange={(selected) => onWorkspaceChange?.(selected)} />
        {rollbackEnabled && !workspace && <Alert variant="warning" title="Select a workspace to enable rollback" isInline />}
        {rollbackEnabled && (
          <Alert variant="info" title="Why retries are disabled" isInline>
            A retry can change the cluster again and leave another set of rollback files. With rollback enabled, each target runs once so rollback uses the files from a single attempt.
          </Alert>
        )}
      </div>

      <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Managed Files
        </div>
        <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--pf-v5-global--Color--200)' }}>
          Select centrally-managed files to mount in the scenario container.
          The mount path must include the full file path (folder + filename), e.g., <code>/etc/config/file.yaml</code>.
        </div>
        <FileSelector
          value={fileReferences}
          onChange={handleFileReferencesChange}
          onPendingChange={onPendingChange}
          label=""
        />
      </div>
    </Form>
  );
}
