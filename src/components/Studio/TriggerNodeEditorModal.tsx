import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, FormGroup, Modal, ModalVariant, Spinner, TextInput } from '@patternfly/react-core';
import { operatorApi } from '../../services/operatorApi';
import { DynamicFormBuilder } from '../DynamicFormBuilder';
import type { EnumField, ScenarioField, ScenarioFormValues, StudioNode } from '../../types/api';
import { useStudioContext } from './StudioContext';

const TRIGGER_IMAGE = 'quay.io/krkn-chaos/krkn-hub:trigger';
const TRIGGER_TYPE_FIELD = 'TRIGGER_TYPE';
const CONDITIONS_JSON_FIELD = 'TRIGGERS_CONDITIONS_JSON';
const SHARED_TRIGGER_FIELDS = [
  'TRIGGERS_MODE',
  'TRIGGERS_TIMEOUT',
  'TRIGGERS_INTERVAL',
  'TRIGGERS_ON_TIMEOUT',
];

const CONDITION_CONFIG_KEYS: Record<string, Record<string, string>> = {
  command: {
    TRIGGER_COMMAND: 'inline',
    TRIGGER_EXPECTED_RC: 'expected_rc',
  },
  http: {
    TRIGGER_HTTP_URL: 'url',
    TRIGGER_HTTP_METHOD: 'method',
    TRIGGER_HTTP_EXPECTED_STATUS: 'expected_status',
    TRIGGER_HTTP_BEARER_TOKEN: 'bearer_token',
    TRIGGER_HTTP_BODY_CONTAINS: 'body_contains',
  },
  k8s: {
    TRIGGER_K8S_API_VERSION: 'apiVersion',
    TRIGGER_K8S_KIND: 'kind',
    TRIGGER_K8S_NAMESPACE: 'namespace',
    TRIGGER_K8S_NAME: 'name',
    TRIGGER_K8S_CONDITION: 'condition',
  },
  prometheus: {
    TRIGGER_PROM_QUERY: 'query',
    TRIGGER_PROM_URL: 'prometheus_url',
    TRIGGER_PROM_TOKEN: 'prometheus_bearer_token',
  },
};

const REQUIRED_CONDITION_FIELDS: Record<string, string[]> = {
  command: ['TRIGGER_COMMAND'],
  http: ['TRIGGER_HTTP_URL'],
  k8s: ['TRIGGER_K8S_API_VERSION', 'TRIGGER_K8S_KIND', 'TRIGGER_K8S_NAME'],
  prometheus: ['TRIGGER_PROM_QUERY', 'TRIGGER_PROM_URL'],
};

const TRIGGER_TYPE_FIELD_DEFINITION: EnumField = {
  name: 'trigger-type',
  short_description: 'Trigger type',
  description: 'Select the event condition type for this trigger.',
  variable: TRIGGER_TYPE_FIELD,
  default: 'command',
  required: true,
  type: 'enum',
  allowed_values: 'command,http,k8s,prometheus',
  separator: ',',
  group: 'triggers',
};

const CONDITION_TYPE_BY_FIELD = Object.entries(CONDITION_CONFIG_KEYS).reduce<Record<string, string>>(
  (result, [type, configKeys]) => {
    Object.keys(configKeys).forEach(variable => { result[variable] = type; });
    return result;
  },
  {}
);

interface TriggerConditionForm {
  id: number;
  values: ScenarioFormValues;
}

interface Props {
  isOpen: boolean;
  node: StudioNode | null;
  onClose: () => void;
  onSave: (nodeId: string, updates: Partial<StudioNode>) => void;
}

function conditionFromConfig(config: Record<string, unknown>, id: number): TriggerConditionForm | null {
  const type = String(config.type ?? '');
  const fieldMap = CONDITION_CONFIG_KEYS[type];
  if (!fieldMap) return null;

  const values: ScenarioFormValues = { [TRIGGER_TYPE_FIELD]: type };
  for (const [field, configKey] of Object.entries(fieldMap)) {
    const value = config[configKey];
    if (value !== undefined && value !== null) values[field] = value as string | number | boolean;
  }
  return { id, values };
}

export function TriggerNodeEditorModal({ isOpen, node, onClose, onSave }: Props) {
  const { validateNodeId } = useStudioContext();
  const [fields, setFields] = useState<ScenarioField[]>([]);
  const [sharedValues, setSharedValues] = useState<ScenarioFormValues>({});
  const [conditions, setConditions] = useState<TriggerConditionForm[]>([
    { id: 1, values: { [TRIGGER_TYPE_FIELD]: 'command' } },
  ]);
  const [nodeId, setNodeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const nextConditionId = useRef(2);

  const triggerFields = useMemo(
    () => {
      const normalized = fields
      .filter(field => (field.type === 'group' && field.name === 'triggers') || field.group === 'triggers')
      .map(field => {
        if (field.type === 'group') {
          return !field.variable ? { ...field, variable: 'triggers' } : field;
        }
        const conditionType = CONDITION_TYPE_BY_FIELD[field.variable];
        const withConditionType = !field.trigger_type && conditionType
          ? { ...field, trigger_type: conditionType }
          : field;
        if (field.variable === TRIGGER_TYPE_FIELD && field.type === 'enum') {
          return {
            ...withConditionType,
            allowed_values: TRIGGER_TYPE_FIELD_DEFINITION.allowed_values,
            separator: TRIGGER_TYPE_FIELD_DEFINITION.separator,
            default: field.default ?? TRIGGER_TYPE_FIELD_DEFINITION.default,
          };
        }
        return withConditionType;
      });

      if (!normalized.some(field => field.variable === TRIGGER_TYPE_FIELD)) {
        const groupIndex = normalized.findIndex(field => field.type === 'group' && field.name === 'triggers');
        normalized.splice(groupIndex >= 0 ? groupIndex + 1 : 0, 0, TRIGGER_TYPE_FIELD_DEFINITION);
      }
      return normalized;
    },
    [fields]
  );
  const sharedFields = useMemo(
    () => triggerFields
      .filter(field => SHARED_TRIGGER_FIELDS.includes(field.variable))
      .map(field => ({ ...field, group: undefined })),
    [triggerFields]
  );
  const conditionFields = useMemo(
    () => triggerFields
      .filter(field => field.variable === TRIGGER_TYPE_FIELD || Boolean(field.trigger_type))
      .map(field => ({ ...field, group: undefined })),
    [triggerFields]
  );

  useEffect(() => {
    if (!isOpen || !node) return;
    setNodeId(node.nodeId);
    setError('');
    setLoadError('');
    setLoading(true);

    const savedValues = node.config?.scenarioFormValues ?? {};
    const restoredShared: ScenarioFormValues = {};
    for (const field of SHARED_TRIGGER_FIELDS) {
      if (savedValues[field] !== undefined) restoredShared[field] = savedValues[field];
    }
    setSharedValues(restoredShared);

    let restoredConditions: TriggerConditionForm[] = [];
    const serializedConditions = savedValues[CONDITIONS_JSON_FIELD];
    if (typeof serializedConditions === 'string' && serializedConditions) {
      try {
        const parsed: unknown = JSON.parse(serializedConditions);
        if (Array.isArray(parsed)) {
          restoredConditions = parsed
            .map((item, index) => item && typeof item === 'object'
              ? conditionFromConfig(item as Record<string, unknown>, index + 1)
              : null)
            .filter((item): item is TriggerConditionForm => item !== null);
        }
      } catch {
        // Fall back to the prior flat trigger fields when saved JSON is malformed.
      }
    }

    if (restoredConditions.length === 0) {
      const legacyType = String(savedValues[TRIGGER_TYPE_FIELD] ?? 'command');
      const legacyFields = CONDITION_CONFIG_KEYS[legacyType] ?? {};
      const legacyValues: ScenarioFormValues = { [TRIGGER_TYPE_FIELD]: legacyType };
      for (const field of Object.keys(legacyFields)) {
        if (savedValues[field] !== undefined) legacyValues[field] = savedValues[field];
      }
      const requiredFields = REQUIRED_CONDITION_FIELDS[legacyType] ?? [];
      const hasLegacyCondition = requiredFields.length > 0 &&
        requiredFields.every(field => Boolean(legacyValues[field]));
      restoredConditions = hasLegacyCondition
        ? [{ id: 1, values: legacyValues }]
        : [{ id: 1, values: { [TRIGGER_TYPE_FIELD]: 'command' } }];
    }

    setConditions(restoredConditions);
    nextConditionId.current = restoredConditions.length + 1;

    // The trigger workload image is not a catalog scenario, so load its
    // krknctl.input_fields metadata through the direct detail endpoint.
    operatorApi.getScenarioDetail('trigger', {}).then(detail => {
      setFields(detail.fields);
    }).catch(err => {
      setLoadError(err instanceof Error ? err.message : 'Unable to load trigger parameters');
    }).finally(() => setLoading(false));
  }, [isOpen, node]);

  const updateCondition = (id: number, nextValues: ScenarioFormValues) => {
    setConditions(current => current.map(condition => {
      if (condition.id !== id) return condition;
      const previousType = String(condition.values[TRIGGER_TYPE_FIELD] ?? 'command');
      const nextType = String(nextValues[TRIGGER_TYPE_FIELD] ?? 'command');
      if (previousType !== nextType) {
        for (const field of conditionFields) {
          if (field.trigger_type && field.trigger_type !== nextType) {
            nextValues[field.variable] = field.default ?? '';
          }
        }
      }
      return { ...condition, values: nextValues };
    }));
    setError('');
  };

  const addCondition = () => {
    setConditions(current => [
      ...current,
      { id: nextConditionId.current++, values: { [TRIGGER_TYPE_FIELD]: 'command' } },
    ]);
  };

  const handleSave = () => {
    if (!node) return;
    const validation = validateNodeId(nodeId, node.nodeId);
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid node ID');
      return;
    }

    const incompleteCondition = conditions.find(condition => {
      const type = String(condition.values[TRIGGER_TYPE_FIELD] ?? 'command');
      const requiredFields = REQUIRED_CONDITION_FIELDS[type] ?? [];
      return requiredFields.length === 0 || requiredFields.some(field => {
        const value = condition.values[field];
        return value === undefined || value === '';
      });
    });
    if (incompleteCondition) {
      setError('Configure the required condition field for every trigger.');
      return;
    }

    const conditionTypes = conditions.map(condition => String(condition.values[TRIGGER_TYPE_FIELD] ?? 'command'));
    if (new Set(conditionTypes).size !== conditionTypes.length) {
      setError('Each trigger type can only be configured once per node.');
      return;
    }

    // The trigger image consumes these flat environment variables directly.
    // It does not consume TRIGGERS_CONDITIONS_JSON.
    const scenarioFormValues: ScenarioFormValues = {
      ...sharedValues,
    };
    for (const condition of conditions) {
      const type = String(condition.values[TRIGGER_TYPE_FIELD] ?? 'command');
      for (const [field, value] of Object.entries(condition.values)) {
        if (field !== TRIGGER_TYPE_FIELD && CONDITION_TYPE_BY_FIELD[field] === type && value !== '') {
          scenarioFormValues[field] = value;
        }
      }
    }

    onSave(node.nodeId, {
      nodeId,
      nodeType: 'trigger',
      status: 'configured',
      config: {
        nodeType: 'trigger',
        registryType: 'public',
        registryConfig: {},
        scenarioName: 'trigger',
        scenarioImage: TRIGGER_IMAGE,
        scenarioFormValues,
      },
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant={ModalVariant.medium} title="Configure Wait for Trigger">
      <div>
        <Alert isInline variant="info" title="Wait for events before continuing">
          Add one or more trigger conditions. The selected trigger mode controls whether all conditions or any condition must match.
        </Alert>
        <FormGroup label="Node ID" isRequired>
          <TextInput value={nodeId} onChange={(_event, value) => { setNodeId(value); setError(''); }} aria-label="Node ID" />
          {error && <Alert isInline variant="danger" title={error} />}
        </FormGroup>
        {loading ? <Spinner aria-label="Loading trigger parameters" /> : loadError ? (
          <Alert isInline variant="danger" title="Could not load trigger parameters">{loadError}</Alert>
        ) : triggerFields.length ? (
          <>
            <DynamicFormBuilder fields={sharedFields} values={sharedValues} onChange={setSharedValues} />
            {conditions.map((condition, index) => {
              const triggerType = String(condition.values[TRIGGER_TYPE_FIELD] ?? 'command');
              const requiredFields = REQUIRED_CONDITION_FIELDS[triggerType] ?? [];
              const fieldsForCondition = conditionFields
                .filter(field => field.variable === TRIGGER_TYPE_FIELD ||
                  field.trigger_type === triggerType)
                .map(field => ({
                  ...field,
                  required: field.variable === TRIGGER_TYPE_FIELD ||
                    requiredFields.includes(field.variable) || field.required,
                }));
              return (
                <div
                  key={condition.id}
                  style={{
                    border: '1px solid var(--pf-t--global--border--color--default)',
                    borderRadius: '8px',
                    marginBlock: '1rem',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>Trigger {index + 1}</strong>
                    <Button
                      variant="link"
                      onClick={() => setConditions(current => current.filter(item => item.id !== condition.id))}
                      isDisabled={conditions.length === 1}
                    >
                      Remove
                    </Button>
                  </div>
                  <DynamicFormBuilder
                    fields={fieldsForCondition}
                    values={condition.values}
                    onChange={values => updateCondition(condition.id, values)}
                  />
                </div>
              );
            })}
            <Button variant="secondary" onClick={addCondition}>Add trigger condition</Button>
          </>
        ) : <Alert isInline variant="warning" title="No trigger fields found in image metadata" />}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
        <Button variant="link" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} isDisabled={loading || !!loadError || triggerFields.length === 0}>Save</Button>
      </div>
    </Modal>
  );
}
