/**
 * NodeMetadataStep - Node metadata configuration for wizard
 *
 * Allows configuration of:
 * - Node ID (required, validated)
 * - Volumes (optional, mock dropdown for now)
 * - Files (optional, mock dropdown for now)
 */

import { useMemo, useState } from 'react';
import {
  Form,
  FormGroup,
  TextInput,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Alert,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { FileSelector } from '../FileSelector';
import type { FileReference } from '../../types/api';

interface NodeMetadataStepProps {
  nodeId: string;
  onNodeIdChange: (nodeId: string) => void;
  nodeIdError?: string;
  currentNodeId?: string; // Current node ID (for validation exclusion)
  volumes?: { [fileId: string]: string }; // fileId -> mountPath mapping
  onVolumesChange?: (volumes: { [fileId: string]: string }) => void;
}

export function NodeMetadataStep({
  nodeId,
  onNodeIdChange,
  nodeIdError,
  volumes = {},
  onVolumesChange,
}: NodeMetadataStepProps) {
  const validated = nodeIdError ? 'error' : nodeId ? 'success' : 'default';
  const [, setHasPendingFileInput] = useState(false);

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
          onPendingChange={setHasPendingFileInput}
          label=""
        />
      </div>
    </Form>
  );
}
