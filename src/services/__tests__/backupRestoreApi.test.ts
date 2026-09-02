import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { backupRestoreApi } from '../backupRestoreApi';

describe('backupRestoreApi', () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('startBackup', () => {
    it('should call POST /api/v1/backup without backupName', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'job-123', message: 'Backup started' }),
      });

      const response = await backupRestoreApi.startBackup();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/backup'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
      expect(response.jobId).toBe('job-123');
      expect(response.message).toBe('Backup started');
    });

    it('should call POST /api/v1/backup with backupName', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'job-456', message: 'Backup started' }),
      });

      const response = await backupRestoreApi.startBackup({ backupName: 'pre-upgrade' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/backup'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ backupName: 'pre-upgrade' }),
        })
      );
      expect(response.jobId).toBe('job-456');
    });

    it('should throw error on backup failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      await expect(backupRestoreApi.startBackup()).rejects.toThrow();
    });
  });

  describe('startRestore', () => {
    it('should call POST /api/v1/restore with backupPath', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'restore-789', message: 'Restore started' }),
      });

      const response = await backupRestoreApi.startRestore({ backupPath: '/tmp/backup.tar.gz' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/restore'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ backupPath: '/tmp/backup.tar.gz' }),
        })
      );
      expect(response.jobId).toBe('restore-789');
      expect(response.message).toBe('Restore started');
    });

    it('should throw error on restore failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid backup file' }),
      });

      await expect(
        backupRestoreApi.startRestore({ backupPath: '/invalid/path.tar.gz' })
      ).rejects.toThrow();
    });
  });
});
