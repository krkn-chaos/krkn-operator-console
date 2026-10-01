import { useState } from 'react';
import {
  Button,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalVariant,
  TextInput,
} from '@patternfly/react-core';
import type { ConfigValidationErrors, EditableConfigDraft, FitnessItemDraft } from './configModel';

interface FitnessFunctionEditorProps {
  draft: EditableConfigDraft;
  errors: ConfigValidationErrors;
  onChange: (updates: Partial<EditableConfigDraft>) => void;
}

export function FitnessFunctionEditor({ draft, errors, onChange }: FitnessFunctionEditorProps) {
  const [pendingRemovalKey, setPendingRemovalKey] = useState<number | null>(null);
  const [expandedItemKey, setExpandedItemKey] = useState<number | null>(null);

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
        query: '',
        type: 'point',
        weight: '1',
      }],
    });
    setExpandedItemKey(nextKey);
  };

  const confirmRemoval = () => {
    if (pendingRemovalKey !== null && draft.fitnessItems.length > 1) {
      onChange({ fitnessItems: draft.fitnessItems.filter((item) => item.key !== pendingRemovalKey) });
    }
    setPendingRemovalKey(null);
  };

  const pendingRemovalItem = draft.fitnessItems.find((item) => item.key === pendingRemovalKey);

  return (
    <div className="krkn-ai-fitness-editor">
      <p className="krkn-ai-muted">Fitness queries are evaluated by the configured Prometheus service. Item weights are non-negative relative weights normalized during scoring.</p>

      <div className="krkn-ai-editor-heading">
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
            <details
              key={item.key}
              className="krkn-ai-fitness-item"
              open={expandedItemKey === item.key ? true : undefined}
              onToggle={(event) => {
                if (expandedItemKey === item.key && !event.currentTarget.open) {
                  setExpandedItemKey(null);
                }
              }}
            >
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
                <FormGroup
                  className="krkn-ai-editor-field--wide"
                  label="PromQL query"
                  fieldId={`krkn-ai-fitness-item-${item.key}-query`}
                  isRequired
                >
                  <textarea
                    id={`krkn-ai-fitness-item-${item.key}-query`}
                    className="krkn-ai-fitness-query"
                    rows={4}
                    value={item.query}
                    onChange={(event) => updateItem(item.key, { query: event.currentTarget.value })}
                    aria-label={`Fitness item ${item.key} query`}
                    aria-invalid={!!errors[`${itemKey}.query`]}
                  />
                  {errors[`${itemKey}.query`] && <p className="krkn-ai-field-error" role="alert">{errors[`${itemKey}.query`]}</p>}
                </FormGroup>
              </div>
              <div className="krkn-ai-editor-actions">
                <Button
                  variant="secondary"
                  isDisabled={draft.fitnessItems.length === 1}
                  onClick={() => setPendingRemovalKey(item.key)}
                  aria-label={`Remove fitness item ${item.id}`}
                >
                  Remove item
                </Button>
              </div>
            </details>
          );
        })}
      </div>

      <Modal
        variant={ModalVariant.small}
        title="Remove fitness item?"
        isOpen={pendingRemovalKey !== null}
        onClose={() => setPendingRemovalKey(null)}
        actions={[
          <Button key="remove" variant="danger" onClick={confirmRemoval} isDisabled={!pendingRemovalItem || draft.fitnessItems.length === 1}>
            Remove
          </Button>,
          <Button key="cancel" variant="link" onClick={() => setPendingRemovalKey(null)}>
            Cancel
          </Button>,
        ]}
      >
        <p>
          {pendingRemovalItem
            ? <>Remove fitness item <strong>{pendingRemovalItem.id}</strong> ({pendingRemovalItem.title})?</>
            : 'This fitness item is no longer available.'}
        </p>
      </Modal>
    </div>
  );
}

