import { useState, useEffect } from 'react';
import {
  ExpandableSection,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Label,
  Button,
  TextInput,
  TextArea,
  Radio,
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
  Spinner,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalVariant,
} from '@patternfly/react-core';
import { PencilAltIcon, CheckIcon, TimesIcon, TrashIcon } from '@patternfly/react-icons';
import { FiX } from 'react-icons/fi';
import { operatorApi } from '../../services/operatorApi';
import { useStudioContext } from './StudioContext';
import { useNotifications } from '../../hooks';
import { useRole } from '../../hooks/useRole';
import type { GroupResponse } from '../../types/api';

const FILENAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export function WorkflowDetailsPanel() {
  const { savedFile, setSavedFile, clearSavedFile, clearWorkflow, workflow, isEditingDetails, setIsEditingDetails } = useStudioContext();
  const { showSuccess, showError } = useNotifications();
  const { isAdmin } = useRole();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAccessType, setEditAccessType] = useState<'public' | 'group'>('public');
  const [editSelectedGroup, setEditSelectedGroup] = useState('');
  const [availableGroups, setAvailableGroups] = useState<GroupResponse[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [isGroupSelectOpen, setIsGroupSelectOpen] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isEditingDetails) return;
    operatorApi.getGroups()
      .then(response => setAvailableGroups(response.groups || []))
      .catch(() => setAvailableGroups([]))
      .finally(() => setGroupsLoaded(true));
  }, [isEditingDetails]);

  useEffect(() => {
    if (!isAdmin && availableGroups.length === 1 && editAccessType === 'group' && !editSelectedGroup) {
      setEditSelectedGroup(availableGroups[0].name);
    }
  }, [isAdmin, availableGroups, editAccessType, editSelectedGroup]);

  if (!savedFile) return null;

  const formatTimestamp = (iso: string): string => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const startEditing = () => {
    setEditName(savedFile.fileName);
    setEditDescription(savedFile.description || '');
    setEditAccessType(savedFile.availableToAll ? 'public' : 'group');
    setEditSelectedGroup(savedFile.groups?.[0] || '');
    setValidationErrors({});
    setGroupsLoaded(false);
    setIsEditingDetails(true);
  };

  const cancelEditing = () => {
    setIsEditingDetails(false);
    setValidationErrors({});
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!editName.trim()) {
      errors.name = 'Name is required';
    } else if (!FILENAME_PATTERN.test(editName.trim())) {
      errors.name = 'Only alphanumeric characters, hyphens, underscores, and dots are allowed';
    }
    if (editAccessType === 'group' && !editSelectedGroup) {
      errors.group = 'Group selection is required';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const trimmedName = editName.trim();
    const groupsArray = editAccessType === 'group' && editSelectedGroup ? [editSelectedGroup] : [];

    setIsSaving(true);
    try {
      await operatorApi.updateFile(savedFile.fileId, {
        fileName: trimmedName,
        content: JSON.stringify(workflow),
        description: editDescription.trim() || undefined,
        availableToAll: editAccessType === 'public',
        groups: groupsArray.length > 0 ? groupsArray : undefined,
        filePurpose: 'workflow-template',
      });
      setSavedFile({
        ...savedFile,
        fileName: trimmedName,
        description: editDescription.trim() || undefined,
        availableToAll: editAccessType === 'public',
        groups: groupsArray.length > 0 ? groupsArray : undefined,
        savedAt: new Date().toISOString(),
      });
      showSuccess('Workflow updated', `"${trimmedName}" updated successfully`);
      setIsEditingDetails(false);
    } catch (err) {
      showError('Update failed', err instanceof Error ? err.message : 'Failed to update workflow');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await operatorApi.deleteFile(savedFile.fileId);
      showSuccess('Workflow deleted', `"${savedFile.fileName}" deleted from cluster`);
      setIsDeleteModalOpen(false);
      clearSavedFile();
      clearWorkflow();
    } catch (err) {
      showError('Delete failed', err instanceof Error ? err.message : 'Failed to delete workflow');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderReadOnly = () => (
    <DescriptionList isHorizontal isCompact>
      <DescriptionListGroup>
        <DescriptionListTerm>Name</DescriptionListTerm>
        <DescriptionListDescription>{savedFile.fileName}</DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup>
        <DescriptionListTerm>Description</DescriptionListTerm>
        <DescriptionListDescription>
          {savedFile.description || <span style={{ color: 'var(--pf-v5-global--Color--200)', fontStyle: 'italic' }}>No description</span>}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup>
        <DescriptionListTerm>Visibility</DescriptionListTerm>
        <DescriptionListDescription>
          {savedFile.availableToAll ? (
            <Label color="green" isCompact>Public</Label>
          ) : (
            <Label color="blue" isCompact>{savedFile.groups?.[0] || 'Group'}</Label>
          )}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup>
        <DescriptionListTerm>Last saved</DescriptionListTerm>
        <DescriptionListDescription>{formatTimestamp(savedFile.savedAt)}</DescriptionListDescription>
      </DescriptionListGroup>
    </DescriptionList>
  );

  const renderEditable = () => (
    <div>
      <DescriptionList isHorizontal isCompact>
        <DescriptionListGroup>
          <DescriptionListTerm>Name</DescriptionListTerm>
          <DescriptionListDescription>
            <TextInput
              value={editName}
              onChange={(_e, val) => setEditName(val)}
              validated={validationErrors.name ? 'error' : 'default'}
              isDisabled={isSaving}
              style={{ maxWidth: '300px' }}
            />
            {validationErrors.name && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{validationErrors.name}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Description</DescriptionListTerm>
          <DescriptionListDescription>
            <TextArea
              value={editDescription}
              onChange={(_e, val) => setEditDescription(val)}
              rows={2}
              isDisabled={isSaving}
              style={{ maxWidth: '400px' }}
            />
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Visibility</DescriptionListTerm>
          <DescriptionListDescription>
            {isAdmin && (
              <Flex spaceItems={{ default: 'spaceItemsMd' }}>
                <FlexItem>
                  <Radio
                    id="detail-access-public"
                    name="detail-access-type"
                    label="Public"
                    isChecked={editAccessType === 'public'}
                    onChange={() => setEditAccessType('public')}
                    isDisabled={isSaving}
                  />
                </FlexItem>
                <FlexItem>
                  <Radio
                    id="detail-access-group"
                    name="detail-access-type"
                    label="Group"
                    isChecked={editAccessType === 'group'}
                    onChange={() => setEditAccessType('group')}
                    isDisabled={isSaving}
                  />
                </FlexItem>
              </Flex>
            )}

            {!isAdmin && groupsLoaded && availableGroups.length === 0 && (
              <Label color="green" isCompact>Public</Label>
            )}

            {!isAdmin && groupsLoaded && availableGroups.length > 0 && (
              <Flex spaceItems={{ default: 'spaceItemsMd' }}>
                <FlexItem>
                  <Radio
                    id="detail-access-public"
                    name="detail-access-type"
                    label="Public"
                    isChecked={editAccessType === 'public'}
                    onChange={() => setEditAccessType('public')}
                    isDisabled={isSaving}
                  />
                </FlexItem>
                <FlexItem>
                  <Radio
                    id="detail-access-group"
                    name="detail-access-type"
                    label="My group"
                    isChecked={editAccessType === 'group'}
                    onChange={() => setEditAccessType('group')}
                    isDisabled={isSaving}
                  />
                </FlexItem>
              </Flex>
            )}

            {!isAdmin && !groupsLoaded && (
              <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.9em' }}>Loading...</span>
            )}

            {editAccessType === 'group' && (
              <div style={{ marginTop: '0.5rem' }}>
                {!isAdmin && availableGroups.length === 1 ? (
                  <Label color="blue" isCompact>{availableGroups[0].name}</Label>
                ) : (
                  <>
                    {editSelectedGroup && (
                      <div style={{ marginBottom: '0.25rem' }}>
                        <Label color="blue" isCompact onClose={() => setEditSelectedGroup('')}>
                          {editSelectedGroup}
                        </Label>
                      </div>
                    )}
                    <Select
                      isOpen={isGroupSelectOpen}
                      selected={editSelectedGroup}
                      onSelect={(_event, value) => {
                        setEditSelectedGroup(value as string);
                        setIsGroupSelectOpen(false);
                        setGroupSearchTerm('');
                      }}
                      onOpenChange={(open) => {
                        setIsGroupSelectOpen(open);
                        if (!open) setGroupSearchTerm('');
                      }}
                      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                        <MenuToggle
                          ref={toggleRef}
                          onClick={() => setIsGroupSelectOpen(!isGroupSelectOpen)}
                          isExpanded={isGroupSelectOpen}
                          style={{ width: '250px' }}
                        >
                          <TextInputGroup>
                            <TextInputGroupMain
                              value={groupSearchTerm}
                              onClick={() => setIsGroupSelectOpen(true)}
                              onChange={(_e, value) => setGroupSearchTerm(value)}
                              placeholder={editSelectedGroup || 'Select group...'}
                            />
                            {groupSearchTerm && (
                              <TextInputGroupUtilities>
                                <Button
                                  variant="plain"
                                  onClick={() => setGroupSearchTerm('')}
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
                        {availableGroups
                          .filter(g => g.name.toLowerCase().includes(groupSearchTerm.toLowerCase()))
                          .map(g => (
                            <SelectOption key={g.name} value={g.name}>
                              <strong>{g.name}</strong>
                              {g.description && (
                                <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.9em', marginLeft: '0.5rem' }}>
                                  — {g.description}
                                </span>
                              )}
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
                  </>
                )}
              </div>
            )}
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Last saved</DescriptionListTerm>
          <DescriptionListDescription>{formatTimestamp(savedFile.savedAt)}</DescriptionListDescription>
        </DescriptionListGroup>
      </DescriptionList>

      <Flex spaceItems={{ default: 'spaceItemsSm' }} style={{ marginTop: '0.75rem' }}>
        <FlexItem>
          <Button
            variant="primary"
            size="sm"
            icon={isSaving ? <Spinner size="sm" /> : <CheckIcon />}
            onClick={handleSave}
            isDisabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </FlexItem>
        <FlexItem>
          <Button
            variant="plain"
            size="sm"
            icon={<TimesIcon />}
            onClick={cancelEditing}
            isDisabled={isSaving}
          >
            Cancel
          </Button>
        </FlexItem>
      </Flex>
    </div>
  );

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <ExpandableSection
          toggleContent={isExpanded ? 'Workflow details' : `Workflow details — ${savedFile.fileName}`}
          isExpanded={isExpanded}
          onToggle={(_e, expanded) => {
            if (isEditingDetails) return;
            setIsExpanded(expanded);
          }}
        >
          {!isEditingDetails && (
            <Flex justifyContent={{ default: 'justifyContentFlexEnd' }} spaceItems={{ default: 'spaceItemsSm' }} style={{ marginBottom: '0.5rem' }}>
              <FlexItem>
                <Button
                  variant="plain"
                  size="sm"
                  icon={<PencilAltIcon />}
                  onClick={startEditing}
                  aria-label="Edit workflow details"
                  style={{ padding: '0 0.25rem' }}
                />
              </FlexItem>
              <FlexItem>
                <Button
                  variant="plain"
                  size="sm"
                  icon={<TrashIcon />}
                  onClick={() => setIsDeleteModalOpen(true)}
                  aria-label="Delete workflow"
                  style={{ padding: '0 0.25rem', color: 'var(--pf-v5-global--danger-color--100)' }}
                />
              </FlexItem>
            </Flex>
          )}
          {isEditingDetails ? renderEditable() : renderReadOnly()}
        </ExpandableSection>
      </div>

      <Modal
        variant={ModalVariant.small}
        title="Delete Workflow"
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        actions={[
          <Button
            key="delete"
            variant="danger"
            onClick={handleDelete}
            isDisabled={isDeleting}
            icon={isDeleting ? <Spinner size="sm" /> : undefined}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>,
          <Button key="cancel" variant="link" onClick={() => setIsDeleteModalOpen(false)} isDisabled={isDeleting}>
            Cancel
          </Button>,
        ]}
      >
        <p>
          Are you sure you want to delete the workflow <strong>&laquo;{savedFile.fileName}&raquo;</strong> from the cluster?
          This will also clear the current canvas.
        </p>
      </Modal>
    </>
  );
}
