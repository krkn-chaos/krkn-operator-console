import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileManagementPage } from '../FileManagementPage';
import { operatorApi } from '../../../services/operatorApi';

vi.mock('../../../hooks/useRole', () => ({
  useRole: () => ({ isAdmin: true, userGroups: ['team-a'] }),
}));

vi.mock('../../../services/operatorApi');

vi.mock('../FilesTable', () => ({
  FilesTable: ({ onCreateClick }: { onCreateClick: () => void }) => (
    <div data-testid="files-table">
      <button onClick={onCreateClick}>Create file</button>
    </div>
  ),
}));

vi.mock('../FileFormModal', () => ({
  FileFormModal: ({ isOpen }: { isOpen: boolean }) => (
    isOpen ? <div role="dialog">Create/edit file form</div> : null
  ),
}));

const filesResponse = {
  files: [{ fileId: 'file-1', fileName: 'config.yaml', availableToAll: true }],
};
describe('FileManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(operatorApi.getAvailableFiles).mockResolvedValue(filesResponse);
  });

  it('loads files when the page mounts', async () => {
    render(<FileManagementPage />);

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('files-table')).toBeInTheDocument());

    expect(operatorApi.getAvailableFiles).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'File Management' })).toBeInTheDocument();
  });

  it('shows an API error while still rendering data from the successful request', async () => {
    vi.mocked(operatorApi.getAvailableFiles).mockRejectedValue(new Error('Files unavailable'));

    render(<FileManagementPage />);

    expect(await screen.findByText('Files unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('files-table')).toBeInTheDocument();
  });

  it('opens the create file form from the Files tab', async () => {
    const user = userEvent.setup();
    render(<FileManagementPage />);

    await waitFor(() => expect(screen.getByTestId('files-table')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Create file' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Create/edit file form');
  });
});
