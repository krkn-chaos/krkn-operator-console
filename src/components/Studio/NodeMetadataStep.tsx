/**
 * NodeMetadataStep - Node metadata configuration for wizard
 *
 * Allows configuration of:
 * - Node ID (required, validated)
 * - Volumes (optional, mock dropdown for now)
 * - Files (optional, mock dropdown for now)
 */

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

interface NodeMetadataStepProps {
  nodeId: string;
  onNodeIdChange: (nodeId: string) => void;
  nodeIdError?: string;
  currentNodeId?: string; // Current node ID (for validation exclusion)
}

export function NodeMetadataStep({
  nodeId,
  onNodeIdChange,
  nodeIdError,
}: NodeMetadataStepProps) {
  const validated = nodeIdError ? 'error' : nodeId ? 'success' : 'default';

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

      <FormGroup label="Volumes (Optional)">
        <Alert variant="info" isInline title="Coming soon">
          Volume configuration will be available in a future update.
        </Alert>
      </FormGroup>

      <FormGroup label="Files (Optional)">
        <Alert variant="info" isInline title="Coming soon">
          File mounting configuration will be available in a future update.
        </Alert>
      </FormGroup>
    </Form>
  );
}
