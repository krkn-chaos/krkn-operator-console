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
import { validateConfigDraft } from './configModel';
import './FitnessFunctionEditor.css';

interface FitnessFunctionEditorProps {
  draft: EditableConfigDraft;
  errors: ConfigValidationErrors;
  onChange: (updates: Partial<EditableConfigDraft>) => void;
}

export function FitnessFunctionEditor({ draft, errors, onChange }: FitnessFunctionEditorProps) {
  const [editingItem, setEditingItem] = useState<FitnessItemDraft | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showEntryErrors, setShowEntryErrors] = useState(false);
  const [pendingRemovalKey, setPendingRemovalKey] = useState<number | null>(null);

  const openAdd = () => {
    const nextKey = draft.fitnessItems.reduce((maximum, item) => Math.max(maximum, item.key), -1) + 1;
    const nextId = draft.fitnessItems.reduce(
      (maximum, item) => Math.max(maximum, Number.isFinite(Number(item.id)) ? Number(item.id) : -1),
      -1,
    ) + 1;
    setEditingItem({ key: nextKey, id: String(nextId), title: 'Custom fitness item', query: '', type: 'point', weight: '1' });
    setIsAdding(true);
    setShowEntryErrors(false);
  };

  const openEdit = (item: FitnessItemDraft) => {
    setEditingItem({ ...item });
    setIsAdding(false);
    setShowEntryErrors(false);
  };

  const closeEditor = () => {
    setEditingItem(null);
    setIsAdding(false);
    setShowEntryErrors(false);
  };

  const updateEditingItem = (updates: Partial<FitnessItemDraft>) => {
    setEditingItem((current) => current ? { ...current, ...updates } : current);
  };

  const entryErrors = editingItem
    ? validateConfigDraft({
      ...draft,
      fitnessItems: isAdding
        ? [...draft.fitnessItems, editingItem]
        : draft.fitnessItems.map((item) => item.key === editingItem.key ? editingItem : item),
    })
    : {};
  const fieldError = (field: 'id' | 'query' | 'weight') =>
    showEntryErrors ? entryErrors[`fitnessItem.${editingItem?.key}.${field}`] : undefined;

  const saveItem = () => {
    if (!editingItem) return;
    const itemErrors = ['id', 'query', 'weight'].some((field) =>
      entryErrors[`fitnessItem.${editingItem.key}.${field}`],
    );
    if (itemErrors) {
      setShowEntryErrors(true);
      return;
    }
    onChange({
      fitnessItems: isAdding
        ? [...draft.fitnessItems, editingItem]
        : draft.fitnessItems.map((item) => item.key === editingItem.key ? editingItem : item),
    });
    closeEditor();
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
        <Button variant="secondary" onClick={openAdd}>Add fitness item</Button>
      </div>
      {errors.fitnessItems && <p className="krkn-ai-field-error" role="alert">{errors.fitnessItems}</p>}
      <div className="krkn-ai-fitness-table-scroll">
        <table className="krkn-ai-fitness-table">
          <thead>
            <tr>
              <th scope="col">PromQL query</th>
              <th scope="col">Type</th>
              <th scope="col">Weight</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {draft.fitnessItems.map((item) => (
              <tr key={item.key}>
                <td><code className="krkn-ai-fitness-query-summary">{item.query || 'No query entered'}</code></td>
                <td>{item.type}</td>
                <td>{item.weight}</td>
                <td className="krkn-ai-fitness-table-actions">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(item)} aria-label={`Edit fitness item ${item.id}`}>Edit</Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    isDisabled={draft.fitnessItems.length === 1}
                    onClick={() => setPendingRemovalKey(item.key)}
                    aria-label={`Remove fitness item ${item.id}`}
                  >Remove</Button>
                </td>
              </tr>
            ))}
            {!draft.fitnessItems.length && <tr><td colSpan={4}>No fitness items. Add an item to configure a PromQL query.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal
        variant={ModalVariant.medium}
        className="krkn-ai-config-editor-modal"
        title={isAdding ? 'Add fitness item' : 'Edit fitness item'}
        isOpen={editingItem !== null}
        onClose={closeEditor}
        actions={[
          <Button key="save" variant="primary" onClick={saveItem}>Save</Button>,
          <Button key="cancel" variant="link" onClick={closeEditor}>Cancel</Button>,
        ]}
      >
        {editingItem && <div className="krkn-ai-fitness-item-editor">
          <FormGroup label="Item ID" fieldId={`krkn-ai-fitness-item-${editingItem.key}-id`} isRequired>
            <TextInput
              id={`krkn-ai-fitness-item-${editingItem.key}-id`}
              type="number"
              step={1}
              value={editingItem.id}
              onChange={(_event, value) => updateEditingItem({ id: value })}
              validated={fieldError('id') ? 'error' : 'default'}
              aria-label={`Fitness item ${editingItem.key} ID`}
            />
            {fieldError('id') && <p className="krkn-ai-field-error" role="alert">{fieldError('id')}</p>}
          </FormGroup>
          <FormGroup label="Aggregation type" fieldId={`krkn-ai-fitness-item-${editingItem.key}-type`} isRequired>
            <FormSelect
              id={`krkn-ai-fitness-item-${editingItem.key}-type`}
              value={editingItem.type}
              onChange={(_event, value) => updateEditingItem({ type: value as FitnessItemDraft['type'] })}
              aria-label={`Fitness item ${editingItem.key} aggregation type`}
            >
              <FormSelectOption value="range" label="range" />
              <FormSelectOption value="point" label="point" />
            </FormSelect>
          </FormGroup>
          <FormGroup label="Weight (finite, non-negative)" fieldId={`krkn-ai-fitness-item-${editingItem.key}-weight`} isRequired>
            <TextInput
              id={`krkn-ai-fitness-item-${editingItem.key}-weight`}
              type="number"
              min={0}
              step="any"
              value={editingItem.weight}
              onChange={(_event, value) => updateEditingItem({ weight: value })}
              validated={fieldError('weight') ? 'error' : 'default'}
              aria-label={`Fitness item ${editingItem.key} weight`}
            />
            {fieldError('weight') && <p className="krkn-ai-field-error" role="alert">{fieldError('weight')}</p>}
          </FormGroup>
          <FormGroup
            className="krkn-ai-editor-field--wide"
            label="PromQL query"
            fieldId={`krkn-ai-fitness-item-${editingItem.key}-query`}
            isRequired
          >
            <textarea
              id={`krkn-ai-fitness-item-${editingItem.key}-query`}
              className="krkn-ai-fitness-query"
              rows={4}
              value={editingItem.query}
              onChange={(event) => updateEditingItem({ query: event.currentTarget.value })}
              aria-label={`Fitness item ${editingItem.key} query`}
              aria-invalid={!!fieldError('query')}
            />
            {fieldError('query') && <p className="krkn-ai-field-error" role="alert">{fieldError('query')}</p>}
          </FormGroup>
        </div>}
      </Modal>

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
