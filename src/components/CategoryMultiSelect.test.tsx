import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CategoryMultiSelect } from './CategoryMultiSelect';
import type { CategoryResponse } from '../types/api';
import type { CategoryLoadStatus } from '../hooks/useVisibleCategories';

const categories: CategoryResponse[] = [
  { name: 'network', color: '#d40078', availableToAll: true },
  { name: 'reliability', color: '#ff9900', availableToAll: true },
];

function Harness({
  status = 'ready',
  availableCategories = categories,
  onRetry = vi.fn(),
  preserveExistingOnError = false,
  initialSelected = [],
}: {
  status?: CategoryLoadStatus;
  availableCategories?: CategoryResponse[];
  onRetry?: () => void;
  preserveExistingOnError?: boolean;
  initialSelected?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  return (
    <CategoryMultiSelect
      id="test-categories"
      label="Categories"
      categories={availableCategories}
      status={status}
      selectedCategories={selected}
      onSelectionChange={setSelected}
      onRetry={onRetry}
      preserveExistingOnError={preserveExistingOnError}
    />
  );
}

describe('CategoryMultiSelect', () => {
  it('supports selecting multiple visible categories', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: 'Categories' });

    await user.click(toggle);
    await user.click(screen.getByRole('checkbox', { name: 'network' }));
    await user.click(screen.getByRole('checkbox', { name: 'reliability' }));

    expect(toggle).toHaveTextContent('2 categories selected');
  });

  it('shows loading without displaying a partial category list', () => {
    render(<Harness status="loading" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading categories');
    expect(screen.queryByRole('button', { name: 'Categories' })).not.toBeInTheDocument();
    expect(screen.queryByText('network')).not.toBeInTheDocument();
  });

  it('counts only categories that have a selectable option', () => {
    render(<Harness initialSelected={['network', 'group-only']} />);

    const toggle = screen.getByRole('button', { name: 'Categories' });
    expect(toggle).toHaveTextContent('1 category selected');
    expect(screen.queryByRole('checkbox', { name: 'group-only' })).not.toBeInTheDocument();
  });

  it('says existing categories are kept when the caller preserves them', () => {
    render(<Harness status="error" preserveExistingOnError />);

    expect(screen.getByText(/The existing categories will be kept unchanged/)).toBeInTheDocument();
    expect(screen.queryByText(/No categories will be assigned/)).not.toBeInTheDocument();
  });

  it('offers retry after a category request fails and hides partial results', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<Harness status="error" onRetry={onRetry} />);

    expect(screen.getByText('Categories could not be loaded')).toBeInTheDocument();
    expect(screen.queryByText('network')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('explains when no categories are available', () => {
    render(<Harness availableCategories={[]} />);

    expect(screen.getByText(/No categories are available to you/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Categories' })).not.toBeInTheDocument();
  });
});
