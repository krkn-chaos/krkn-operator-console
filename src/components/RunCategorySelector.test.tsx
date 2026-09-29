import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { operatorApi } from '../services/operatorApi';
import { RunCategorySelector } from './RunCategorySelector';

vi.mock('../services/operatorApi');

describe('RunCategorySelector', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading until visible categories are available', async () => {
    let resolveCategories!: (response: { categories: { name: string; availableToAll: boolean }[]; total: number }) => void;
    vi.mocked(operatorApi.getCategories).mockImplementation(
      () => new Promise((resolve) => { resolveCategories = resolve; }),
    );

    render(<RunCategorySelector selectedCategories={[]} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Loading categories')).toBeInTheDocument();

    await act(async () => {
      resolveCategories({ categories: [{ name: 'resilience', availableToAll: true }], total: 1 });
    });

    expect(await screen.findByRole('checkbox', { name: 'resilience' })).toBeInTheDocument();
  });

  it('explains when the caller has no visible categories', async () => {
    vi.mocked(operatorApi.getCategories).mockResolvedValue({ categories: [], total: 0 });

    render(<RunCategorySelector selectedCategories={[]} onChange={vi.fn()} />);

    expect(await screen.findByText('No categories available.')).toBeInTheDocument();
  });

  it('offers retry after a loading error and recovers with the visible list', async () => {
    const user = userEvent.setup();
    vi.mocked(operatorApi.getCategories)
      .mockRejectedValueOnce(new Error('Categories unavailable'))
      .mockResolvedValueOnce({ categories: [{ name: 'resilience', availableToAll: true }], total: 1 });

    render(<RunCategorySelector selectedCategories={[]} onChange={vi.fn()} />);

    expect(await screen.findByText('Categories unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(operatorApi.getCategories).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('checkbox', { name: 'resilience' })).toBeInTheDocument();
  });
});
