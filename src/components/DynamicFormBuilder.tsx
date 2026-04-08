import { useState, useEffect } from 'react';
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
import type { ScenarioField, ScenarioFormValues, StringField, EnumField } from '../types/api';

interface DynamicFormBuilderProps {
  fields: ScenarioField[];
  values: ScenarioFormValues;
  onChange: (values: ScenarioFormValues) => void;
}

export function DynamicFormBuilder({ fields, values, onChange }: DynamicFormBuilderProps) {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleChange = (variable: string, value: string | number | boolean | File) => {
    const newValues = { ...values, [variable]: value };
    onChange(newValues);

    // Clear error for this field
    if (errors[variable]) {
      setErrors({ ...errors, [variable]: '' });
    }
  };

  const renderField = (field: ScenarioField) => {
    const value = values[field.variable] ?? field.default ?? '';
    const error = errors[field.variable];
    const validated = error ? 'error' : 'default';

    switch (field.type) {
      case 'string': {
        const stringField = field as StringField; // Cast to access validator/validation_message
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
        // Type narrowing: cast to EnumField to access allowed_values and separator
        const enumField = field as EnumField;

        // Validate that enum field has required properties
        if (!enumField.allowed_values || !enumField.separator) {
          console.error('Enum field missing required properties:', field);
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

  // Initialize form values with defaults
  // Set default values on mount
  useEffect(() => {
    const initialValues: ScenarioFormValues = {};
    fields.forEach((field) => {
      if (field.default !== undefined) {
        initialValues[field.variable] = field.default;
      }
    });
    onChange({ ...initialValues, ...values });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]); // Only run when fields change, not when onChange or values change

  return <Form>{fields.map((field) => renderField(field))}</Form>;
}
