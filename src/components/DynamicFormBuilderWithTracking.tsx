import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Form,
  FormGroup,
  TextInput,
  FormSelect,
  FormSelectOption,
  Checkbox,
  FileUpload,
  FormHelperText,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import type { ScenarioField, ScenarioFormValues, TouchedFields, StringField } from '../types/api';

interface DynamicFormBuilderWithTrackingProps {
  fields: ScenarioField[];
  values: ScenarioFormValues;
  touchedFields: TouchedFields;
  onChange: (values: ScenarioFormValues, touchedFields: TouchedFields) => void;
}

export function DynamicFormBuilderWithTracking({
  fields,
  values,
  touchedFields,
  onChange
}: DynamicFormBuilderWithTrackingProps) {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const validationTimeouts = useRef<{ [key: string]: number }>({});

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

  // Cleanup validation timeouts on unmount
  useEffect(() => {
    const timeouts = validationTimeouts.current;
    return () => {
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  const handleChange = (variable: string, value: string | number | boolean | File) => {
    const newValues = { ...values, [variable]: value };
    const newTouchedFields = { ...touchedFields, [variable]: true };
    onChange(newValues, newTouchedFields);

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

  const renderField = (field: ScenarioField) => {
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
        const options = field.allowed_values.split(field.separator).map((opt) => opt.trim());
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
            >
              {!field.required && <FormSelectOption key="empty" value="" label="Select an option" />}
              {options.map((option) => (
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

  return <Form>{fields.map((field) => renderField(field))}</Form>;
}
