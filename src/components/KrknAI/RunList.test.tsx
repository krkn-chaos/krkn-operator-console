import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { KrknAIRunResource } from '../../services/krknAiApi';
import { RunList } from './RunList';

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
      />,
    );
    expect(screen.getByRole('heading', { name: 'AI runs', level: 1 })).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Krkn-AI runs' });
    expect(within(table).getByRole('columnheader', { name: 'Run' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.getByText('Krkn-AI explores chaos experiments guided by your SLOs and health checks to evaluate system resilience.')).toBeInTheDocument();

    const emptyRow = within(table).getAllByRole('row')[1];
    expect(within(emptyRow).getByRole('heading', { name: 'No Krkn-AI runs yet' })).toBeInTheDocument();
    expect(within(emptyRow).getByText('Use Create run above to explore a cluster.')).toBeInTheDocument();
    expect(emptyRow.querySelector('td')).toHaveAttribute('colspan', '8');
  });
  it('disables the compact results download for active runs', () => {
    const resource: KrknAIRunResource = {
      metadata: {
        name: 'active-run',
        uid: 'active-run-uid',
        creationTimestamp: '2026-10-07T10:00:00Z',
      },
      spec: {
        targetRequestId: 'target-request',
        targetClusters: { 'krkn-operator': ['staging'] },
      },
      status: { phase: 'Running' },
    };

    render(
      <RunList
        runs={[{ resource, summary: null, updating: false }]}
        loading={false}
        refreshing={false}
        error={null}
        onCreate={vi.fn()}
        onRefresh={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Download complete results for run active-run' })).toBeDisabled();
  });
});
