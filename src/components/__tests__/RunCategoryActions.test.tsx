import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CategoryResponse } from '../../types/api';
import { RunCategoryActions } from '../RunCategoryActions';

const categories: CategoryResponse[] = [
  { name: 'resilience', color: '#0066CC', availableToAll: true },
];

describe('RunCategoryActions', () => {
  it('opens category actions and supports adding and removing a category', async () => {
    const onOpenCategories = vi.fn();
    const onToggleCategory = vi.fn();
    render(
      <RunCategoryActions
        runName="run-123"
        categories={categories}
        assignedCategoryNames={['resilience']}
        isCategoriesLoading={false}
        categoriesError={null}
        isCategoryUpdating={false}
        isDeleting={false}
        onOpenCategories={onOpenCategories}
        onToggleCategory={onToggleCategory}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Actions for run run-123'));
    fireEvent.mouseEnter(screen.getByText('Category'));
    const categoryItem = await screen.findByRole('menuitem', { name: 'Remove category resilience' });
    fireEvent.click(categoryItem.querySelector('input[type="checkbox"]')!);

    expect(onOpenCategories).toHaveBeenCalledOnce();
    await waitFor(() => expect(onToggleCategory).toHaveBeenCalledWith(categories[0]));
  });

  it('shows the delete action as the final menu item', () => {
    const onDelete = vi.fn();
    render(
      <RunCategoryActions
        runName="run-123"
        categories={[]}
        assignedCategoryNames={[]}
        isCategoriesLoading={false}
        categoriesError={null}
        isCategoryUpdating={false}
        isDeleting={false}
        onOpenCategories={vi.fn()}
        onToggleCategory={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByLabelText('Actions for run run-123'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
