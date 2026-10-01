import { useEffect, useState } from 'react';
import {
  ActionGroup,
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Radio,
  Spinner,
  TextInput,
} from '@patternfly/react-core';
import { operatorApi } from '../../services/operatorApi';
import { isApiError } from '../../utils/apiClient';
import type {
  CategoryResponse,
  CreateCategoryRequest,
  GroupResponse,
  UpdateCategoryRequest,
} from '../../types/api';

interface CategoryFormProps {
  mode: 'create' | 'edit';
  initialData?: CategoryResponse;
  onSuccess: () => void;
  onCancel: () => void;
}

const CATEGORY_NAME_PATTERN = /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/;
const CATEGORY_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_CATEGORY_COLOR = '#6c757d';

/**
 * Form for creating a category or changing its color and visibility.
 *
 * @example
 * <CategoryForm mode="create" onSuccess={reloadCategories} onCancel={closeModal} />
 */
export function CategoryForm({ mode, initialData, onSuccess, onCancel }: CategoryFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [color, setColor] = useState(initialData?.color || '');
  const [accessType, setAccessType] = useState<'public' | 'group'>(
    initialData?.availableToAll === false ? 'group' : 'public',
  );
  const [selectedGroup, setSelectedGroup] = useState(initialData?.groups?.[0] || '');
  const [availableGroups, setAvailableGroups] = useState<GroupResponse[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const colorPickerValue = CATEGORY_COLOR_PATTERN.test(color) ? color : DEFAULT_CATEGORY_COLOR;

  useEffect(() => {
    let isCurrent = true;
    operatorApi.getGroups()
      .then((response) => {
        if (isCurrent) {
          const groups = response.groups || [];
          setAvailableGroups(groups);
          setSelectedGroup((current) => groups.find((group) => group.id === current || group.name === current)?.id || current);
        }
      })
      .catch((err: unknown) => {
        if (isCurrent) {
          setGroupsError(err instanceof Error ? err.message : 'Could not load groups');
        }
      })
      .finally(() => {
        if (isCurrent) setGroupsLoaded(true);
      });
    return () => { isCurrent = false; };
  }, []);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    const trimmedName = name.trim();
    const trimmedColor = color.trim();

    if (mode === 'create') {
      if (!trimmedName) errors.name = 'Category name is required';
      else if (trimmedName.length > 63) errors.name = 'Category name must be at most 63 characters';
      else if (!CATEGORY_NAME_PATTERN.test(trimmedName)) {
        errors.name = 'Use lowercase letters, numbers, and hyphens; start and end with a letter or number';
      }
    }

    if (trimmedColor && !CATEGORY_COLOR_PATTERN.test(trimmedColor)) {
      errors.color = 'Color must use #RRGGBB format';
    }

    if (accessType === 'group' && !selectedGroup) {
      errors.group = 'Select a group for group visibility';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setError(null);
    try {
      const groups = accessType === 'group' ? [selectedGroup] : [];

      if (mode === 'create') {
        const request: CreateCategoryRequest = {
          name: name.trim(),
          color: color.trim() || undefined,
          groups: groups.length > 0 ? groups : undefined,
          availableToAll: accessType === 'public',
        };
        await operatorApi.createCategory(request);
      } else if (initialData) {
        const request: UpdateCategoryRequest = { color: color.trim() };
        const originalAccessType = initialData.availableToAll ? 'public' : 'group';
        const originalGroup = initialData.groups?.[0] || '';
        const visibilityChanged = accessType !== originalAccessType
          || (accessType === 'group' && selectedGroup !== originalGroup);
        if (visibilityChanged) {
          request.groups = groups;
          request.availableToAll = accessType === 'public';
        }
        await operatorApi.updateCategory(initialData.name, request);
      }

      onSuccess();
    } catch (err) {
      if (isApiError(err) && err.status === 403) {
        setError('You do not have permission to manage this category or group');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save category');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const categoryGroups = initialData?.groups || [];
  const missingCurrentGroup = accessType === 'group'
    && selectedGroup
    && !availableGroups.some((group) => group.id === selectedGroup || group.name === selectedGroup);

  return (
    <Form onSubmit={handleSubmit}>
      {error && (
        <Alert variant="danger" isInline title="Unable to save category" style={{ marginBottom: '1rem' }}>
          {error}
        </Alert>
      )}
      {groupsError && (
        <Alert variant="warning" isInline title="Group options unavailable" style={{ marginBottom: '1rem' }}>
          {groupsError} You can still create or update a public category.
        </Alert>
      )}

      <FormGroup label="Name" isRequired fieldId="category-name">
        <TextInput
          id="category-name"
          value={name}
          maxLength={63}
          readOnly={mode === 'edit'}
          onChange={(_event, value) => setName(value)}
          aria-invalid={Boolean(validationErrors.name)}
        />
        {validationErrors.name && (
          <FormHelperText>
            <HelperText><HelperTextItem variant="error">{validationErrors.name}</HelperTextItem></HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      <FormGroup label="Color" fieldId="category-color">
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <input
            id="category-color-picker"
            type="color"
            value={colorPickerValue}
            onChange={(event) => setColor(event.currentTarget.value)}
            aria-label="Choose category color"
            title="Choose category color"
            aria-invalid={Boolean(validationErrors.color)}
            style={{ width: '3.25rem', height: '2.5rem', padding: '0.2rem', cursor: 'pointer' }}
          />
          <TextInput
            id="category-color"
            value={color}
            placeholder="#RRGGBB"
            onChange={(_event, value) => setColor(value)}
            aria-invalid={Boolean(validationErrors.color)}
            style={{ flex: '1 1 12rem' }}
          />
          {color && (
            <Button type="button" variant="link" onClick={() => setColor('')} isDisabled={submitting}>
              Use default
            </Button>
          )}
        </div>
        {validationErrors.color ? (
          <FormHelperText>
            <HelperText><HelperTextItem variant="error">{validationErrors.color}</HelperTextItem></HelperText>
          </FormHelperText>
        ) : (
          <FormHelperText>
            <HelperText><HelperTextItem>Optional. Choose a color or enter a #RRGGBB value; leave empty to use the default.</HelperTextItem></HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      <FormGroup label="Visibility" isRequired fieldId="category-visibility">
        <Radio
          id="category-public"
          name="category-visibility"
          label="Public (available to all users)"
          isChecked={accessType === 'public'}
          onChange={() => setAccessType('public')}
        />
        <Radio
          id="category-group"
          name="category-visibility"
          label="Visible to a group"
          isChecked={accessType === 'group'}
          isDisabled={!groupsLoaded || availableGroups.length === 0}
          onChange={() => setAccessType('group')}
        />
        {!groupsLoaded && <Spinner size="sm" aria-label="Loading groups" />}
        {groupsLoaded && availableGroups.length === 0 && (
          <FormHelperText>
            <HelperText><HelperTextItem>No groups are available to your account.</HelperTextItem></HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      {accessType === 'group' && (
        <FormGroup label="Group" isRequired fieldId="category-group-select">
          <FormSelect
            id="category-group-select"
            value={selectedGroup}
            onChange={(_event, value) => setSelectedGroup(value)}
            aria-label="Category group"
            isDisabled={!groupsLoaded || availableGroups.length === 0}
          >
            <FormSelectOption value="" label="Select a group" />
            {missingCurrentGroup && (
              <FormSelectOption value={selectedGroup} label={selectedGroup} />
            )}
            {availableGroups.map((group) => (
              <FormSelectOption
                key={group.id || group.name}
                value={group.id || group.name}
                label={group.name}
              />
            ))}
          </FormSelect>
          {categoryGroups.length > 0 && missingCurrentGroup && (
            <FormHelperText>
              <HelperText><HelperTextItem>The current group is no longer available to select.</HelperTextItem></HelperText>
            </FormHelperText>
          )}
          {validationErrors.group && (
            <FormHelperText>
              <HelperText><HelperTextItem variant="error">{validationErrors.group}</HelperTextItem></HelperText>
            </FormHelperText>
          )}
        </FormGroup>
      )}

      <ActionGroup>
        <Button type="submit" variant="primary" isLoading={submitting} isDisabled={submitting}>
          {mode === 'create' ? 'Create Category' : 'Save Changes'}
        </Button>
        <Button variant="link" onClick={onCancel} isDisabled={submitting}>
          Cancel
        </Button>
      </ActionGroup>
    </Form>
  );
}
