import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScenarioConfigStep } from './ScenarioConfigStep';
import { operatorApi } from '../../services/operatorApi';
import { elasticsearchApi } from '../../services/elasticsearchApi';
import { cloudCredentialsApi } from '../../services/cloudCredentialsApi';
import type { ScenarioDetail, ScenarioFormValues, TouchedFields } from '../../types/api';

vi.mock('../../services/operatorApi');
vi.mock('../../services/elasticsearchApi');
vi.mock('../../services/cloudCredentialsApi');
vi.mock('../DynamicFormBuilder', () => ({ DynamicFormBuilder: () => null }));
vi.mock('../ScenarioParameterSections', () => ({ ScenarioParameterSections: () => null }));

const makeDetail = (name: string, digest = 'sha256:abc'): ScenarioDetail => ({
  name,
  title: `${name} title`,
  description: 'desc',
  digest,
  fields: [
    {
      name: 'namespace',
      variable: 'NAMESPACE',
      short_description: 'ns',
      title: 'Namespace',
      description: 'ns',
      type: 'string',
      required: true,
      default: 'default-ns',
    },
  ],
});

function renderStep(scenarioName: string, registryName = '', overrides: Partial<{
  onLoadStatusChange: (status: 'loading' | 'loaded' | 'error') => void;
  onDefaultValuesLoad: (defaults: ScenarioFormValues) => void;
  sessionId: number;
  expectedDigest: string;
}> = {}) {
  return render(
    <ScenarioConfigStep
      scenarioName={scenarioName}
      registryName={registryName}
      formValues={{}}
      globalFormValues={{}}
      globalTouchedFields={{} as TouchedFields}
      onFormChange={vi.fn()}
      onGlobalFormChange={vi.fn()}
      onDefaultValuesLoad={overrides.onDefaultValuesLoad ?? vi.fn()}
      onLoadStatusChange={overrides.onLoadStatusChange ?? vi.fn()}
      sessionId={overrides.sessionId ?? 1}
      expectedDigest={overrides.expectedDigest}
    />,
  );
}

describe('ScenarioConfigStep caching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(elasticsearchApi.listConfigs).mockResolvedValue([]);
    vi.mocked(cloudCredentialsApi.listAvailable).mockResolvedValue([]);
    vi.mocked(operatorApi.getScenarioDetail).mockImplementation(
      async (name: string) => makeDetail(name),
    );
  });

  it('fetches scenario detail on first mount and reports loaded with defaults', async () => {
    const onLoadStatusChange = vi.fn();
    const onDefaultValuesLoad = vi.fn();
    renderStep('fetch-once', '', { onLoadStatusChange, onDefaultValuesLoad });

    await waitFor(() =>
      expect(screen.getByText('fetch-once title')).toBeInTheDocument(),
    );
    expect(operatorApi.getScenarioDetail).toHaveBeenCalledTimes(1);
    expect(onLoadStatusChange).toHaveBeenCalledWith('loaded');
    expect(onDefaultValuesLoad).toHaveBeenCalledWith({ NAMESPACE: 'default-ns' });
  });

  it('does not refetch when remounting with the same scenario and registry', async () => {
    const { unmount } = renderStep('cache-hit', 'corp-registry');
    await waitFor(() =>
      expect(screen.getByText('cache-hit title')).toBeInTheDocument(),
    );
    expect(operatorApi.getScenarioDetail).toHaveBeenCalledTimes(1);
    unmount();

    // Remount simulates returning to the configuration step via the wizard.
    const onLoadStatusChange = vi.fn();
    renderStep('cache-hit', 'corp-registry', { onLoadStatusChange });
    await waitFor(() =>
      expect(screen.getByText('cache-hit title')).toBeInTheDocument(),
    );

    // Still one call — restored from cache, no network.
    expect(operatorApi.getScenarioDetail).toHaveBeenCalledTimes(1);
    expect(onLoadStatusChange).toHaveBeenCalledWith('loaded');
  });

  it('refetches when the scenario changes', async () => {
    const { unmount } = renderStep('scenario-a');
    await waitFor(() =>
      expect(screen.getByText('scenario-a title')).toBeInTheDocument(),
    );
    unmount();

    renderStep('scenario-b');
    await waitFor(() =>
      expect(screen.getByText('scenario-b title')).toBeInTheDocument(),
    );

    expect(operatorApi.getScenarioDetail).toHaveBeenCalledTimes(2);
  });

  it('reuses the cache across sessions when the digest matches', async () => {
    vi.mocked(operatorApi.getScenarioDetail).mockResolvedValue(
      makeDetail('digest-match', 'sha256:v1'),
    );

    const first = renderStep('digest-match', 'corp-registry', {
      sessionId: 1,
      expectedDigest: 'sha256:v1',
    });
    await waitFor(() =>
      expect(screen.getByText('digest-match title')).toBeInTheDocument(),
    );
    expect(operatorApi.getScenarioDetail).toHaveBeenCalledTimes(1);
    first.unmount();

    // New session, same digest -> reuse without refetch.
    renderStep('digest-match', 'corp-registry', {
      sessionId: 2,
      expectedDigest: 'sha256:v1',
    });
    await waitFor(() =>
      expect(screen.getByText('digest-match title')).toBeInTheDocument(),
    );
    expect(operatorApi.getScenarioDetail).toHaveBeenCalledTimes(1);
  });

  it('refetches across sessions when the digest changed', async () => {
    vi.mocked(operatorApi.getScenarioDetail)
      .mockResolvedValueOnce(makeDetail('digest-change', 'sha256:old'))
      .mockResolvedValueOnce(makeDetail('digest-change', 'sha256:new'));

    const first = renderStep('digest-change', 'corp-registry', {
      sessionId: 1,
      expectedDigest: 'sha256:old',
    });
    await waitFor(() =>
      expect(screen.getByText('digest-change title')).toBeInTheDocument(),
    );
    expect(operatorApi.getScenarioDetail).toHaveBeenCalledTimes(1);
    first.unmount();

    // New session, image re-pushed -> digest differs -> refetch.
    renderStep('digest-change', 'corp-registry', {
      sessionId: 2,
      expectedDigest: 'sha256:new',
    });
    await waitFor(() =>
      expect(operatorApi.getScenarioDetail).toHaveBeenCalledTimes(2),
    );
  });

  it('refetches across sessions when no digest is available', async () => {
    const first = renderStep('no-digest', 'corp-registry', { sessionId: 1 });
    await waitFor(() =>
      expect(screen.getByText('no-digest title')).toBeInTheDocument(),
    );
    expect(operatorApi.getScenarioDetail).toHaveBeenCalledTimes(1);
    first.unmount();

    // New session, no digest to validate against -> refetch, no stale reuse.
    renderStep('no-digest', 'corp-registry', { sessionId: 2 });
    await waitFor(() =>
      expect(operatorApi.getScenarioDetail).toHaveBeenCalledTimes(2),
    );
  });
});
