/**
 * FileForm - Create/Edit file form
 *
 * Handles both creation and editing of files with validation.
 * Backend handles group-based permissions.
 */

import { useState, useEffect } from 'react';
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
  Label,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import { operatorApi } from '../../services/operatorApi';
import { useRole } from '../../hooks/useRole';
import type { FileResponse, CreateFileRequest, UpdateFileRequest, FileTypeResponse, GroupResponse } from '../../types/api';

interface FileFormProps {
  mode: 'create' | 'edit';
  initialData?: FileResponse;
  availableFileTypes: FileTypeResponse[];
  onSuccess: () => void;
  onCancel: () => void;
  onRequestNewFileType: () => void;
}

// Generate consistent color from group name
function getGroupColor(groupName: string): string {
  const colors = [
    '#0066CC', // blue
    '#2ECC71', // green
    '#E74C3C', // red
    '#9B59B6', // purple
    '#F39C12', // orange
    '#1ABC9C', // teal
    '#E67E22', // dark orange
    '#3498DB', // light blue
    '#16A085', // dark teal
    '#C0392B', // dark red
  ];

  let hash = 0;
  for (let i = 0; i < groupName.length; i++) {
    hash = groupName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function FileForm({
  mode,
  initialData,
  availableFileTypes,
  onSuccess,
  onCancel,
  onRequestNewFileType,
}: FileFormProps) {
  const { isAdmin } = useRole();

  const [name, setName] = useState(initialData?.name || '');
  const [fileName, setFileName] = useState(initialData?.fileName || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [mountPath, setMountPath] = useState(initialData?.mountPath || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [fileType, setFileType] = useState(initialData?.fileType || '');
  const [accessType, setAccessType] = useState<'public' | 'groups'>(
    // Non-admin users can only create group-based files
    isAdmin && initialData?.availableToAll ? 'public' : 'groups'
  );
  const [selectedGroups, setSelectedGroups] = useState<string[]>(initialData?.groups || []);
  const [availableGroups, setAvailableGroups] = useState<GroupResponse[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Load available groups
  useEffect(() => {
    async function loadGroups() {
      try {
        const response = await operatorApi.getGroups();
        setAvailableGroups(response.groups || []);

        // For non-admin users, auto-select their groups (only on initial load)
        if (!isAdmin && response.groups.length > 0 && !initialData) {
          setSelectedGroups(response.groups.map(g => g.name));
        }
      } catch (err) {
        console.error('[FileForm] Error loading groups:', err);
      }
    }

    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

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

    if (accessType === 'groups' && selectedGroups.length === 0) {
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
      const groupsArray = accessType === 'groups' ? selectedGroups : [];

      if (mode === 'create') {
        const request: CreateFileRequest = {
          name,
          fileName,
          content,
          mountPath,
          description: description.trim() || undefined,
          groups: groupsArray.length > 0 ? groupsArray : undefined,
          availableToAll: accessType === 'public',
          fileType: fileType.trim() || undefined,
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
          fileType: fileType.trim() || undefined,
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

      <FormGroup label="File Type" fieldId="file-type-select">
        <Flex spaceItems={{ default: 'spaceItemsSm' }} flexWrap={{ default: 'wrap' }}>
          {/* No Type option */}
          <FlexItem>
            <Label
              color="grey"
              isCompact
              onClick={() => setFileType('')}
              style={{
                cursor: 'pointer',
                backgroundColor: fileType === '' ? '#6c757d' : '#f0f0f0',
                color: fileType === '' ? '#fff' : '#666',
                border: `2px solid ${fileType === '' ? '#6c757d' : '#ccc'}`,
                transition: 'all 0.2s',
              }}
            >
              (No type)
            </Label>
          </FlexItem>

          {/* Existing file types */}
          {availableFileTypes.map((type) => (
            <FlexItem key={type.name}>
              <Label
                color="grey"
                isCompact
                onClick={() => setFileType(type.name)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: fileType === type.name ? (type.color || '#6c757d') : '#f0f0f0',
                  color: fileType === type.name ? '#fff' : '#666',
                  border: `2px solid ${fileType === type.name ? (type.color || '#6c757d') : '#ccc'}`,
                  transition: 'all 0.2s',
                }}
              >
                {type.name}
              </Label>
            </FlexItem>
          ))}

          {/* Add New Type button */}
          <FlexItem>
            <Label
              color="blue"
              isCompact
              onClick={onRequestNewFileType}
              style={{
                cursor: 'pointer',
                backgroundColor: '#fff',
                color: '#0066CC',
                border: '2px dashed #0066CC',
                transition: 'all 0.2s',
              }}
            >
              + Add New Type
            </Label>
          </FlexItem>
        </Flex>
        <FormHelperText>
          <HelperText>
            <HelperTextItem>
              Click a type to select it, or create a new one with "+ Add New Type"
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>

      <FormGroup label="Access Control" isRequired fieldId="access-control">
        {isAdmin && (
          <Radio
            id="access-public"
            name="access-type"
            label="Public (available to all users)"
            isChecked={accessType === 'public'}
            onChange={() => setAccessType('public')}
          />
        )}
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
          {availableGroups.length === 0 ? (
            <Alert variant="info" isInline title="No groups available" />
          ) : (
            <Flex spaceItems={{ default: 'spaceItemsSm' }} flexWrap={{ default: 'wrap' }}>
              {availableGroups.map((group) => {
                const isSelected = selectedGroups.includes(group.name);
                const color = getGroupColor(group.name);

                return (
                  <FlexItem key={group.name}>
                    <Label
                      color="grey"
                      isCompact
                      onClick={() => {
                        if (!isAdmin) return; // Non-admin cannot change selection

                        if (isSelected) {
                          setSelectedGroups(selectedGroups.filter(g => g !== group.name));
                        } else {
                          setSelectedGroups([...selectedGroups, group.name]);
                        }
                      }}
                      style={{
                        cursor: isAdmin ? 'pointer' : 'default',
                        backgroundColor: isSelected ? color : '#f0f0f0',
                        color: isSelected ? '#fff' : '#666',
                        border: `2px solid ${isSelected ? color : '#ccc'}`,
                        opacity: isAdmin ? 1 : 0.7,
                        transition: 'all 0.2s',
                      }}
                      title={group.description || group.name}
                    >
                      {group.name}
                    </Label>
                  </FlexItem>
                );
              })}
            </Flex>
          )}
          {validationErrors.groups && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error">{validationErrors.groups}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                {isAdmin
                  ? 'Click tags to select/deselect groups'
                  : 'File will be created in your assigned groups'}
              </HelperTextItem>
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
