import { useState } from 'react';
import {
  Button,
  Checkbox,
  FormGroup,
  Modal,
  ModalVariant,
  TextInput,
} from '@patternfly/react-core';
import type { ConfigValidationErrors, EditableConfigDraft, HealthCheckDraft } from './configModel';
import { validateConfigDraft } from './configModel';
import './HealthChecksEditor.css';

interface HealthChecksEditorProps {
  draft: EditableConfigDraft;
  errors: ConfigValidationErrors;
  onChange: (updates: Partial<EditableConfigDraft>) => void;
}

const createHealthCheck = (key: number): HealthCheckDraft => ({
  key,
  name: `application-${key}`,
  url: '',
  statusCode: '200',
  timeout: '4',
  interval: '2',
});

export function HealthChecksEditor({ draft, errors, onChange }: HealthChecksEditorProps) {
  const [pendingRemovalKey, setPendingRemovalKey] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingHealthCheck, setEditingHealthCheck] = useState<HealthCheckDraft | null>(null);

  const editHealthCheck = (check: HealthCheckDraft) => {
    setEditingHealthCheck({ ...check });
    setIsAdding(false);
  };

  const addHealthCheck = () => {
    const nextKey = draft.healthChecks.reduce((maximum, check) => Math.max(maximum, check.key), -1) + 1;
    setEditingHealthCheck(createHealthCheck(nextKey));
    setIsAdding(true);
  };

  const closeHealthCheckEditor = () => {
    setEditingHealthCheck(null);
    setIsAdding(false);
  };


  const confirmRemoval = () => {
    if (pendingRemovalKey !== null) {
      onChange({ healthChecks: draft.healthChecks.filter((check) => check.key !== pendingRemovalKey) });
    }
    setPendingRemovalKey(null);
  };

  const pendingRemovalCheck = draft.healthChecks.find((check) => check.key === pendingRemovalKey);
  const entryErrors = editingHealthCheck
    ? validateConfigDraft({ ...draft, healthChecks: [editingHealthCheck] })
    : {};
  const itemErrorPrefix = editingHealthCheck ? `healthCheck.${editingHealthCheck.key}.` : '';
  const hasEntryErrors = Object.keys(entryErrors).some((field) => field.startsWith(itemErrorPrefix));
  const saveHealthCheck = () => {
    if (!editingHealthCheck || hasEntryErrors) return;
    const exists = draft.healthChecks.some((check) => check.key === editingHealthCheck.key);
    if (!isAdding && !exists) {
      closeHealthCheckEditor();
      return;
    }
    onChange({
      healthChecks: isAdding
        ? [...draft.healthChecks, editingHealthCheck]
        : draft.healthChecks.map((check) => check.key === editingHealthCheck.key ? editingHealthCheck : check),
    });
    closeHealthCheckEditor();
  };

  return (
    <div className="krkn-ai-health-check-editor">
      <p className="krkn-ai-muted">Health checks request these URLs during the run. Use only endpoints that are safe to contact from the operator environment.</p>
      <div className="krkn-ai-health-check-options">
        <Checkbox
          id="krkn-ai-stop-watcher-on-failure"
          label="Stop the health-check watcher on failure"
          isChecked={draft.stopWatcherOnFailure}
          onChange={(_event, checked) => onChange({ stopWatcherOnFailure: checked })}
        />
        <FormGroup label="Stop timeout (seconds)" fieldId="krkn-ai-health-check-stop-timeout">
          <TextInput
            id="krkn-ai-health-check-stop-timeout"
            type="number"
            min={0}
            step="any"
            value={draft.stopTimeout}
            onChange={(_event, value) => onChange({ stopTimeout: value })}
            validated={errors.stopTimeout ? 'error' : 'default'}
            aria-label="Health-check stop timeout"
          />
          {errors.stopTimeout && <p className="krkn-ai-field-error" role="alert">{errors.stopTimeout}</p>}
        </FormGroup>
      </div>

      <div className="krkn-ai-editor-heading">
        <div>
          <h3>Health checks</h3>
          <p className="krkn-ai-muted">Configure the endpoint, expected status, and polling timing for each check.</p>
        </div>
        <Button variant="secondary" onClick={addHealthCheck}>Add health check</Button>
      </div>
      {draft.healthChecks.length === 0 ? (
        <p className="krkn-ai-muted">No health checks are configured. Add a real endpoint if this run needs availability monitoring.</p>
      ) : (
        <div className="krkn-ai-health-check-table-wrap">
          <table className="krkn-ai-health-check-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">URL</th>
                <th scope="col">Expected status</th>
                <th scope="col">Timeout (seconds)</th>
                <th scope="col">Interval (seconds)</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {draft.healthChecks.map((check) => (
                <tr key={check.key}>
                  <th scope="row">{check.name || 'Unnamed check'}</th>
                  <td title={check.url || undefined}>{check.url || 'URL required'}</td>
                  <td>{check.statusCode}</td>
                  <td>{check.timeout}</td>
                  <td>{check.interval}</td>
                  <td className="krkn-ai-health-check-table__actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => editHealthCheck(check)}
                      aria-label={`Edit health check ${check.name}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPendingRemovalKey(check.key)}
                      aria-label={`Remove health check ${check.name}`}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        variant={ModalVariant.medium}
        className="krkn-ai-config-editor-modal"
        title={isAdding ? 'Add health check' : 'Edit health check'}
        isOpen={editingHealthCheck !== null}
        onClose={closeHealthCheckEditor}
        actions={[
          <Button key="save" variant="primary" onClick={saveHealthCheck} isDisabled={hasEntryErrors}>
            Save
          </Button>,
          <Button key="cancel" variant="link" onClick={closeHealthCheckEditor}>
            Cancel
          </Button>,
        ]}
      >
        {editingHealthCheck && (() => {
          const check = editingHealthCheck;
          const itemKey = `healthCheck.${check.key}`;
          return (
            <div className="krkn-ai-health-check-modal-fields">
              <FormGroup label="Application name" fieldId={`krkn-ai-health-check-${check.key}-name`} isRequired>
                <TextInput
                  id={`krkn-ai-health-check-${check.key}-name`}
                  value={check.name}
                  onChange={(_event, value) => setEditingHealthCheck({ ...check, name: value })}
                  validated={entryErrors[`${itemKey}.name`] ? 'error' : 'default'}
                  aria-label={`Health check ${check.key} name`}
                />
                {entryErrors[`${itemKey}.name`] && <p className="krkn-ai-field-error" role="alert">{entryErrors[`${itemKey}.name`]}</p>}
              </FormGroup>
              <FormGroup
                className="krkn-ai-editor-field--wide"
                label="Complete health-check URL"
                fieldId={`krkn-ai-health-check-${check.key}-url`}
                isRequired
              >
                <TextInput
                  id={`krkn-ai-health-check-${check.key}-url`}
                  type="url"
                  value={check.url}
                  onChange={(_event, value) => setEditingHealthCheck({ ...check, url: value })}
                  validated={entryErrors[`${itemKey}.url`] ? 'error' : 'default'}
                  aria-label={`Health check ${check.key} URL`}
                />
                {entryErrors[`${itemKey}.url`] && <p className="krkn-ai-field-error" role="alert">{entryErrors[`${itemKey}.url`]}</p>}
              </FormGroup>
              <FormGroup label="Expected status code" fieldId={`krkn-ai-health-check-${check.key}-status`} isRequired>
                <TextInput
                  id={`krkn-ai-health-check-${check.key}-status`}
                  type="number"
                  step={1}
                  value={check.statusCode}
                  onChange={(_event, value) => setEditingHealthCheck({ ...check, statusCode: value })}
                  validated={entryErrors[`${itemKey}.statusCode`] ? 'error' : 'default'}
                  aria-label={`Health check ${check.key} expected status code`}
                />
                {entryErrors[`${itemKey}.statusCode`] && <p className="krkn-ai-field-error" role="alert">{entryErrors[`${itemKey}.statusCode`]}</p>}
              </FormGroup>
              <FormGroup label="Timeout (seconds)" fieldId={`krkn-ai-health-check-${check.key}-timeout`} isRequired>
                <TextInput
                  id={`krkn-ai-health-check-${check.key}-timeout`}
                  type="number"
                  step={1}
                  value={check.timeout}
                  onChange={(_event, value) => setEditingHealthCheck({ ...check, timeout: value })}
                  validated={entryErrors[`${itemKey}.timeout`] ? 'error' : 'default'}
                  aria-label={`Health check ${check.key} timeout`}
                />
                {entryErrors[`${itemKey}.timeout`] && <p className="krkn-ai-field-error" role="alert">{entryErrors[`${itemKey}.timeout`]}</p>}
              </FormGroup>
              <FormGroup label="Interval (seconds)" fieldId={`krkn-ai-health-check-${check.key}-interval`} isRequired>
                <TextInput
                  id={`krkn-ai-health-check-${check.key}-interval`}
                  type="number"
                  step={1}
                  value={check.interval}
                  onChange={(_event, value) => setEditingHealthCheck({ ...check, interval: value })}
                  validated={entryErrors[`${itemKey}.interval`] ? 'error' : 'default'}
                  aria-label={`Health check ${check.key} interval`}
                />
                {entryErrors[`${itemKey}.interval`] && <p className="krkn-ai-field-error" role="alert">{entryErrors[`${itemKey}.interval`]}</p>}
              </FormGroup>
            </div>
          );
        })()}
      </Modal>

      <Modal
        variant={ModalVariant.small}
        title="Remove health check?"
        isOpen={pendingRemovalKey !== null}
        onClose={() => setPendingRemovalKey(null)}
        actions={[
          <Button key="remove" variant="danger" onClick={confirmRemoval} isDisabled={!pendingRemovalCheck}>
            Remove
          </Button>,
          <Button key="cancel" variant="link" onClick={() => setPendingRemovalKey(null)}>
            Cancel
          </Button>,
        ]}
      >
        <p>
          {pendingRemovalCheck
            ? <>Remove health check <strong>{pendingRemovalCheck.name || 'Unnamed check'}</strong>?</>
            : 'This health check is no longer available.'}
        </p>
      </Modal>
    </div>
  );
}
