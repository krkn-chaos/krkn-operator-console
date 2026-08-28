import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { backupRestoreApi } from '../backupRestoreApi';

describe('backupRestoreApi', () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('downloadBackup', () => {
    it('should call POST /api/v1/backup and trigger download', async () => {
      const mockBlob = new Blob(['fake-archive'], { type: 'application/gzip' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Disposition': 'attachment; filename="krkn-backup-2026-09-09.tar.gz"',
        }),
        blob: async () => mockBlob,
      });

      const createElementSpy = vi.spyOn(document, 'createElement');
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

      await backupRestoreApi.downloadBackup();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/backup'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(createElementSpy).toHaveBeenCalledWith('a');

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('should throw error on backup failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Backup failed: no resources' }),
      });

      await expect(backupRestoreApi.downloadBackup()).rejects.toThrow(
        'Backup failed: no resources'
      );
    });
  });

  describe('uploadRestore', () => {
    it('should call POST /api/v1/restore with FormData', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ jobId: 'restore-789', status: 'in_progress', message: 'Restore started' }),
      });

      const file = new File(['fake-content'], 'backup.tar.gz', { type: 'application/gzip' });
      const response = await backupRestoreApi.uploadRestore(file);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/restore'),
        expect.objectContaining({ method: 'POST' })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body;
      expect(body).toBeInstanceOf(FormData);
      expect(body.get('backup')).toBeInstanceOf(File);

      expect(response.jobId).toBe('restore-789');
      expect(response.status).toBe('in_progress');
    });

    it('should throw error on restore failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Backup file must be a .tar.gz archive' }),
      });

      const file = new File(['fake'], 'bad.zip', { type: 'application/zip' });
      await expect(backupRestoreApi.uploadRestore(file)).rejects.toThrow(
        'Backup file must be a .tar.gz archive'
      );
    });
  });

  describe('getRestoreStatus', () => {
    it('should call GET /api/v1/restore/{jobId}', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'restore-123', status: 'completed' }),
      });

      const result = await backupRestoreApi.getRestoreStatus('restore-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/restore/restore-123'),
        expect.anything()
      );
      expect(result.status).toBe('completed');
    });

    it('should encode special characters in jobId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'job/with/slashes', status: 'in_progress' }),
      });

      await backupRestoreApi.getRestoreStatus('job/with/slashes');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/restore/job%2Fwith%2Fslashes'),
        expect.anything()
      );
    });
  });
});
