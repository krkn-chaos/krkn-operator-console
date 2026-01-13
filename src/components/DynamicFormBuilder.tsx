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
import type { ScenarioField, ScenarioFormValues } from '../types/api';

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
      case 'string':
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

      case 'enum':
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
  useEffect(() => {
    const initialValues: ScenarioFormValues = {};
    fields.forEach((field) => {
      if (field.default !== undefined) {
        initialValues[field.variable] = field.default;
      }
    });
    onChange({ ...initialValues, ...values });
  }, [fields]);

  return <Form>{fields.map((field) => renderField(field))}</Form>;
}
