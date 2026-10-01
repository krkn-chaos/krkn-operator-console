import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { operatorApi } from '../../../services/operatorApi';
import { CategoryForm } from '../CategoryForm';

vi.mock('../../../services/operatorApi', () => ({
  operatorApi: {
    getGroups: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
  },
}));

const groupsResponse = { groups: [{ id: 'team-id', name: 'Display Team' }] };

describe('CategoryForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(operatorApi.getGroups).mockResolvedValue(groupsResponse);
    vi.mocked(operatorApi.createCategory).mockResolvedValue({} as never);
    vi.mocked(operatorApi.updateCategory).mockResolvedValue({} as never);
  });

  it('creates a category through the category API', async () => {
    const onSuccess = vi.fn();
    render(<CategoryForm mode="create" onSuccess={onSuccess} onCancel={vi.fn()} />);

    fireEvent.change(await screen.findByRole('textbox', { name: /Name/ }), { target: { value: 'resilience' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Category' }));

    await waitFor(() => {
      expect(operatorApi.createCategory).toHaveBeenCalledWith({
        name: 'resilience',
        color: undefined,
        groups: undefined,
        availableToAll: true,
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('resolves a stored display name to its canonical group ID when editing', async () => {
    render(
      <CategoryForm
        mode="edit"
        initialData={{ name: 'resilience', groups: ['Display Team'], availableToAll: false }}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const groupSelect = await screen.findByLabelText('Category group') as HTMLSelectElement;
    await waitFor(() => expect(groupSelect.value).toBe('team-id'));
    expect(screen.queryByText('The current group is no longer available to select.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => {
      expect(operatorApi.updateCategory).toHaveBeenCalledWith('resilience', {
        color: '',
        groups: ['team-id'],
        availableToAll: false,
      });
    });
  });
});
