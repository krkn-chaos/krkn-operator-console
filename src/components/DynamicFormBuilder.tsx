import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Form,
  FormGroup,
  SearchInput,
  TextInput,
  FormSelect,
  FormSelectOption,
  Checkbox,
  FileUpload,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Title,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import type { ScenarioField, ScenarioFormValues, StringField, EnumField } from '../types/api';

interface DynamicFormBuilderProps {
  fields: ScenarioField[];
  values: ScenarioFormValues;
  onChange: (values: ScenarioFormValues) => void;
}

export function DynamicFormBuilder({ fields, values, onChange }: DynamicFormBuilderProps) {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const initializedFieldsKey = useRef<string>('');
  const validationTimeouts = useRef<{ [key: string]: number }>({});

  const disabledFields = useMemo(() => {
    const disabled = new Set<string>();
    for (const field of fields) {
      if (
        field.mutually_excludes &&
        field.type === 'enum' &&
        (field as EnumField).allowed_values === 'true,false'
      ) {
        const currentValue = values[field.variable] ?? field.default ?? '';
        if (currentValue === 'true' || currentValue === true) {
          disabled.add(field.mutually_excludes);
        }
      }
    }
    return disabled;
  }, [fields, values]);

  /**
   * Safe regex test with timeout protection
   * Prevents ReDoS attacks from externally-provided regex patterns
   */
  const safeRegexTest = useCallback((pattern: string, value: string): boolean => {
    const MAX_REGEX_TIME = 100; // ms - prevent expensive backtracking
    const MAX_INPUT_LENGTH = 10000; // chars - prevent long input attacks

    // Reject excessively long input
    if (value.length > MAX_INPUT_LENGTH) {
      return false;
    }

    try {
      const regex = new RegExp(pattern);
      let timeoutOccurred = false;

      // Set a timeout to abort long-running regex
      const timeoutId = setTimeout(() => {
        timeoutOccurred = true;
      }, MAX_REGEX_TIME);

      const result = regex.test(value);
      clearTimeout(timeoutId);

      // If timeout occurred, treat as validation failure
      if (timeoutOccurred) {
        console.warn(`Regex validation timed out for pattern: ${pattern}`);
        return false;
      }

      return result;
    } catch {
      // Invalid regex in schema - skip validation
      return true;
    }
  }, []);

  const handleChange = (variable: string, value: string | number | boolean | File) => {
    const newValues = { ...values, [variable]: value };

    const changedField = fields.find(f => f.variable === variable);
    if (changedField?.mutually_excludes && (value === 'true' || value === true)) {
      const excludedField = fields.find(f => f.variable === changedField.mutually_excludes);
      if (excludedField) {
        newValues[changedField.mutually_excludes] = excludedField.default ?? '';
      }
    }

    onChange(newValues);

    // Clear existing validation timeout for this field
    if (validationTimeouts.current[variable]) {
      clearTimeout(validationTimeouts.current[variable]);
    }

    const field = fields.find(f => f.variable === variable);
    if (field?.type === 'string' && typeof value === 'string' && value !== '') {
      const stringField = field as StringField;
      if (stringField.validator) {
        // Debounce validation by 300ms to avoid expensive regex on every keystroke
        validationTimeouts.current[variable] = window.setTimeout(() => {
          if (!safeRegexTest(stringField.validator!, value)) {
            setErrors(prev => ({
              ...prev,
              [variable]: stringField.validation_message || `Must match pattern: ${stringField.validator}`
            }));
          } else {
            setErrors(prev => ({ ...prev, [variable]: '' }));
          }
        }, 300);
        return;
      }
    }

    // Clear error immediately if field becomes empty or non-string
    if (errors[variable]) {
      setErrors(prev => ({ ...prev, [variable]: '' }));
    }
  };

  const renderField = (field: ScenarioField, isFieldDisabled: boolean = false) => {
    const value = values[field.variable] ?? field.default ?? '';
    const error = errors[field.variable];
    const validated = error ? 'error' : 'default';

    switch (field.type) {
      case 'string': {
        const stringField = field as StringField;
        return (
          <FormGroup
            key={field.variable}
            label={field.short_description}
            isRequired={field.required}
            fieldId={field.variable}
          >
            <TextInput
              id={field.variable}
              type={field.secret ? 'password' : 'text'}
              value={value as string}
              onChange={(_event, val) => handleChange(field.variable, val)}
              validated={validated}
              placeholder={field.default}
              autoComplete={field.secret ? 'off' : undefined}
              isDisabled={isFieldDisabled}
            />
            {field.description && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{field.description}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
            {stringField.validator && stringField.validation_message && !error && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="indeterminate">
                    {stringField.validation_message}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
            {error && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                    {error}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
        );
      }

      case 'number':
        return (
          <FormGroup
            key={field.variable}
            label={field.short_description}
            isRequired={field.required}
            fieldId={field.variable}
          >
            <TextInput
              id={field.variable}
              type="number"
              value={value as string}
              onChange={(_event, val) => handleChange(field.variable, val)}
              validated={validated}
              placeholder={field.default}
              isDisabled={isFieldDisabled}
            />
            {field.description && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{field.description}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
            {error && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                    {error}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
        );

      case 'enum': {
        const enumField = field as EnumField;

        if (!enumField.allowed_values || !enumField.separator) {
          return (
            <FormGroup
              key={field.variable}
              label={field.short_description}
              isRequired={field.required}
              fieldId={field.variable}
            >
              <TextInput
                id={field.variable}
                value={value as string}
                onChange={(_event, val) => handleChange(field.variable, val)}
                placeholder="Error: enum configuration missing"
                isDisabled
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">
                    Enum field is misconfigured (missing allowed_values or separator)
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          );
        }

        const options = enumField.allowed_values.split(enumField.separator).map((opt: string) => opt.trim());
        return (
          <FormGroup
            key={field.variable}
            label={field.short_description}
            isRequired={field.required}
            fieldId={field.variable}
          >
            <FormSelect
              id={field.variable}
              value={value as string}
              onChange={(_event, val) => handleChange(field.variable, val)}
              validated={validated}
              isDisabled={isFieldDisabled}
            >
              {!field.required && <FormSelectOption key="empty" value="" label="Select an option" />}
              {options.map((option: string) => (
                <FormSelectOption key={option} value={option} label={option} />
              ))}
            </FormSelect>
            {field.description && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{field.description}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
            {error && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                    {error}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
        );
      }

      case 'boolean':
        return (
          <FormGroup key={field.variable} fieldId={field.variable}>
            <Checkbox
              id={field.variable}
              label={field.short_description}
              description={field.description}
              isChecked={value === true || value === 'true'}
              onChange={(_event, checked) => handleChange(field.variable, checked)}
              isDisabled={isFieldDisabled}
            />
          </FormGroup>
        );

      case 'file':
      case 'file_base64':
        return (
          <FormGroup
            key={field.variable}
            label={field.short_description}
            isRequired={field.required}
            fieldId={field.variable}
          >
            <FileUpload
              id={field.variable}
              value={value as string | File}
              filename={(value as File)?.name || ''}
              onFileInputChange={(_event, file: File) => handleChange(field.variable, file)}
              validated={validated}
              isDisabled={isFieldDisabled}
            />
            {field.description && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{field.description}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
            {error && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                    {error}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
        );

      default:
        return null;
    }
  };

  // Cleanup validation timeouts on unmount
  useEffect(() => {
    const timeouts = validationTimeouts.current;
    return () => {
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // Initialize form values with defaults
  // Only initialize once per unique fields configuration
  useEffect(() => {
    const valueFields = fields.filter(f => f.type !== 'group');
    const fieldsKey = valueFields
      .map(f => `${f.variable}:${f.type}:${f.default}:${f.secret}`)
      .sort()
      .join(',');

    if (initializedFieldsKey.current === fieldsKey) {
      return;
    }

    initializedFieldsKey.current = fieldsKey;

    const initialValues: ScenarioFormValues = {};
    valueFields.forEach((field) => {
      if (field.default !== undefined) {
        initialValues[field.variable] = field.default;
      }
    });
    onChange({ ...initialValues, ...values });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const groupMembers = useMemo(() => {
    const members = new Map<string, ScenarioField[]>();
    for (const field of fields) {
      if (field.type !== 'group' && field.group) {
        const list = members.get(field.group) || [];
        list.push(field);
        members.set(field.group, list);
      }
    }
    return members;
  }, [fields]);

  return (
    <Form>
      {fields.map((field) => {
        if (field.type === 'group') {
          const members = groupMembers.get(field.variable) || [];
          return (
            <ScrollableFieldGroup
              key={field.variable}
              groupField={field}
              members={members}
              disabledFields={disabledFields}
              renderField={renderField}
            />
          );
        }
        if (field.group) {
          return null;
        }
        return renderField(field, disabledFields.has(field.variable));
      })}
    </Form>
  );
}

const GROUP_CONTAINER_HEIGHT = 400;

function ScrollableFieldGroup({
  groupField,
  members,
  disabledFields,
  renderField,
}: {
  groupField: ScenarioField;
  members: ScenarioField[];
  disabledFields: Set<string>;
  renderField: (field: ScenarioField, isDisabled: boolean) => React.ReactNode;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return members;
    const lower = search.toLowerCase();
    return members.filter(
      (m) =>
        m.short_description.toLowerCase().includes(lower) ||
        m.variable.toLowerCase().includes(lower)
    );
  }, [members, search]);

  return (
    <div
      style={{
        border: '1px solid var(--pf-v5-global--BorderColor--100)',
        borderRadius: 'var(--pf-v5-global--BorderRadius--sm)',
        marginBottom: '1rem',
      }}
    >
      <div
        style={{
          borderLeft: '4px solid var(--pf-v5-global--primary-color--100)',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--pf-v5-global--BorderColor--100)',
          background: 'var(--pf-v5-global--BackgroundColor--200)',
        }}
      >
        <Title headingLevel="h2" size="xl" id={`group-${groupField.variable}-title`}>
          {groupField.short_description}
        </Title>
        <p style={{ marginTop: '0.5rem', fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
          {groupField.description}
        </p>
      </div>
      <div style={{ padding: '1rem' }}>
        <SearchInput
          placeholder="Filter fields..."
          value={search}
          onChange={(_event, value) => setSearch(value)}
          onClear={() => setSearch('')}
          style={{ marginBottom: '0.75rem' }}
        />
        <div
          style={{
            maxHeight: `${GROUP_CONTAINER_HEIGHT}px`,
            overflowY: 'auto',
          }}
        >
          {filtered.length > 0 ? (
            filtered.map((m) => renderField(m, disabledFields.has(m.variable)))
          ) : (
            <FormHelperText>
              <HelperText>
                <HelperTextItem>No fields match your search.</HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </div>
      </div>
    </div>
  );
}
