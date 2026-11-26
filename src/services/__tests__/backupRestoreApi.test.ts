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

    it('should trigger a download from an S3 presigned URL', async () => {
      const downloadUrl = 'https://tgangise-bucket.s3.us-east-2.amazonaws.com/krkn-operator/backups/backup.tar.gz?X-Amz-Signature=test';
      const s3Blob = new Blob(['s3-archive'], { type: 'application/gzip' });
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: async () => ({ downloadUrl, filename: 'backup.tar.gz' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: async () => s3Blob,
        });

      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
      const anchor = document.createElement('a');
      const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => undefined);
      vi.spyOn(document, 'createElement').mockReturnValue(anchor);
      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

      await backupRestoreApi.downloadBackup();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[1][0]).toBe(downloadUrl);
      expect(anchor.href).toMatch(/^blob:/);
      expect(anchor.download).toBe('backup.tar.gz');
      expect(clickSpy).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledOnce();

      vi.restoreAllMocks();
    });

    it('should reject an S3 response without a valid download URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ filename: 'backup.tar.gz' }),
      });

      await expect(backupRestoreApi.downloadBackup()).rejects.toThrow(
        'Backup response did not contain a valid download URL'
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

    it('should start a restore from a remote HTTPS URL or S3 URI', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ jobId: 'restore-remote', status: 'in_progress' }),
      });

      const response = await backupRestoreApi.restoreFromURL(
        ' s3://backup-bucket/krkn-operator/backups/backup.tar.gz ',
        'secret-passphrase'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/restore/url'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ url: 's3://backup-bucket/krkn-operator/backups/backup.tar.gz' }),
        })
      );
      const headers = new Headers(mockFetch.mock.calls[0][1].headers);
      const decoded = new TextDecoder().decode(
        Uint8Array.from(atob(headers.get('X-Backup-Passphrase')!), c => c.charCodeAt(0))
      );
      expect(decoded).toBe('secret-passphrase');
      expect(response.jobId).toBe('restore-remote');
    });
  });

  describe('downloadBackup with passphrase', () => {
    it('should send Base64-encoded X-Backup-Passphrase header when passphrase is provided', async () => {
      const mockBlob = new Blob(['fake-archive'], { type: 'application/gzip' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Disposition': 'attachment; filename="krkn-backup.tar.gz.enc"',
        }),
        blob: async () => mockBlob,
      });

      vi.spyOn(document, 'createElement').mockReturnValue(Object.assign(document.createElement('a'), { click: vi.fn() }));
      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

      await backupRestoreApi.downloadBackup('my-secret');

      const callArgs = mockFetch.mock.calls[0];
      const headers = new Headers(callArgs[1].headers);
      const headerValue = headers.get('X-Backup-Passphrase');
      expect(headerValue).not.toBeNull();
      const decoded = new TextDecoder().decode(
        Uint8Array.from(atob(headerValue!), c => c.charCodeAt(0))
      );
      expect(decoded).toBe('my-secret');

      vi.restoreAllMocks();
    });

    it('should not send X-Backup-Passphrase header when no passphrase is provided', async () => {
      const mockBlob = new Blob(['fake-archive'], { type: 'application/gzip' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Disposition': 'attachment; filename="krkn-backup.tar.gz"',
        }),
        blob: async () => mockBlob,
      });

      vi.spyOn(document, 'createElement').mockReturnValue(Object.assign(document.createElement('a'), { click: vi.fn() }));
      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

      await backupRestoreApi.downloadBackup();

      const callArgs = mockFetch.mock.calls[0];
      const headers = new Headers(callArgs[1].headers);
      expect(headers.get('X-Backup-Passphrase')).toBeNull();

      vi.restoreAllMocks();
    });

    it('should correctly Base64-encode Unicode passphrases', async () => {
      const mockBlob = new Blob(['fake-archive'], { type: 'application/gzip' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Disposition': 'attachment; filename="krkn-backup.tar.gz.enc"',
        }),
        blob: async () => mockBlob,
      });

      vi.spyOn(document, 'createElement').mockReturnValue(Object.assign(document.createElement('a'), { click: vi.fn() }));
      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

      const unicodePassphrase = 'pässwörd-日本語';
      await backupRestoreApi.downloadBackup(unicodePassphrase);

      const callArgs = mockFetch.mock.calls[0];
      const headers = new Headers(callArgs[1].headers);
      const headerValue = headers.get('X-Backup-Passphrase');
      expect(headerValue).not.toBeNull();
      const decoded = new TextDecoder().decode(
        Uint8Array.from(atob(headerValue!), c => c.charCodeAt(0))
      );
      expect(decoded).toBe(unicodePassphrase);

      vi.restoreAllMocks();
    });
  });

  describe('uploadRestore with passphrase', () => {
    it('should send Base64-encoded X-Backup-Passphrase header for encrypted restore', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ jobId: 'restore-enc', status: 'in_progress' }),
      });

      const file = new File(['fake-content'], 'backup.tar.gz.enc', { type: 'application/octet-stream' });
      await backupRestoreApi.uploadRestore(file, 'decrypt-me');

      const callArgs = mockFetch.mock.calls[0];
      const headers = new Headers(callArgs[1].headers);
      const headerValue = headers.get('X-Backup-Passphrase');
      expect(headerValue).not.toBeNull();
      const decoded = new TextDecoder().decode(
        Uint8Array.from(atob(headerValue!), c => c.charCodeAt(0))
      );
      expect(decoded).toBe('decrypt-me');
    });

    it('should not send X-Backup-Passphrase header when no passphrase for restore', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ jobId: 'restore-plain', status: 'in_progress' }),
      });

      const file = new File(['fake-content'], 'backup.tar.gz', { type: 'application/gzip' });
      await backupRestoreApi.uploadRestore(file);

      const callArgs = mockFetch.mock.calls[0];
      const headers = new Headers(callArgs[1].headers);
      expect(headers.get('X-Backup-Passphrase')).toBeNull();
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
