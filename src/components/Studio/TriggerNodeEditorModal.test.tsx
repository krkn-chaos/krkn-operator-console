import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { StudioNode } from '../../types/api';
import { operatorApi } from '../../services/operatorApi';
import { StudioProvider } from './StudioContext';
import { TriggerNodeEditorModal } from './TriggerNodeEditorModal';

vi.mock('../../services/operatorApi', () => ({
  operatorApi: {
    getScenarioDetail: vi.fn(),
  },
}));

vi.mock('../DynamicFormBuilder', () => ({
  DynamicFormBuilder: ({
    fields,
    values,
    onChange,
  }: {
    fields: Array<{ variable: string }>;
    values: Record<string, string | number | boolean>;
    onChange?: (values: Record<string, string | number | boolean>) => void;
  }) => (
    <div>
      {fields.map(field => (
        <label key={field.variable}>
          {field.variable}
          <input
            aria-label={field.variable}
            value={String(values[field.variable] ?? '')}
            onChange={event => onChange?.({ ...values, [field.variable]: event.target.value })}
          />
        </label>
      ))}
    </div>
  ),
}));

const triggerFields = [
  { name: 'Command', short_description: '', description: '', variable: 'TRIGGER_COMMAND', type: 'string' },
  { name: 'Expected return code', short_description: '', description: '', variable: 'TRIGGER_EXPECTED_RC', type: 'number' },
  { name: 'HTTP URL', short_description: '', description: '', variable: 'TRIGGER_HTTP_URL', type: 'string' },
  { name: 'HTTP method', short_description: '', description: '', variable: 'TRIGGER_HTTP_METHOD', type: 'string' },
  { name: 'Kubernetes API version', short_description: '', description: '', variable: 'TRIGGER_K8S_API_VERSION', type: 'string' },
  { name: 'Kubernetes kind', short_description: '', description: '', variable: 'TRIGGER_K8S_KIND', type: 'string' },
  { name: 'Kubernetes name', short_description: '', description: '', variable: 'TRIGGER_K8S_NAME', type: 'string' },
  { name: 'Prometheus query', short_description: '', description: '', variable: 'TRIGGER_PROM_QUERY', type: 'string' },
  { name: 'Prometheus URL', short_description: '', description: '', variable: 'TRIGGER_PROM_URL', type: 'string' },
  { name: 'Trigger mode', short_description: '', description: '', variable: 'TRIGGERS_MODE', type: 'enum', allowed_values: 'all_of,any_of', separator: ',' },
  { name: 'Trigger timeout', short_description: '', description: '', variable: 'TRIGGERS_TIMEOUT', type: 'number' },
  { name: 'Trigger interval', short_description: '', description: '', variable: 'TRIGGERS_INTERVAL', type: 'number' },
  { name: 'Timeout behavior', short_description: '', description: '', variable: 'TRIGGERS_ON_TIMEOUT', type: 'enum', allowed_values: 'fail,run_anyway,skip', separator: ',' },
];

function makeTriggerNode(scenarioFormValues: Record<string, string | number | boolean> = {}): StudioNode {
  return {
    nodeId: 'wait-node',
    nodeType: 'trigger',
    status: 'unconfigured',
    position: { x: 100, y: 200 },
    config: {
      nodeType: 'trigger',
      registryType: 'public',
      registryConfig: {},
      scenarioName: 'trigger',
      scenarioImage: 'quay.io/krkn-chaos/krkn-hub:trigger',
      scenarioFormValues,
    },
  };
}

function renderModal(node = makeTriggerNode(), onSave = vi.fn()) {
  const wrapper = ({ children }: { children: ReactNode }) => <StudioProvider>{children}</StudioProvider>;
  render(
    <TriggerNodeEditorModal isOpen node={node} onClose={vi.fn()} onSave={onSave} />,
    { wrapper }
  );
  return onSave;
}

describe('TriggerNodeEditorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(operatorApi.getScenarioDetail).mockResolvedValue({ fields: triggerFields } as never);
  });

  it('loads the trigger image schema and saves its flat environment variables', async () => {
    const onSave = renderModal();

    await waitFor(() => expect(screen.getByLabelText('TRIGGER_COMMAND')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('TRIGGER_COMMAND'), {
      target: { value: 'kubectl get pods' },
    });
    fireEvent.change(screen.getByLabelText('TRIGGERS_MODE'), {
      target: { value: 'any_of' },
    });

    fireEvent.click(screen.getByText('Add trigger condition'));
    const triggerTypes = screen.getAllByLabelText('TRIGGER_TYPE');
    fireEvent.change(triggerTypes[1], { target: { value: 'http' } });
    fireEvent.change(await screen.findByLabelText('TRIGGER_HTTP_URL'), {
      target: { value: 'https://service.example/health' },
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const updates = vi.mocked(onSave).mock.calls[0][1];
    expect(updates.nodeType).toBe('trigger');
    expect(updates.config?.scenarioFormValues).toMatchObject({ TRIGGERS_MODE: 'any_of' });
    expect(updates.config?.scenarioFormValues).toMatchObject({
      TRIGGER_COMMAND: 'kubectl get pods',
      TRIGGER_HTTP_URL: 'https://service.example/health',
      TRIGGERS_MODE: 'any_of',
    });
    expect(updates.config?.scenarioFormValues).not.toHaveProperty('TRIGGERS_CONDITIONS_JSON');
    expect(operatorApi.getScenarioDetail).toHaveBeenCalledWith('trigger', {});
  });

  it('restores legacy flat trigger fields and saves image environment variables', async () => {
    const onSave = renderModal(makeTriggerNode({
      TRIGGER_TYPE: 'http',
      TRIGGER_HTTP_URL: 'https://legacy.example/health',
      TRIGGER_HTTP_METHOD: 'POST',
      TRIGGER_HTTP_EXPECTED_STATUS: '202',
    }));

    const url = await screen.findByLabelText('TRIGGER_HTTP_URL') as HTMLInputElement;
    expect(url.value).toBe('https://legacy.example/health');
    expect((screen.getByLabelText('TRIGGER_TYPE') as HTMLInputElement).value).toBe('http');

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const updates = vi.mocked(onSave).mock.calls[0][1];
    expect(updates.config?.scenarioFormValues).toMatchObject({
      TRIGGER_HTTP_URL: 'https://legacy.example/health',
      TRIGGER_HTTP_METHOD: 'POST',
    });
  });

  it('restores serialized conditions through condition config conversion', async () => {
    const serialized = JSON.stringify([
      { type: 'http', url: 'https://service.example/health', method: 'GET' },
    ]);
    const onSave = renderModal(makeTriggerNode({ TRIGGERS_CONDITIONS_JSON: serialized }));

    expect((await screen.findByLabelText('TRIGGER_HTTP_URL') as HTMLInputElement).value)
      .toBe('https://service.example/health');
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const updates = vi.mocked(onSave).mock.calls[0][1];
    expect(updates.config?.scenarioFormValues).toMatchObject({
      TRIGGER_HTTP_URL: 'https://service.example/health',
      TRIGGER_HTTP_METHOD: 'GET',
    });
  });

  it('allocates a fresh ID after unsupported serialized conditions are filtered out', async () => {
    const serialized = JSON.stringify([
      { type: 'unsupported', unknown: 'value' },
      { type: 'http', url: 'https://service.example/health' },
    ]);
    renderModal(makeTriggerNode({ TRIGGERS_CONDITIONS_JSON: serialized }));

    expect((await screen.findByLabelText('TRIGGER_HTTP_URL') as HTMLInputElement).value)
      .toBe('https://service.example/health');
    fireEvent.click(screen.getByText('Add trigger condition'));

    const triggerTypes = screen.getAllByLabelText('TRIGGER_TYPE');
    fireEvent.change(triggerTypes[1], { target: { value: 'prometheus' } });

    expect(await screen.findByLabelText('TRIGGER_PROM_QUERY')).toBeInTheDocument();
    expect((screen.getByLabelText('TRIGGER_HTTP_URL') as HTMLInputElement).value)
      .toBe('https://service.example/health');
  });

  it('rejects saving when a condition is missing required fields', async () => {
    const onSave = renderModal();

    await waitFor(() => expect(screen.getByText('Save')).toBeEnabled());
    fireEvent.click(screen.getByText('Save'));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Configure the required condition field for every trigger.'))
      .toBeInTheDocument();
  });
});
