import {
  Button,
  Checkbox,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
} from '@patternfly/react-core';
import type { ConfigValidationErrors, EditableConfigDraft, FitnessItemDraft } from './configModel';

interface FitnessFunctionEditorProps {
  draft: EditableConfigDraft;
  errors: ConfigValidationErrors;
  onChange: (updates: Partial<EditableConfigDraft>) => void;
}

export function FitnessFunctionEditor({ draft, errors, onChange }: FitnessFunctionEditorProps) {
  const updateItem = (key: number, updates: Partial<FitnessItemDraft>) => {
    onChange({
      fitnessItems: draft.fitnessItems.map((item) => item.key === key ? { ...item, ...updates } : item),
    });
  };

  const addItem = () => {
    const nextKey = draft.fitnessItems.reduce((maximum, item) => Math.max(maximum, item.key), -1) + 1;
    const nextId = draft.fitnessItems.reduce((maximum, item) => Math.max(maximum, Number.isFinite(Number(item.id)) ? Number(item.id) : -1), -1) + 1;
    onChange({
      fitnessItems: [...draft.fitnessItems, {
        key: nextKey,
        id: String(nextId),
        title: 'Custom fitness item',
        query: draft.fitnessQuery,
        type: 'range',
        weight: '0',
      }],
    });
  };

  return (
    <div className="krkn-ai-fitness-editor">
      <p className="krkn-ai-muted">Fitness queries are evaluated by the configured Prometheus service during execution. Item weights are finite non-negative coefficients and are not auto-normalized.</p>
      <div className="krkn-ai-config-fields">
        <FormGroup label="Fitness query" fieldId="krkn-ai-fitness-query">
          <TextInput
            id="krkn-ai-fitness-query"
            value={draft.fitnessQuery}
            onChange={(_event, value) => onChange({ fitnessQuery: value })}
            validated={errors.fitnessQuery ? 'error' : 'default'}
            aria-invalid={!!errors.fitnessQuery}
          />
          {errors.fitnessQuery && <p className="krkn-ai-field-error" role="alert">{errors.fitnessQuery}</p>}
        </FormGroup>
        <FormGroup label="Fitness query type" fieldId="krkn-ai-fitness-type" isRequired>
          <FormSelect
            id="krkn-ai-fitness-type"
            value={draft.fitnessType}
            onChange={(_event, value) => onChange({ fitnessType: value as EditableConfigDraft['fitnessType'] })}
          >
            <FormSelectOption value="point" label="point" />
            <FormSelectOption value="range" label="range" />
          </FormSelect>
        </FormGroup>
      </div>

      <fieldset className="krkn-ai-fitness-includes">
        <legend>Include score components</legend>
        <Checkbox
          id="krkn-ai-include-krkn-failure"
          label="Krkn failure"
          isChecked={draft.includeKrknFailure}
          onChange={(_event, checked) => onChange({ includeKrknFailure: checked })}
        />
        <Checkbox
          id="krkn-ai-include-health-check-failure"
          label="Health-check failure"
          isChecked={draft.includeHealthCheckFailure}
          onChange={(_event, checked) => onChange({ includeHealthCheckFailure: checked })}
        />
        <Checkbox
          id="krkn-ai-include-health-check-response-time"
          label="Health-check response time"
          isChecked={draft.includeHealthCheckResponseTime}
          onChange={(_event, checked) => onChange({ includeHealthCheckResponseTime: checked })}
        />
      </fieldset>

      <div className="krkn-ai-fitness-items-heading">
        <div>
          <h3>Fitness function items</h3>
          <p className="krkn-ai-muted">Edit each item’s ID, PromQL query, aggregation type, and weight.</p>
        </div>
        <Button variant="secondary" onClick={addItem}>Add fitness item</Button>
      </div>
      {errors.fitnessItems && <p className="krkn-ai-field-error" role="alert">{errors.fitnessItems}</p>}
      <div className="krkn-ai-fitness-items">
        {draft.fitnessItems.map((item) => {
          const itemKey = `fitnessItem.${item.key}`;
          return (
            <details key={item.key} className="krkn-ai-fitness-item">
              <summary>
                <strong>Item {item.id}</strong> · {item.title} · {item.type} · weight {item.weight}
              </summary>
              <div className="krkn-ai-fitness-item-editor">
                <FormGroup label="Item ID" fieldId={`krkn-ai-fitness-item-${item.key}-id`} isRequired>
                  <TextInput
                    id={`krkn-ai-fitness-item-${item.key}-id`}
                    type="number"
                    step={1}
                    value={item.id}
                    onChange={(_event, value) => updateItem(item.key, { id: value })}
                    validated={errors[`${itemKey}.id`] ? 'error' : 'default'}
                    aria-label={`Fitness item ${item.key} ID`}
                  />
                  {errors[`${itemKey}.id`] && <p className="krkn-ai-field-error" role="alert">{errors[`${itemKey}.id`]}</p>}
                </FormGroup>
                <FormGroup label="Aggregation type" fieldId={`krkn-ai-fitness-item-${item.key}-type`} isRequired>
                  <FormSelect
                    id={`krkn-ai-fitness-item-${item.key}-type`}
                    value={item.type}
                    onChange={(_event, value) => updateItem(item.key, { type: value as FitnessItemDraft['type'] })}
                    aria-label={`Fitness item ${item.key} aggregation type`}
                  >
                    <FormSelectOption value="range" label="range" />
                    <FormSelectOption value="point" label="point" />
                  </FormSelect>
                </FormGroup>
                <FormGroup label="Weight (finite, non-negative)" fieldId={`krkn-ai-fitness-item-${item.key}-weight`} isRequired>
                  <TextInput
                    id={`krkn-ai-fitness-item-${item.key}-weight`}
                    type="number"
                    min={0}
                    step="any"
                    value={item.weight}
                    onChange={(_event, value) => updateItem(item.key, { weight: value })}
                    validated={errors[`${itemKey}.weight`] ? 'error' : 'default'}
                    aria-label={`Fitness item ${item.key} weight`}
                  />
                  {errors[`${itemKey}.weight`] && <p className="krkn-ai-field-error" role="alert">{errors[`${itemKey}.weight`]}</p>}
                </FormGroup>
                <FormGroup label="PromQL query" fieldId={`krkn-ai-fitness-item-${item.key}-query`} isRequired>
                  <textarea
                    id={`krkn-ai-fitness-item-${item.key}-query`}
                    className="krkn-ai-fitness-query"
                    rows={4}
                    value={item.query}
                    onChange={(event) => updateItem(item.key, { query: event.currentTarget.value })}
                    aria-label={`Fitness item ${item.key} query`}
                    aria-invalid={!!errors[`${itemKey}.query` ]}
                  />
                  {errors[`${itemKey}.query`] && <p className="krkn-ai-field-error" role="alert">{errors[`${itemKey}.query`]}</p>}
                </FormGroup>
                <Button
                  variant="secondary"
                  isDisabled={draft.fitnessItems.length === 1 && !draft.fitnessQuery.trim()}
                  onClick={() => onChange({ fitnessItems: draft.fitnessItems.filter((candidate) => candidate.key !== item.key) })}
                  aria-label={`Remove fitness item ${item.id}`}
                >
                  Remove item
                </Button>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
