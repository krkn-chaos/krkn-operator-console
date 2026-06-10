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
  Select,
  SelectList,
  SelectOption,
  MenuToggle,
  MenuToggleElement,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import { FiPlus, FiX } from 'react-icons/fi';
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
  const [accessType, setAccessType] = useState<'public' | 'group'>(() => {
    // For edit mode: use existing value
    if (initialData) {
      return initialData.availableToAll ? 'public' : 'group';
    }
    // For create mode: default to public
    return 'public';
  });
  const [selectedGroup, setSelectedGroup] = useState<string>(
    initialData?.groups?.[0] || '' // Max 1 group
  );
  const [availableGroups, setAvailableGroups] = useState<GroupResponse[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // File type select state
  const [isFileTypeSelectOpen, setIsFileTypeSelectOpen] = useState(false);
  const [fileTypeSearchTerm, setFileTypeSearchTerm] = useState('');

  // Group select state (single selection)
  const [isGroupSelectOpen, setIsGroupSelectOpen] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');

  // Load available groups
  useEffect(() => {
    async function loadGroups() {
      try {
        const response = await operatorApi.getGroups();
        setAvailableGroups(response.groups || []);
        setGroupsLoaded(true);
      } catch (err) {
        console.error('[FileForm] Error loading groups:', err);
        // On error (e.g., 403 Forbidden), treat as no groups available
        setAvailableGroups([]);
        setGroupsLoaded(true);
      }
    }

    loadGroups();
  }, []);

  // Auto-populate group when user has exactly 1 group and switches to 'group' mode
  useEffect(() => {
    if (!isAdmin && availableGroups.length === 1 && accessType === 'group' && !selectedGroup) {
      setSelectedGroup(availableGroups[0].name);
    }
  }, [isAdmin, availableGroups, accessType, selectedGroup]);

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

    if (accessType === 'group' && !selectedGroup) {
      errors.group = 'Group selection is required for group-based access';
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
      // Max 1 group (or empty for public)
      const groupsArray = accessType === 'group' && selectedGroup ? [selectedGroup] : [];

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
        {/* Selected file type badge preview */}
        {fileType && (
          <div style={{ marginBottom: '0.5rem' }}>
            <Label
              color="grey"
              style={{
                backgroundColor: availableFileTypes.find(t => t.name === fileType)?.color || '#6c757d',
                color: '#fff',
              }}
              onClose={() => setFileType('')}
            >
              {fileType}
            </Label>
          </div>
        )}

        {/* Combobox: select existing OR type new (freeform input) */}
        <Select
          isOpen={isFileTypeSelectOpen}
          selected={fileType}
          onSelect={(_event, value) => {
            setFileType(value as string);
            setIsFileTypeSelectOpen(false);
            setFileTypeSearchTerm('');
          }}
          onOpenChange={(isOpen) => {
            setIsFileTypeSelectOpen(isOpen);
            if (!isOpen) {
              setFileTypeSearchTerm('');
            }
          }}
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              ref={toggleRef}
              onClick={() => setIsFileTypeSelectOpen(!isFileTypeSelectOpen)}
              isExpanded={isFileTypeSelectOpen}
              style={{ width: '100%' }}
            >
              <TextInputGroup>
                <TextInputGroupMain
                  value={fileTypeSearchTerm}
                  onClick={() => setIsFileTypeSelectOpen(true)}
                  onChange={(_event, value) => {
                    setFileTypeSearchTerm(value);
                    // Allow freeform input: update fileType as user types
                    setFileType(value);
                  }}
                  placeholder={fileType || 'Type to create new or select existing...'}
                />
                {fileTypeSearchTerm && (
                  <TextInputGroupUtilities>
                    <Button
                      variant="plain"
                      onClick={() => {
                        setFileTypeSearchTerm('');
                        setFileType('');
                      }}
                      icon={<FiX />}
                      aria-label="Clear"
                    />
                  </TextInputGroupUtilities>
                )}
              </TextInputGroup>
            </MenuToggle>
          )}
        >
          <SelectList>
            {/* No type option */}
            <SelectOption value="">
              <span style={{ color: '#666', fontStyle: 'italic' }}>(No type)</span>
            </SelectOption>

            {/* Filtered file types */}
            {availableFileTypes
              .filter((type) =>
                type.name.toLowerCase().includes(fileTypeSearchTerm.toLowerCase())
              )
              .map((type) => (
                <SelectOption key={type.name} value={type.name}>
                  <Label
                    color="grey"
                    isCompact
                    style={{
                      backgroundColor: type.color || '#6c757d',
                      color: '#fff',
                      marginRight: '0.5rem',
                    }}
                  >
                    {type.name}
                  </Label>
                </SelectOption>
              ))}

            {/* Show "Create new" option if search term doesn't match existing */}
            {fileTypeSearchTerm &&
              !availableFileTypes.some(
                (type) => type.name.toLowerCase() === fileTypeSearchTerm.toLowerCase()
              ) && (
                <SelectOption value={fileTypeSearchTerm}>
                  <span style={{ color: 'var(--pf-v5-global--link--Color)', fontWeight: 'bold' }}>
                    + Create "{fileTypeSearchTerm}"
                  </span>
                  <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.85em', marginLeft: '0.5rem' }}>
                    (will be auto-created)
                  </span>
                </SelectOption>
              )}
          </SelectList>
        </Select>

        {/* Manage Types link */}
        <div style={{ marginTop: '0.5rem' }}>
          <Button
            variant="link"
            isInline
            onClick={onRequestNewFileType}
            icon={<FiPlus />}
          >
            Manage Types
          </Button>
        </div>

        <FormHelperText>
          <HelperText>
            <HelperTextItem>
              Optional. Type to create a new type (auto-created on save), or select existing.
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>

      <FormGroup label="Access Control" isRequired fieldId="access-control">
        {/* Admin: can choose public or group */}
        {isAdmin && (
          <>
            <Radio
              id="access-public"
              name="access-type"
              label="Public (available to all users)"
              isChecked={accessType === 'public'}
              onChange={() => setAccessType('public')}
            />
            <Radio
              id="access-group"
              name="access-type"
              label="Assign to group"
              isChecked={accessType === 'group'}
              onChange={() => setAccessType('group')}
            />
          </>
        )}

        {/* User with 0 groups: forced public (only show after groups loaded) */}
        {!isAdmin && groupsLoaded && availableGroups.length === 0 && (
          <Radio
            id="access-public-forced"
            name="access-type"
            label="Public file (available to all)"
            isChecked={true}
            isDisabled={true}
          />
        )}

        {/* User with 1+ groups: can choose public or group (only show after groups loaded) */}
        {!isAdmin && groupsLoaded && availableGroups.length > 0 && (
          <>
            <Radio
              id="access-public"
              name="access-type"
              label="Public file"
              isChecked={accessType === 'public'}
              onChange={() => setAccessType('public')}
            />
            <Radio
              id="access-group"
              name="access-type"
              label="My group file"
              isChecked={accessType === 'group'}
              onChange={() => setAccessType('group')}
            />
          </>
        )}

        {/* Loading state for non-admin */}
        {!isAdmin && !groupsLoaded && (
          <div style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.9em' }}>
            Loading access options...
          </div>
        )}
      </FormGroup>

      {accessType === 'group' && (
        <FormGroup label="Group" isRequired fieldId="group-input">
          {/* User with 1 group: just show badge (no selection needed) */}
          {!isAdmin && availableGroups.length === 1 && (
            <>
              <Label color="blue">{availableGroups[0].name}</Label>
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    File will be assigned to your group.
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </>
          )}

          {/* User with multiple groups OR Admin: show select */}
          {(isAdmin || availableGroups.length > 1) && (
            <>
              {/* Selected group badge preview */}
              {selectedGroup && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <Label
                    color="blue"
                    onClose={() => setSelectedGroup('')}
                  >
                    {selectedGroup}
                  </Label>
                </div>
              )}

              {/* Select with search (single selection) */}
              <Select
                isOpen={isGroupSelectOpen}
                selected={selectedGroup}
                onSelect={(_event, value) => {
                  setSelectedGroup(value as string);
                  setIsGroupSelectOpen(false);
                  setGroupSearchTerm('');
                }}
                onOpenChange={(isOpen) => {
                  setIsGroupSelectOpen(isOpen);
                  if (!isOpen) {
                    setGroupSearchTerm('');
                  }
                }}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle
                    ref={toggleRef}
                    onClick={() => setIsGroupSelectOpen(!isGroupSelectOpen)}
                    isExpanded={isGroupSelectOpen}
                    style={{ width: '100%' }}
                  >
                    <TextInputGroup>
                      <TextInputGroupMain
                        value={groupSearchTerm}
                        onClick={() => setIsGroupSelectOpen(true)}
                        onChange={(_event, value) => setGroupSearchTerm(value)}
                        placeholder={selectedGroup || 'Search or select a group...'}
                      />
                      {groupSearchTerm && (
                        <TextInputGroupUtilities>
                          <Button
                            variant="plain"
                            onClick={() => setGroupSearchTerm('')}
                            icon={<FiX />}
                            aria-label="Clear search"
                          />
                        </TextInputGroupUtilities>
                      )}
                    </TextInputGroup>
                  </MenuToggle>
                )}
              >
                <SelectList>
                  {(isAdmin ? availableGroups : availableGroups)
                    .filter((group) =>
                      group.name.toLowerCase().includes(groupSearchTerm.toLowerCase())
                    )
                    .map((group) => (
                      <SelectOption key={group.name} value={group.name}>
                        <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
                          <FlexItem>
                            <strong>{group.name}</strong>
                          </FlexItem>
                          {group.description && (
                            <FlexItem>
                              <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.9em' }}>
                                — {group.description}
                              </span>
                            </FlexItem>
                          )}
                        </Flex>
                      </SelectOption>
                    ))}
                </SelectList>
              </Select>

              {validationErrors.group && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem variant="error">{validationErrors.group}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    {isAdmin
                      ? 'Select one group. File can be assigned to at most 1 group.'
                      : 'Select one of your groups.'}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </>
          )}
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
