import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackupRestoreCard } from './BackupRestoreCard';
import { backupRestoreApi } from '../services/backupRestoreApi';

vi.mock('../services/backupRestoreApi');

const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}));

function createTestFile(name = 'test-backup.tar.gz', size = 1024): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type: 'application/gzip' });
}

describe('BackupRestoreCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render download and upload buttons', () => {
    render(<BackupRestoreCard />);

    expect(screen.getByRole('button', { name: /download backup/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload & restore/i })).toBeInTheDocument();
  });

  it('should render card title and description', () => {
    render(<BackupRestoreCard />);

    expect(screen.getByText('Backup & Restore')).toBeInTheDocument();
    expect(screen.getByText(/Download a backup of all configuration data/i)).toBeInTheDocument();
  });

  describe('Backup Download', () => {
    it('should call downloadBackup on button click', async () => {
      vi.mocked(backupRestoreApi.downloadBackup).mockResolvedValue();

      render(<BackupRestoreCard />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /download backup/i }));

      await waitFor(() => {
        expect(backupRestoreApi.downloadBackup).toHaveBeenCalled();
        expect(mockShowSuccess).toHaveBeenCalledWith(
          'Backup Downloaded',
          'Backup archive saved to your downloads folder.'
        );
      });
    });

    it('should show error notification on download failure', async () => {
      vi.mocked(backupRestoreApi.downloadBackup).mockRejectedValue(
        new Error('Backup failed: no resources')
      );

      render(<BackupRestoreCard />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /download backup/i }));

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(
          'Backup Failed',
          'Backup failed: no resources'
        );
      });
    });

    it('should disable upload button while downloading', async () => {
      let resolveDownload: () => void;
      vi.mocked(backupRestoreApi.downloadBackup).mockImplementation(
        () => new Promise<void>((resolve) => { resolveDownload = resolve; })
      );

      render(<BackupRestoreCard />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /download backup/i }));

      expect(screen.getByRole('button', { name: /upload & restore/i })).toBeDisabled();

      await act(async () => { resolveDownload!(); });
    });
  });

  describe('Restore Upload', () => {
    it('should open restore modal on button click', async () => {
      render(<BackupRestoreCard />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /upload & restore/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Backup Archive')).toBeInTheDocument();
        expect(screen.getByText(/This will replace all configuration/i)).toBeInTheDocument();
      });
    });

    it('should disable restore confirm button when no file is selected', async () => {
      render(<BackupRestoreCard />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /upload & restore/i }));

      await waitFor(() => {
        const confirmButtons = screen.getAllByRole('button', { name: /upload & restore/i });
        const modalConfirm = confirmButtons[confirmButtons.length - 1];
        expect(modalConfirm).toBeDisabled();
      });
    });

    it('should enable restore confirm button after file selection', async () => {
      render(<BackupRestoreCard />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /upload & restore/i }));

      const fileInput = screen.getByTestId('restore-file-input');
      const file = createTestFile();
      await user.upload(fileInput, file);

      await waitFor(() => {
        const confirmButtons = screen.getAllByRole('button', { name: /upload & restore/i });
        const modalConfirm = confirmButtons[confirmButtons.length - 1];
        expect(modalConfirm).not.toBeDisabled();
      });
    });

    it('should show selected file info', async () => {
      render(<BackupRestoreCard />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /upload & restore/i }));

      const fileInput = screen.getByTestId('restore-file-input');
      const file = createTestFile('my-backup.tar.gz', 2048);
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText(/my-backup\.tar\.gz/)).toBeInTheDocument();
        expect(screen.getByText(/2 KB/)).toBeInTheDocument();
      });
    });

    it('should call uploadRestore and show success on confirm', async () => {
      vi.mocked(backupRestoreApi.uploadRestore).mockResolvedValue({
        jobId: 'restore-123',
        status: 'in_progress',
        message: 'Restore started',
      });
      vi.mocked(backupRestoreApi.getRestoreStatus).mockResolvedValue({
        jobId: 'restore-123',
        status: 'completed',
      });

      render(<BackupRestoreCard />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /upload & restore/i }));

      const fileInput = screen.getByTestId('restore-file-input');
      await user.upload(fileInput, createTestFile());

      const confirmButtons = screen.getAllByRole('button', { name: /upload & restore/i });
      await user.click(confirmButtons[confirmButtons.length - 1]);

      await waitFor(() => {
        expect(backupRestoreApi.uploadRestore).toHaveBeenCalled();
        expect(mockShowSuccess).toHaveBeenCalledWith(
          'Restore Started',
          expect.stringContaining('restore-123'),
          8000
        );
      });
    });

    it('should show error notification on upload failure', async () => {
      vi.mocked(backupRestoreApi.uploadRestore).mockRejectedValue(
        new Error('Invalid backup file')
      );

      render(<BackupRestoreCard />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /upload & restore/i }));

      const fileInput = screen.getByTestId('restore-file-input');
      await user.upload(fileInput, createTestFile());

      const confirmButtons = screen.getAllByRole('button', { name: /upload & restore/i });
      await user.click(confirmButtons[confirmButtons.length - 1]);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(
          'Restore Failed',
          'Invalid backup file'
        );
      });
    });

    it('should show in-progress status after restore starts', async () => {
      vi.mocked(backupRestoreApi.uploadRestore).mockResolvedValue({
        jobId: 'restore-progress',
        status: 'in_progress',
        message: 'Restore started',
      });
      vi.mocked(backupRestoreApi.getRestoreStatus).mockResolvedValue({
        jobId: 'restore-progress',
        status: 'in_progress',
      });

      render(<BackupRestoreCard />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /upload & restore/i }));

      const fileInput = screen.getByTestId('restore-file-input');
      await user.upload(fileInput, createTestFile());

      const confirmButtons = screen.getAllByRole('button', { name: /upload & restore/i });
      await user.click(confirmButtons[confirmButtons.length - 1]);

      await waitFor(() => {
        expect(screen.getByText(/Restore in progress/i)).toBeInTheDocument();
      });
    });

    it('should poll restore status and show success on completion', async () => {
      vi.mocked(backupRestoreApi.uploadRestore).mockResolvedValue({
        jobId: 'restore-poll',
        status: 'in_progress',
        message: 'Restore started',
      });
      vi.mocked(backupRestoreApi.getRestoreStatus).mockResolvedValue({
        jobId: 'restore-poll',
        status: 'completed',
      });

      render(<BackupRestoreCard />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /upload & restore/i }));
      const fileInput = screen.getByTestId('restore-file-input');
      await user.upload(fileInput, createTestFile());

      const confirmButtons = screen.getAllByRole('button', { name: /upload & restore/i });
      await user.click(confirmButtons[confirmButtons.length - 1]);

      await waitFor(() => {
        expect(backupRestoreApi.uploadRestore).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(3500);
      });

      await waitFor(() => {
        expect(backupRestoreApi.getRestoreStatus).toHaveBeenCalledWith('restore-poll');
        expect(mockShowSuccess).toHaveBeenCalledWith(
          'Restore Completed',
          expect.stringContaining('restart the operator pod'),
          0
        );
      });
    });

    it('should show error when polled restore status is failed', async () => {
      vi.mocked(backupRestoreApi.uploadRestore).mockResolvedValue({
        jobId: 'restore-fail',
        status: 'in_progress',
      });
      vi.mocked(backupRestoreApi.getRestoreStatus).mockResolvedValue({
        jobId: 'restore-fail',
        status: 'failed',
        message: 'Archive corrupt',
      });

      render(<BackupRestoreCard />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /upload & restore/i }));
      const fileInput = screen.getByTestId('restore-file-input');
      await user.upload(fileInput, createTestFile());

      const confirmButtons = screen.getAllByRole('button', { name: /upload & restore/i });
      await user.click(confirmButtons[confirmButtons.length - 1]);

      await waitFor(() => {
        expect(backupRestoreApi.uploadRestore).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(3500);
      });

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Restore Failed', 'Archive corrupt');
      });
    });

    it('should stop polling on unmount', async () => {
      vi.mocked(backupRestoreApi.uploadRestore).mockResolvedValue({
        jobId: 'restore-unmount',
        status: 'in_progress',
      });
      vi.mocked(backupRestoreApi.getRestoreStatus).mockResolvedValue({
        jobId: 'restore-unmount',
        status: 'in_progress',
      });

      const { unmount } = render(<BackupRestoreCard />);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /upload & restore/i }));
      const fileInput = screen.getByTestId('restore-file-input');
      await user.upload(fileInput, createTestFile());

      const confirmButtons = screen.getAllByRole('button', { name: /upload & restore/i });
      await user.click(confirmButtons[confirmButtons.length - 1]);

      await waitFor(() => {
        expect(backupRestoreApi.uploadRestore).toHaveBeenCalled();
      });

      unmount();

      const statusCallsBefore = vi.mocked(backupRestoreApi.getRestoreStatus).mock.calls.length;

      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      expect(vi.mocked(backupRestoreApi.getRestoreStatus).mock.calls.length).toBe(
        statusCallsBefore
      );
    });
  });
});
