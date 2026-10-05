import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

    const table = screen.getByRole('table', { name: 'Krkn-AI run progress' });
    expect(within(table).getByRole('columnheader', { name: 'Run' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();

    const emptyRow = within(table).getAllByRole('row')[1];
    expect(within(emptyRow).getByRole('heading', { name: 'No Krkn-AI runs yet' })).toBeInTheDocument();
    expect(within(emptyRow).getByText('Use Create run above to explore a cluster.')).toBeInTheDocument();
    expect(emptyRow.querySelector('td')).toHaveAttribute('colspan', '8');
  });
});
