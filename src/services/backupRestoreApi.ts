import { BaseApiClient } from '../utils/apiClient';
import { config } from '../config';

const API_BASE = config.apiBaseUrl;

export interface RestoreResponse {
  jobId: string;
  status: string;
  startedAt?: string;
  message?: string;
}

export interface BackupDownloadResponse {
  downloadUrl: string;
  filename: string;
}

class BackupRestoreApi extends BaseApiClient {
  constructor() {
    super(API_BASE);
  }

  /**
   * Creates a backup and triggers a browser file download.
   * POST /backup returns a binary tar.gz (or tar.gz.enc) when S3 is disabled,
   * or a short-lived presigned download URL when S3 is enabled.
   *
   * @example
   * // Plain backup
   * await backupRestoreApi.downloadBackup();
   *
   * // Encrypted backup
   * await backupRestoreApi.downloadBackup('my-secret-passphrase');
   */
  async downloadBackup(passphrase?: string): Promise<void> {
    const headers: Record<string, string> = { Accept: 'application/json, application/gzip, application/octet-stream' };
    if (passphrase) {
      headers['X-Backup-Passphrase'] = btoa(new TextEncoder().encode(passphrase).reduce((s, b) => s + String.fromCharCode(b), ''));
    }
    const response = await this.fetch('/backup', { method: 'POST', headers });

    if (!response.ok) {
      let message = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const error = await response.json();
        if (error.message) message = error.message;
      } catch { /* use default message */ }
      throw new Error(message);
    }

    const contentType = response.headers.get('Content-Type') || '';
    let url: string;
    let revokeUrl = false;
    let filename = 'krkn-backup.tar.gz';

    if (contentType.includes('application/json')) {
      const result = (await response.json()) as Partial<BackupDownloadResponse>;
      if (!result.downloadUrl || !isSafeDownloadUrl(result.downloadUrl)) {
        throw new Error('Backup response did not contain a valid download URL');
      }
      filename = result.filename || filename;
      const s3Response = await fetch(result.downloadUrl);
      if (!s3Response.ok) {
        throw new Error(`Failed to download backup from storage: HTTP ${s3Response.status}`);
      }
      const blob = await s3Response.blob();
      url = URL.createObjectURL(blob);
      revokeUrl = true;
    } else {
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      filename = disposition?.match(/filename="(.+)"/)?.[1] || filename;
      url = URL.createObjectURL(blob);
      revokeUrl = true;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.referrerPolicy = 'no-referrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (revokeUrl) {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Uploads a backup archive and starts an async restore.
   * POST /restore with multipart/form-data, field name "backup".
   * For encrypted archives, include the passphrase.
   *
   * @example
   * // Plain restore
   * const resp = await backupRestoreApi.uploadRestore(file);
   * console.log(resp.jobId, resp.status);
   *
   * // Encrypted restore
   * const resp = await backupRestoreApi.uploadRestore(encFile, 'my-secret-passphrase');
   */
  async uploadRestore(file: File, passphrase?: string): Promise<RestoreResponse> {
    const formData = new FormData();
    formData.append('backup', file);

    const headers: Record<string, string> = {};
    if (passphrase) {
      headers['X-Backup-Passphrase'] = btoa(new TextEncoder().encode(passphrase).reduce((s, b) => s + String.fromCharCode(b), ''));
    }

    const response = await this.fetch('/restore', {
      method: 'POST',
      body: formData,
      headers,
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const error = await response.json();
        if (error.message) message = error.message;
      } catch { /* use default message */ }
      throw new Error(message);
    }

    return response.json();
  }

  /**
   * Starts an async restore from an HTTPS URL or an operator-configured S3 URI.
   * The operator downloads the archive, so S3 credentials stay out of the browser.
   * @example
   * // Restore from HTTPS URL
   * const response = await backupRestoreApi.restoreFromURL('https://storage.example.com/backup.tar.gz');
   * console.log(response.jobId, response.status); // 'restore-abc123', 'in_progress'
   * 
   * // Restore encrypted archive from S3 
   * const response = await backupRestoreApi.restoreFromURL(s3://my-bucket/backup.tar.gz.enc', 'my-passphrase');
   */
  async restoreFromURL(source: string, passphrase?: string): Promise<RestoreResponse> {
    const trimmedSource = source.trim();
    if (!trimmedSource) {
      throw new Error('A backup URL or S3 URI is required');
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (passphrase) {
      headers['X-Backup-Passphrase'] = btoa(new TextEncoder().encode(passphrase).reduce((s, b) => s + String.fromCharCode(b), ''));
    }

    const response = await this.fetch('/restore/url', {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: trimmedSource }),
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const error = await response.json();
        if (error.message) message = error.message;
      } catch { /* use default message */ }
      throw new Error(message);
    }

    return response.json();
  }

  /**
   * Polls the status of an async restore job.
   * GET /restore/{jobId}
   */
  async getRestoreStatus(jobId: string): Promise<RestoreResponse> {
    return this.fetchJson<RestoreResponse>(`/restore/${encodeURIComponent(jobId)}`);
  }
}

function isSafeDownloadUrl(value: string): boolean {
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === 'https:' || url.origin === window.location.origin;
  } catch {
    return false;
  }
}

export const backupRestoreApi = new BackupRestoreApi();
