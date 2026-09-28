import {
  Button,
  Checkbox,
  FormGroup,
  TextInput,
} from '@patternfly/react-core';
import type { ConfigValidationErrors, EditableConfigDraft, HealthCheckDraft } from './configModel';

interface HealthChecksEditorProps {
  draft: EditableConfigDraft;
  errors: ConfigValidationErrors;
  onChange: (updates: Partial<EditableConfigDraft>) => void;
}

export function HealthChecksEditor({ draft, errors, onChange }: HealthChecksEditorProps) {
  const updateHealthCheck = (key: number, updates: Partial<HealthCheckDraft>) => {
    onChange({
      healthChecks: draft.healthChecks.map((check) => check.key === key ? { ...check, ...updates } : check),
    });
  };

  const addHealthCheck = () => {
    const nextKey = draft.healthChecks.reduce((maximum, check) => Math.max(maximum, check.key), -1) + 1;
    onChange({
      healthChecks: [...draft.healthChecks, {
        key: nextKey,
        name: `application-${nextKey}`,
        url: '',
        statusCode: '200',
        timeout: '4',
        interval: '2',
      }],
    });
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

      {draft.healthChecks.length === 0 ? (
        <p className="krkn-ai-muted">No health checks are configured. Add a real endpoint if this run needs availability monitoring.</p>
      ) : (
        <div className="krkn-ai-health-check-list">
          {draft.healthChecks.map((check) => {
            const itemKey = `healthCheck.${check.key}`;
            return (
              <details key={check.key} className="krkn-ai-health-check-item">
                <summary>
                  <strong>{check.name || 'Unnamed check'}</strong> · {check.url || 'URL required'}
                </summary>
                <div className="krkn-ai-health-check-fields">
                  <FormGroup label="Application name" fieldId={`krkn-ai-health-check-${check.key}-name`} isRequired>
                    <TextInput
                      id={`krkn-ai-health-check-${check.key}-name`}
                      value={check.name}
                      onChange={(_event, value) => updateHealthCheck(check.key, { name: value })}
                      validated={errors[`${itemKey}.name`] ? 'error' : 'default'}
                      aria-label={`Health check ${check.key} name`}
                    />
                    {errors[`${itemKey}.name`] && <p className="krkn-ai-field-error" role="alert">{errors[`${itemKey}.name`]}</p>}
                  </FormGroup>
                  <FormGroup label="Complete health-check URL" fieldId={`krkn-ai-health-check-${check.key}-url`} isRequired>
                    <TextInput
                      id={`krkn-ai-health-check-${check.key}-url`}
                      type="url"
                      value={check.url}
                      onChange={(_event, value) => updateHealthCheck(check.key, { url: value })}
                      validated={errors[`${itemKey}.url`] ? 'error' : 'default'}
                      aria-label={`Health check ${check.key} URL`}
                    />
                    {errors[`${itemKey}.url`] && <p className="krkn-ai-field-error" role="alert">{errors[`${itemKey}.url`]}</p>}
                  </FormGroup>
                  <FormGroup label="Expected status code" fieldId={`krkn-ai-health-check-${check.key}-status`} isRequired>
                    <TextInput
                      id={`krkn-ai-health-check-${check.key}-status`}
                      type="number"
                      step={1}
                      value={check.statusCode}
                      onChange={(_event, value) => updateHealthCheck(check.key, { statusCode: value })}
                      validated={errors[`${itemKey}.statusCode`] ? 'error' : 'default'}
                      aria-label={`Health check ${check.key} expected status code`}
                    />
                    {errors[`${itemKey}.statusCode`] && <p className="krkn-ai-field-error" role="alert">{errors[`${itemKey}.statusCode`]}</p>}
                  </FormGroup>
                  <FormGroup label="Timeout (seconds)" fieldId={`krkn-ai-health-check-${check.key}-timeout`} isRequired>
                    <TextInput
                      id={`krkn-ai-health-check-${check.key}-timeout`}
                      type="number"
                      step={1}
                      value={check.timeout}
                      onChange={(_event, value) => updateHealthCheck(check.key, { timeout: value })}
                      validated={errors[`${itemKey}.timeout`] ? 'error' : 'default'}
                      aria-label={`Health check ${check.key} timeout`}
                    />
                    {errors[`${itemKey}.timeout`] && <p className="krkn-ai-field-error" role="alert">{errors[`${itemKey}.timeout`]}</p>}
                  </FormGroup>
                  <FormGroup label="Interval (seconds)" fieldId={`krkn-ai-health-check-${check.key}-interval`} isRequired>
                    <TextInput
                      id={`krkn-ai-health-check-${check.key}-interval`}
                      type="number"
                      step={1}
                      value={check.interval}
                      onChange={(_event, value) => updateHealthCheck(check.key, { interval: value })}
                      validated={errors[`${itemKey}.interval`] ? 'error' : 'default'}
                      aria-label={`Health check ${check.key} interval`}
                    />
                    {errors[`${itemKey}.interval`] && <p className="krkn-ai-field-error" role="alert">{errors[`${itemKey}.interval`]}</p>}
                  </FormGroup>
                  <Button
                    variant="secondary"
                    onClick={() => onChange({ healthChecks: draft.healthChecks.filter((candidate) => candidate.key !== check.key) })}
                    aria-label={`Remove health check ${check.name}`}
                  >
                    Remove health check
                  </Button>
                </div>
              </details>
            );
          })}
        </div>
      )}
      <Button variant="secondary" onClick={addHealthCheck}>Add health check</Button>
    </div>
  );
}
