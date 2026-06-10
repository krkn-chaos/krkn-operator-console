/**
 * FileTypeForm - Create/Edit file type form
 *
 * Handles creation and editing of file types with:
 * - Name input (immutable in edit mode)
 * - Color picker (hex color input)
 * - Icon input
 * - Preview badge
 */

import { useState } from 'react';
import {
  Form,
  FormGroup,
  TextInput,
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
import type { FileTypeResponse, CreateFileTypeRequest, UpdateFileTypeRequest } from '../../types/api';

interface FileTypeFormProps {
  mode: 'create' | 'edit';
  initialData?: FileTypeResponse;
  onSuccess: () => void;
  onCancel: () => void;
}

export function FileTypeForm({ mode, initialData, onSuccess, onCancel }: FileTypeFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [color, setColor] = useState(initialData?.color || '');
  const [icon, setIcon] = useState(initialData?.icon || '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Validate form
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Name is required';
    } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)) {
      errors.name = 'Name must be lowercase letters, numbers, and hyphens only';
    }

    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      errors.color = 'Color must be hex format (#RRGGBB) or empty for default';
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
      if (mode === 'create') {
        const request: CreateFileTypeRequest = {
          name,
          color: color.trim() || undefined,
          icon: icon.trim() || undefined,
        };

        await operatorApi.createFileType(request);
      } else {
        const request: UpdateFileTypeRequest = {
          name,
          color: color.trim(),
          icon: icon.trim(),
        };

        await operatorApi.updateFileType(name, request);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${mode} file type`);
    } finally {
      setSubmitting(false);
    }
  };

  // Get preview color (fallback to grey if empty)
  const previewColor = color || '#6c757d';
  const previewIcon = icon || 'file';

  return (
    <Form onSubmit={handleSubmit}>
      {error && (
        <Alert variant="danger" isInline title="Error" style={{ marginBottom: '1rem' }}>
          {error}
        </Alert>
      )}

      {mode === 'edit' && initialData && (
        <Alert variant="info" isInline title="Usage Info" style={{ marginBottom: '1rem' }}>
          This type is used by {initialData.usageCount} {initialData.usageCount === 1 ? 'file' : 'files'}.
        </Alert>
      )}

      <FormGroup label="Name" isRequired fieldId="type-name-input">
        <TextInput
          id="type-name-input"
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
                Type identifier (lowercase, numbers, hyphens). Cannot be changed after creation.
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>

      <FormGroup label="Color" fieldId="color-input">
        <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            <input
              type="color"
              id="color-picker"
              value={color || '#6c757d'}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: '60px',
                height: '40px',
                border: '2px solid var(--pf-v5-global--BorderColor--100)',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            />
          </FlexItem>
          <FlexItem flex={{ default: 'flex_1' }}>
            <TextInput
              id="color-input"
              value={color}
              onChange={(_event, value) => setColor(value)}
              validated={validationErrors.color ? 'error' : 'default'}
              placeholder="#FF5733"
              style={{ fontFamily: 'monospace', width: '120px' }}
            />
          </FlexItem>
          <FlexItem>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '4px',
                backgroundColor: previewColor,
                border: '2px solid var(--pf-v5-global--BorderColor--100)',
              }}
            />
          </FlexItem>
          {color && (
            <FlexItem>
              <Button variant="link" isInline onClick={() => setColor('')}>
                Clear (use default)
              </Button>
            </FlexItem>
          )}
        </Flex>
        {validationErrors.color && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{validationErrors.color}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
        <FormHelperText>
          <HelperText>
            <HelperTextItem>
              Pick a color or enter hex code (e.g., #FF5733). Leave empty to use default UI color.
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>

      <FormGroup label="Icon" fieldId="icon-input">
        <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem flex={{ default: 'flex_1' }}>
            <TextInput
              id="icon-input"
              value={icon}
              onChange={(_event, value) => setIcon(value)}
              placeholder="file-code, terminal, gear..."
            />
          </FlexItem>
          {icon && (
            <FlexItem>
              <Button variant="link" isInline onClick={() => setIcon('')}>
                Clear (use default)
              </Button>
            </FlexItem>
          )}
        </Flex>
        <FormHelperText>
          <HelperText>
            <HelperTextItem>
              Icon name or identifier. Leave empty to use default icon.
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>

      <FormGroup label="Preview" fieldId="preview">
        <Label
          color="grey"
          style={{
            backgroundColor: previewColor,
            color: '#fff',
            fontSize: '1rem',
            padding: '0.5rem 1rem',
          }}
        >
          {previewIcon} {name || 'type-name'}
        </Label>
        <FormHelperText>
          <HelperText>
            <HelperTextItem>
              This is how the badge will appear in the file list.
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>

      <ActionGroup>
        <Button variant="primary" type="submit" isDisabled={submitting} isLoading={submitting}>
          {mode === 'create' ? 'Create Type' : 'Save Changes'}
        </Button>
        <Button variant="link" onClick={onCancel} isDisabled={submitting}>
          Cancel
        </Button>
      </ActionGroup>
    </Form>
  );
}
