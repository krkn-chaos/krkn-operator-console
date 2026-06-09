/**
 * FileForm - Create/Edit file form
 *
 * Handles both creation and editing of files with validation.
 */

import { useState } from 'react';
import {
  Form,
  FormGroup,
  TextInput,
  TextArea,
  Radio,
  Button,
  ActionGroup,
  Alert,
  FormHelperText,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';
import { operatorApi } from '../../services/operatorApi';
import type { FileResponse, CreateFileRequest, UpdateFileRequest } from '../../types/api';

interface FileFormProps {
  mode: 'create' | 'edit';
  initialData?: FileResponse;
  onSuccess: () => void;
  onCancel: () => void;
}

export function FileForm({ mode, initialData, onSuccess, onCancel }: FileFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [fileName, setFileName] = useState(initialData?.fileName || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [mountPath, setMountPath] = useState(initialData?.mountPath || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [accessType, setAccessType] = useState<'public' | 'groups'>(
    initialData?.availableToAll ? 'public' : 'groups'
  );
  const [groups, setGroups] = useState(initialData?.groups?.join(', ') || '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Validate form
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Name is required';
    } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)) {
      errors.name = 'Name must be RFC 1123 compliant (lowercase, numbers, hyphens)';
    }

    if (!fileName.trim()) {
      errors.fileName = 'File name is required';
    }

    if (!content.trim()) {
      errors.content = 'Content is required';
    }

    if (!mountPath.trim()) {
      errors.mountPath = 'Mount path is required';
    } else if (!mountPath.startsWith('/')) {
      errors.mountPath = 'Mount path must start with /';
    }

    if (accessType === 'groups' && !groups.trim()) {
      errors.groups = 'At least one group is required for group-based access';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const groupsArray = accessType === 'groups'
        ? groups.split(',').map(g => g.trim()).filter(Boolean)
        : [];

      if (mode === 'create') {
        const request: CreateFileRequest = {
          name,
          fileName,
          content,
          mountPath,
          description: description.trim() || undefined,
          groups: groupsArray.length > 0 ? groupsArray : undefined,
          availableToAll: accessType === 'public',
        };

        await operatorApi.createFile(request);
      } else {
        const request: UpdateFileRequest = {
          fileName,
          content,
          mountPath,
          description: description.trim() || undefined,
          groups: groupsArray.length > 0 ? groupsArray : undefined,
          availableToAll: accessType === 'public',
        };

        await operatorApi.updateFile(name, request);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${mode} file`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      {error && (
        <Alert variant="danger" isInline title="Error" style={{ marginBottom: '1rem' }}>
          {error}
        </Alert>
      )}

      <FormGroup label="Name" isRequired fieldId="file-name-input">
        <TextInput
          id="file-name-input"
          value={name}
          onChange={(_event, value) => setName(value)}
          isDisabled={mode === 'edit'}
          validated={validationErrors.name ? 'error' : 'default'}
        />
        {validationErrors.name && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{validationErrors.name}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
        {mode === 'create' && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                ConfigMap name (RFC 1123: lowercase, numbers, hyphens)
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      <FormGroup label="File Name" isRequired fieldId="filename-input">
        <TextInput
          id="filename-input"
          value={fileName}
          onChange={(_event, value) => setFileName(value)}
          validated={validationErrors.fileName ? 'error' : 'default'}
        />
        {validationErrors.fileName && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{validationErrors.fileName}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
        <FormHelperText>
          <HelperText>
            <HelperTextItem>Key name in the ConfigMap (e.g., config.yaml)</HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>

      <FormGroup label="Mount Path" isRequired fieldId="mount-path-input">
        <TextInput
          id="mount-path-input"
          value={mountPath}
          onChange={(_event, value) => setMountPath(value)}
          validated={validationErrors.mountPath ? 'error' : 'default'}
          placeholder="/path/to/mount/config.yaml"
        />
        {validationErrors.mountPath && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{validationErrors.mountPath}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
        <FormHelperText>
          <HelperText>
            <HelperTextItem>Where to mount this file in pods</HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>

      <FormGroup label="Content" isRequired fieldId="content-input">
        <TextArea
          id="content-input"
          value={content}
          onChange={(_event, value) => setContent(value)}
          validated={validationErrors.content ? 'error' : 'default'}
          rows={10}
          resizeOrientation="vertical"
        />
        {validationErrors.content && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{validationErrors.content}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      <FormGroup label="Description" fieldId="description-input">
        <TextInput
          id="description-input"
          value={description}
          onChange={(_event, value) => setDescription(value)}
        />
      </FormGroup>

      <FormGroup label="Access Control" isRequired fieldId="access-control">
        <Radio
          id="access-public"
          name="access-type"
          label="Public (available to all users)"
          isChecked={accessType === 'public'}
          onChange={() => setAccessType('public')}
        />
        <Radio
          id="access-groups"
          name="access-type"
          label="Group-based (specific groups only)"
          isChecked={accessType === 'groups'}
          onChange={() => setAccessType('groups')}
        />
      </FormGroup>

      {accessType === 'groups' && (
        <FormGroup label="Groups" isRequired fieldId="groups-input">
          <TextInput
            id="groups-input"
            value={groups}
            onChange={(_event, value) => setGroups(value)}
            validated={validationErrors.groups ? 'error' : 'default'}
            placeholder="group1, group2, group3"
          />
          {validationErrors.groups && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error">{validationErrors.groups}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
          <FormHelperText>
            <HelperText>
              <HelperTextItem>Comma-separated list of group names</HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>
      )}

      <ActionGroup>
        <Button
          variant="primary"
          type="submit"
          isDisabled={submitting}
          isLoading={submitting}
        >
          {mode === 'create' ? 'Create File' : 'Save Changes'}
        </Button>
        <Button variant="link" onClick={onCancel} isDisabled={submitting}>
          Cancel
        </Button>
      </ActionGroup>
    </Form>
  );
}
