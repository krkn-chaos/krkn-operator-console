import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { FileForm } from '../FileForm';

const fileFormStyles = readFileSync(`${process.cwd()}/src/components/FileManagement/FileForm.css`, 'utf8');

// Mock operatorApi
vi.mock('../../../services/operatorApi', () => ({
  operatorApi: {
    createFile: vi.fn(),
    updateFile: vi.fn(),
    getFile: vi.fn(),
    getGroups: vi.fn().mockResolvedValue({ groups: [] }),
    getCategories: vi.fn().mockResolvedValue({ categories: [], total: 0 }),
  },
}));

// Mock useRole
vi.mock('../../../hooks/useRole', () => ({
  useRole: () => ({ isAdmin: true }),
}));

import { operatorApi } from '../../../services/operatorApi';

/**
 * Creates an ApiError compatible with isApiError() checks.
 * isApiError expects: err instanceof Error && typeof err.status === 'number'
 */
function createApiError(message: string, status: number, statusText: string): Error & { status: number; statusText: string } {
  return Object.assign(new Error(message), { status, statusText });
}

const defaultProps = {
  mode: 'create' as const,
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

describe('FileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (operatorApi.getGroups as ReturnType<typeof vi.fn>).mockResolvedValue({ groups: [] });
    (operatorApi.getCategories as ReturnType<typeof vi.fn>).mockResolvedValue({ categories: [], total: 0 });
  });

  /**
   * Helper: fill in required form fields (file name and content) then submit.
   */
  async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, fileName = 'test-file.yaml', content = 'some content') {
    const filenameInput = screen.getByRole('textbox', { name: /file name/i });
    const contentInput = document.querySelector('#content-input') as HTMLTextAreaElement;

    await user.type(filenameInput, fileName);
    await user.type(contentInput, content);
    await user.click(screen.getByRole('button', { name: /create file/i }));
  }

  it('shows validation error when create returns 409', async () => {
    const user = userEvent.setup();
    const fileName = 'duplicate.yaml';

    (operatorApi.createFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      createApiError('Conflict', 409, 'Conflict'),
    );

    render(<FileForm {...defaultProps} />);
    await fillAndSubmit(user, fileName);

    await waitFor(() => {
      // The inline alert error message
      expect(
        screen.getByText(`The file name "${fileName}" is already taken.`),
      ).toBeInTheDocument();

      // The field-level validation error
      expect(
        screen.getByText(
          `A file named "${fileName}" already exists. Please choose a different name.`,
        ),
      ).toBeInTheDocument();
    });
  });

  it('shows permission error when create returns 403', async () => {
    const user = userEvent.setup();

    (operatorApi.createFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      createApiError('Forbidden', 403, 'Forbidden'),
    );

    render(<FileForm {...defaultProps} />);
    await fillAndSubmit(user);

    await waitFor(() => {
      expect(
        screen.getByText('You do not have permission to perform this action'),
      ).toBeInTheDocument();
    });
  });

  it('shows generic error for other API errors', async () => {
    const user = userEvent.setup();

    (operatorApi.createFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      createApiError('Internal Server Error', 500, 'Internal Server Error'),
    );

    render(<FileForm {...defaultProps} />);
    await fillAndSubmit(user);

    await waitFor(() => {
      expect(
        screen.getByText('Internal Server Error'),
      ).toBeInTheDocument();
    });
  });

  it('preserves legacy file type metadata when editing a file', async () => {
    const user = userEvent.setup();
    (operatorApi.getFile as ReturnType<typeof vi.fn>).mockResolvedValue({
      fileId: 'legacy-file',
      fileName: 'legacy-config.yaml',
      content: 'key: value',
      availableToAll: true,
      fileType: 'config',
    });
    (operatorApi.updateFile as ReturnType<typeof vi.fn>).mockResolvedValue({ fileId: 'legacy-file' });

    render(
      <FileForm
        mode="edit"
        initialData={{ fileId: 'legacy-file', fileName: 'legacy-config.yaml', availableToAll: true }}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await screen.findByDisplayValue('legacy-config.yaml');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(operatorApi.updateFile).toHaveBeenCalledWith('legacy-file', expect.objectContaining({ fileType: 'config' }));
    });
  });

  it('renders the group-select toggle with full-width text', async () => {
    const user = userEvent.setup();
    render(<FileForm {...defaultProps} />);

    await user.click(screen.getByRole('radio', { name: 'Assign to group' }));

    const toggle = document.querySelector('.file-form-group-select-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveClass('file-form-group-select-toggle');

    const toggleText = toggle?.querySelector('.pf-v5-c-menu-toggle__text');
    expect(toggleText).toBeInTheDocument();
    expect(fileFormStyles).toMatch(
      /\.file-form-group-select-toggle\s+\.pf-v5-c-menu-toggle__text\s*\{\s*width:\s*100%;?\s*\}/,
    );
  });

  it('sends the selected categories when creating a file', async () => {
    const user = userEvent.setup();
    (operatorApi.getCategories as ReturnType<typeof vi.fn>).mockResolvedValue({
      categories: [{ name: 'network-chaos', availableToAll: true }],
      total: 1,
    });
    (operatorApi.createFile as ReturnType<typeof vi.fn>).mockResolvedValue({ message: 'ok', fileId: 'f1' });

    render(<FileForm {...defaultProps} />);

    const categoryToggle = await screen.findByRole('button', { name: 'Categories' });
    await user.click(categoryToggle);
    await user.click(screen.getByRole('checkbox', { name: 'network-chaos' }));
    await fillAndSubmit(user);

    await waitFor(() => {
      expect(operatorApi.createFile).toHaveBeenCalledWith(
        expect.objectContaining({ categories: ['network-chaos'] }),
      );
    });
  });

  it('sends existing categories when editing, including ones the user cannot see', async () => {
    const user = userEvent.setup();
    (operatorApi.getCategories as ReturnType<typeof vi.fn>).mockResolvedValue({
      categories: [{ name: 'network-chaos', availableToAll: true }],
      total: 1,
    });
    (operatorApi.getFile as ReturnType<typeof vi.fn>).mockResolvedValue({
      fileId: 'categorized-file',
      fileName: 'rules.yaml',
      content: 'key: value',
      availableToAll: true,
      categories: ['network-chaos', 'admin-only-category'],
    });
    (operatorApi.updateFile as ReturnType<typeof vi.fn>).mockResolvedValue({ fileId: 'categorized-file' });

    render(
      <FileForm
        mode="edit"
        initialData={{ fileId: 'categorized-file', fileName: 'rules.yaml', availableToAll: true }}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await screen.findByDisplayValue('rules.yaml');
    await screen.findByRole('button', { name: 'Categories' });
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(operatorApi.updateFile).toHaveBeenCalledWith(
        'categorized-file',
        expect.objectContaining({ categories: ['network-chaos', 'admin-only-category'] }),
      );
    });
  });

  it('omits categories when the category list fails to load so existing ones are preserved', async () => {
    const user = userEvent.setup();
    (operatorApi.getCategories as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('forbidden'));
    (operatorApi.getFile as ReturnType<typeof vi.fn>).mockResolvedValue({
      fileId: 'categorized-file',
      fileName: 'rules.yaml',
      content: 'key: value',
      availableToAll: true,
      categories: ['network-chaos'],
    });
    (operatorApi.updateFile as ReturnType<typeof vi.fn>).mockResolvedValue({ fileId: 'categorized-file' });

    render(
      <FileForm
        mode="edit"
        initialData={{ fileId: 'categorized-file', fileName: 'rules.yaml', availableToAll: true }}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await screen.findByDisplayValue('rules.yaml');
    await screen.findByText('Categories could not be loaded');
    // Edit mode omits the field, so the message must not claim removal.
    expect(screen.getByText(/The existing categories will be kept unchanged/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(operatorApi.updateFile).toHaveBeenCalled());
    const payload = (operatorApi.updateFile as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(payload).not.toHaveProperty('categories');
  });

  it('omits categories when the edit response does not include them', async () => {
    const user = userEvent.setup();
    (operatorApi.getCategories as ReturnType<typeof vi.fn>).mockResolvedValue({
      categories: [{ name: 'network-chaos', availableToAll: true }],
      total: 1,
    });
    // An operator that predates file categories omits the field entirely.
    (operatorApi.getFile as ReturnType<typeof vi.fn>).mockResolvedValue({
      fileId: 'legacy-file',
      fileName: 'legacy.yaml',
      content: 'key: value',
      availableToAll: true,
    });
    (operatorApi.updateFile as ReturnType<typeof vi.fn>).mockResolvedValue({ fileId: 'legacy-file' });

    render(
      <FileForm
        mode="edit"
        initialData={{ fileId: 'legacy-file', fileName: 'legacy.yaml', availableToAll: true }}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await screen.findByDisplayValue('legacy.yaml');
    await screen.findByRole('button', { name: 'Categories' });
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(operatorApi.updateFile).toHaveBeenCalled());
    const payload = (operatorApi.updateFile as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(payload).not.toHaveProperty('categories');
  });

  it('hides the category control when the operator does not support categories', async () => {
    (operatorApi.getCategories as ReturnType<typeof vi.fn>).mockResolvedValue({
      categories: [{ name: 'network-chaos', availableToAll: true }],
      total: 1,
    });

    render(<FileForm {...defaultProps} categoriesSupported={false} />);

    await screen.findByRole('textbox', { name: /file name/i });
    expect(screen.queryByRole('button', { name: 'Categories' })).not.toBeInTheDocument();
  });
});
