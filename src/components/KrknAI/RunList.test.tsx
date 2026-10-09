import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import type { KrknAIRunResource } from '../../services/krknAiApi';
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

describe('RunList', () => {
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
  it('disables the compact results download for active runs', () => {
    const resource = makeRun('active-run', 'Running');

    render(
      <RunList
        runs={[{ resource, summary: null, updating: false }]}
        loading={false}
        refreshing={false}
        error={null}
        onCreate={vi.fn()}
        onRefresh={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole('button', { name: 'Download complete results for run active-run' })).toBeDisabled();
  });
  it('confirms run and scenario deletion and recommends downloading results first', async () => {
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
    const deleteButton = screen.getByRole('button', { name: 'Delete Krkn-AI run delete-me' });

    await user.click(deleteButton);
    let dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(/also deletes its scenario executions/)).toBeInTheDocument();
    expect(dialog.getByText(/Download the results ZIP first/)).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(deleteButton);
    dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Delete run' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('delete-me'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
