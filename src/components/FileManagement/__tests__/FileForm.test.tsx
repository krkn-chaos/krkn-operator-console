import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileForm } from '../FileForm';
import type { FileTypeResponse } from '../../../types/api';

// Mock operatorApi
vi.mock('../../../services/operatorApi', () => ({
  operatorApi: {
    createFile: vi.fn(),
    updateFile: vi.fn(),
    getFile: vi.fn(),
    getGroups: vi.fn().mockResolvedValue({ groups: [] }),
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
  availableFileTypes: [] as FileTypeResponse[],
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
  onRequestNewFileType: vi.fn(),
};

describe('FileForm error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (operatorApi.getGroups as ReturnType<typeof vi.fn>).mockResolvedValue({ groups: [] });
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
});
