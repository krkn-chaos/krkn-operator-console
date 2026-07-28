import { useState, useEffect } from 'react';
import {
  Modal,
  ModalVariant,
  Button,
  Form,
  FormGroup,
  TextInput,
  TextArea,
  ActionGroup,
  Spinner,
  Radio,
  Select,
  SelectList,
  SelectOption,
  MenuToggle,
  MenuToggleElement,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Label,
  Flex,
  FlexItem,
  FormHelperText,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';
import { FiX } from 'react-icons/fi';
import { operatorApi } from '../../services/operatorApi';
import { useStudioContext } from './StudioContext';
import { useNotifications } from '../../hooks';
import { useRole } from '../../hooks/useRole';
import type { GroupResponse } from '../../types/api';

const FILENAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

interface SaveWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SaveWorkflowModal({ isOpen, onClose, onSuccess }: SaveWorkflowModalProps) {
  const { workflow, setSavedFile } = useStudioContext();
  const { showSuccess, showError } = useNotifications();
  const { isAdmin } = useRole();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [accessType, setAccessType] = useState<'public' | 'group'>('public');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [availableGroups, setAvailableGroups] = useState<GroupResponse[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [isGroupSelectOpen, setIsGroupSelectOpen] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    operatorApi.getGroups()
      .then(response => setAvailableGroups(response.groups || []))
      .catch(() => setAvailableGroups([]))
      .finally(() => setGroupsLoaded(true));
  }, [isOpen]);

  useEffect(() => {
    if (!isAdmin && availableGroups.length === 1 && accessType === 'group' && !selectedGroup) {
      setSelectedGroup(availableGroups[0].name);
    }
  }, [isAdmin, availableGroups, accessType, selectedGroup]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = 'Name is required';
    } else if (!FILENAME_PATTERN.test(name.trim())) {
      errors.name = 'Only alphanumeric characters, hyphens, underscores, and dots are allowed';
    }
    if (accessType === 'group' && !selectedGroup) {
      errors.group = 'Group selection is required';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const trimmedName = name.trim();
    const groupsArray = accessType === 'group' && selectedGroup ? [selectedGroup] : [];

    setIsSaving(true);
    try {
      const response = await operatorApi.createFile({
        fileName: trimmedName,
        content: JSON.stringify(workflow),
        description: description.trim() || undefined,
        availableToAll: accessType === 'public',
        groups: groupsArray.length > 0 ? groupsArray : undefined,
        filePurpose: 'workflow-template',
      });
      setSavedFile({
        fileId: response.fileId,
        fileName: trimmedName,
        description: description.trim() || undefined,
        availableToAll: accessType === 'public',
        groups: groupsArray.length > 0 ? groupsArray : undefined,
        savedAt: new Date().toISOString(),
      });
      showSuccess('Workflow saved', `"${trimmedName}" saved successfully`);
      handleClose();
      onSuccess();
    } catch (err) {
      showError('Save failed', err instanceof Error ? err.message : 'Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setAccessType('public');
    setSelectedGroup('');
    setValidationErrors({});
    setGroupsLoaded(false);
    onClose();
  };

  return (
    <Modal
      variant={ModalVariant.medium}
      title="Save Workflow"
      isOpen={isOpen}
      onClose={handleClose}
    >
      <Form>
        <FormGroup label="Name" isRequired fieldId="workflow-name">
          <TextInput
            id="workflow-name"
            value={name}
            onChange={(_e, val) => setName(val)}
            placeholder="e.g., network-chaos-suite"
            isDisabled={isSaving}
            validated={validationErrors.name ? 'error' : 'default'}
          />
          {validationErrors.name && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error">{validationErrors.name}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>

        <FormGroup label="Description" fieldId="workflow-description">
          <TextArea
            id="workflow-description"
            value={description}
            onChange={(_e, val) => setDescription(val)}
            placeholder="Describe this workflow..."
            rows={3}
            isDisabled={isSaving}
          />
        </FormGroup>

        <FormGroup label="Access Control" isRequired fieldId="access-control">
          {isAdmin && (
            <>
              <Radio
                id="wf-access-public"
                name="wf-access-type"
                label="Public (available to all users)"
                isChecked={accessType === 'public'}
                onChange={() => setAccessType('public')}
                isDisabled={isSaving}
              />
              <Radio
                id="wf-access-group"
                name="wf-access-type"
                label="Assign to group"
                isChecked={accessType === 'group'}
                onChange={() => setAccessType('group')}
                isDisabled={isSaving}
              />
            </>
          )}

          {!isAdmin && groupsLoaded && availableGroups.length === 0 && (
            <Radio
              id="wf-access-public-forced"
              name="wf-access-type"
              label="Public file (available to all)"
              isChecked={true}
              isDisabled={true}
            />
          )}

          {!isAdmin && groupsLoaded && availableGroups.length > 0 && (
            <>
              <Radio
                id="wf-access-public"
                name="wf-access-type"
                label="Public file"
                isChecked={accessType === 'public'}
                onChange={() => setAccessType('public')}
                isDisabled={isSaving}
              />
              <Radio
                id="wf-access-group"
                name="wf-access-type"
                label="My group file"
                isChecked={accessType === 'group'}
                onChange={() => setAccessType('group')}
                isDisabled={isSaving}
              />
            </>
          )}

          {!isAdmin && !groupsLoaded && (
            <div style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.9em' }}>
              Loading access options...
            </div>
          )}
        </FormGroup>

        {accessType === 'group' && (
          <FormGroup label="Group" isRequired fieldId="wf-group-input">
            {!isAdmin && availableGroups.length === 1 && (
              <>
                <Label color="blue">{availableGroups[0].name}</Label>
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>Workflow will be assigned to your group.</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </>
            )}

            {(isAdmin || availableGroups.length > 1) && (
              <>
                {selectedGroup && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <Label color="blue" onClose={() => setSelectedGroup('')}>
                      {selectedGroup}
                    </Label>
                  </div>
                )}

                <Select
                  isOpen={isGroupSelectOpen}
                  selected={selectedGroup}
                  onSelect={(_event, value) => {
                    setSelectedGroup(value as string);
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
                      style={{ width: '100%' }}
                    >
                      <TextInputGroup>
                        <TextInputGroupMain
                          value={groupSearchTerm}
                          onClick={() => setIsGroupSelectOpen(true)}
                          onChange={(_e, value) => setGroupSearchTerm(value)}
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
                    {availableGroups
                      .filter(g => g.name.toLowerCase().includes(groupSearchTerm.toLowerCase()))
                      .map(g => (
                        <SelectOption key={g.name} value={g.name}>
                          <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
                            <FlexItem><strong>{g.name}</strong></FlexItem>
                            {g.description && (
                              <FlexItem>
                                <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: '0.9em' }}>
                                  — {g.description}
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
              </>
            )}
          </FormGroup>
        )}

        <ActionGroup>
          <Button
            variant="primary"
            onClick={handleSave}
            isDisabled={!name.trim() || isSaving}
            icon={isSaving ? <Spinner size="sm" /> : undefined}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="link" onClick={handleClose} isDisabled={isSaving}>
            Cancel
          </Button>
        </ActionGroup>
      </Form>
    </Modal>
  );
}
