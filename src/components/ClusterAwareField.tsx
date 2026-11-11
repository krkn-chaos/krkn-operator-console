import type { ReactElement } from 'react';
import type { ScenarioField } from '../types/api';
import type { ClusterFieldOptionState } from '../utils/clusterParameterOptions';
import { isSecretField } from '../utils/fieldUtils';
import { ClusterOptionInput } from './ClusterOptionInput';

interface ClusterAwareFieldProps {
  field: ScenarioField;
  value: string;
  validated: 'default' | 'error';
  placeholder?: string;
  isDisabled: boolean;
  clusterOptions?: Record<string, ClusterFieldOptionState>;
  onChange: (value: string) => void;
  onOptionsOpen?: (variable: string) => void;
  fallback: ReactElement;
}

/** Renders discovered options when available, leaving fallback input to caller. */
export function ClusterAwareField({
  field, value, validated, placeholder, isDisabled, clusterOptions,
  onChange, onOptionsOpen, fallback,
}: ClusterAwareFieldProps) {
  const optionState = clusterOptions?.[field.variable];
  if (!optionState || isSecretField(field)) return fallback;

  return <ClusterOptionInput
    id={field.variable}
    label={field.short_description}
    value={value}
    onChange={onChange}
    validated={validated}
    placeholder={placeholder}
    isDisabled={isDisabled}
    optionState={optionState}
    onOptionsOpen={() => onOptionsOpen?.(field.variable)}
  />;
}
