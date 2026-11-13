import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { krknAiApi } from '../../services/krknAiApi';
import type { KrknAIRunResource, KrknAIRunSummary } from '../../services/krknAiApi';
import { RunList } from './RunList';

function makeRun(name: string, phase: string): KrknAIRunResource {
  return {
    apiVersion: 'krkn.dev/v1alpha1',
    kind: 'KrknAIRun',
    metadata: { name, uid: `${name}-uid`, creationTimestamp: '2026-10-07T10:00:00Z' },
    spec: { targetRequestId: 'target-request', targetClusters: { 'krkn-operator': ['staging'] } },
    status: { phase },
  };
}

function makeSummary(run: KrknAIRunResource): KrknAIRunSummary {
  return {
    name: run.metadata.name,
    phase: run.status.phase ?? 'Succeeded',
    createdAt: run.metadata.creationTimestamp,
    cluster: 'staging',
    orchestratorPodName: '',
    failureReason: '',
    artifactStatus: 'succeeded',
    resultsCompleteness: 'complete',
    currentGeneration: null,
    completedGenerations: 1,
    completedScenarios: 1,
    configuredGenerations: 1,
    populationSize: 1,
    bestFitness: 1,
    averageFitness: 1,
    baselineFitness: 1,
    fitnessProgression: [],
  };
}

describe('RunList', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps the table visible and shows a creation empty state when no runs exist', () => {
    render(
      <RunList
        runs={[]}
        loading={false}
        refreshing={false}
        error={null}
        onCreate={vi.fn()}
        onRefresh={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByRole('heading', { name: 'AI runs', level: 1 })).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Krkn-AI runs' });
    expect(within(table).getByRole('columnheader', { name: 'Run' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.getByText('Krkn-AI explores chaos experiments guided by your SLOs and health checks to evaluate system resilience.')).toBeInTheDocument();

    const header = screen.getByRole('heading', { name: 'AI runs' }).closest('.krkn-ai-run-list__heading');
    expect(header).toBeTruthy();
    expect(header).toContainElement(screen.getByText(/Krkn-AI explores chaos experiments/));
    expect(header).toContainElement(screen.getByRole('button', { name: 'Refresh' }));
    expect(header).toContainElement(screen.getByRole('button', { name: 'Create run' }));

    const emptyRow = within(table).getAllByRole('row')[1];
    expect(within(emptyRow).getByRole('heading', { name: 'No Krkn-AI runs yet' })).toBeInTheDocument();
    expect(within(emptyRow).getByText('Use Create run above to explore a cluster.')).toBeInTheDocument();
    expect(emptyRow.querySelector('td')).toHaveAttribute('colspan', '8');
  });
  it('hides active-run downloads and opens the selected run only through View', async () => {
    const user = userEvent.setup();
    const resource = makeRun('active-run', 'Running');
    const summary = { ...makeSummary(resource), artifactStatus: 'in_progress' as const, resultsCompleteness: 'partial' as const };
    const onSelect = vi.fn();
    const onCancel = vi.fn().mockResolvedValue(undefined);

    render(
      <RunList
        runs={[{ resource, summary, updating: false }]}
        loading={false}
        refreshing={false}
        error={null}
        onCreate={vi.fn()}
        onRefresh={vi.fn()}
        onSelect={onSelect}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Actions for run active-run' }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('menuitem', { name: 'Download' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Cancel' })).toBeEnabled();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeEnabled();
    await user.click(screen.getByRole('menuitem', { name: 'View' }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(resource);
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
  it('requires confirmation before deleting a run and discards a cancelled deletion', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <RunList
        runs={[{ resource: makeRun('delete-me', 'Succeeded'), summary: null, updating: false }]}
        loading={false}
        refreshing={false}
        error={null}
        onCreate={vi.fn()}
        onRefresh={vi.fn()}
        onSelect={vi.fn()}
        onDelete={onDelete}
      />,
    );
    const toggle = screen.getByRole('button', { name: 'Actions for run delete-me' });

    await user.click(toggle);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    let dialog = within(screen.getByRole('dialog'));
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(toggle);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Delete run' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('delete-me'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirms cancellation separately from destructive deletion', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <RunList
        runs={[{ resource: makeRun('cancel-me', 'Running'), summary: null, updating: false }]}
        loading={false}
        refreshing={false}
        error={null}
        onCreate={vi.fn()}
        onRefresh={vi.fn()}
        onSelect={vi.fn()}
        onDelete={onDelete}
        onCancel={onCancel}
      />,
    );

    const toggle = screen.getByRole('button', { name: 'Actions for run cancel-me' });
    await user.click(toggle);
    await user.click(screen.getByRole('menuitem', { name: 'Cancel' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Cancel Krkn-AI run?' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(dialog.getByRole('button', { name: 'Cancel run' }));

    await waitFor(() => expect(onCancel).toHaveBeenCalledWith('cancel-me'));
  });

  it('updates disabled actions when cancellation is requested and partial results become available', async () => {
    const user = userEvent.setup();
    const resource = makeRun('changing-run', 'Running');
    const props = {
      loading: false,
      refreshing: false,
      error: null,
      onCreate: vi.fn(),
      onRefresh: vi.fn(),
      onSelect: vi.fn(),
      onDelete: vi.fn().mockResolvedValue(undefined),
      onCancel: vi.fn().mockResolvedValue(undefined),
    };
    const { rerender } = render(<RunList {...props} runs={[{ resource, summary: null, updating: false }]} />);
    await user.click(screen.getByRole('button', { name: 'Actions for run changing-run' }));
    expect(screen.getByRole('menuitem', { name: 'Cancel' })).toBeEnabled();

    const requested = { ...resource, spec: { ...resource.spec, cancelRequested: true } };
    rerender(<RunList {...props} runs={[{ resource: requested, summary: null, updating: false }]} />);
    const cancel = screen.getByRole('menuitem', { name: 'Cancel' });
    expect(cancel).toBeDisabled();
    await user.click(cancel);
    expect(props.onCancel).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const stopped = { ...requested, status: { phase: 'Cancelled' } };
    const summary = { ...makeSummary(stopped), artifactStatus: 'cancelled' as const, resultsCompleteness: 'partial' as const };
    rerender(<RunList {...props} runs={[{ resource: stopped, summary, updating: false }]} />);
    expect(screen.getByRole('menuitem', { name: 'Download' })).toBeEnabled();
    expect(screen.getByRole('menuitem', { name: 'Cancel' })).toBeDisabled();
  });

  it('preserves download progress and errors after the menu closes without selecting the run', async () => {
    const user = userEvent.setup();
    const resource = makeRun('download-run', 'Succeeded');
    const onSelect = vi.fn();
    // CI runs Node 20, which has no Promise.withResolvers().
    let rejectDownload!: (error: Error) => void;
    const promise = new Promise<Blob>((_resolve, reject) => { rejectDownload = reject; });
    const download = vi.spyOn(krknAiApi, 'downloadResults').mockReturnValueOnce(promise);
    render(
      <RunList
        runs={[{ resource, summary: makeSummary(resource), updating: false }]}
        loading={false}
        refreshing={false}
        error={null}
        onCreate={vi.fn()}
        onRefresh={vi.fn()}
        onSelect={onSelect}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    const toggle = screen.getByRole('button', { name: 'Actions for run download-run' });
    await user.click(toggle);
    await user.click(screen.getByRole('menuitem', { name: 'Download' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();

    await user.click(toggle);
    const downloading = screen.getByRole('menuitem', { name: /Download/ });
    expect(downloading).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeDisabled();
    fireEvent.click(downloading);
    expect(download).toHaveBeenCalledTimes(1);
    await user.click(toggle);
    await act(async () => rejectDownload(new Error('Archive service unavailable')));
    expect(await screen.findByText('Archive service unavailable')).toBeVisible();
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(toggle);
    expect(screen.getByRole('menuitem', { name: 'Download' })).toBeEnabled();
  });
});
