import { BaseApiClient } from '../utils/apiClient';
import { config } from '../config';

const API_BASE = config.apiBaseUrl;

export interface RestoreResponse {
  jobId: string;
  status: string;
  startedAt?: string;
  message?: string;
}

class BackupRestoreApi extends BaseApiClient {
  constructor() {
    super(API_BASE);
  }

  /**
   * Creates a backup and triggers a browser file download.
   * POST /backup returns binary tar.gz (or tar.gz.enc if passphrase is set)
   * streamed directly to the client.
   *
   * @example
   * // Plain backup
   * await backupRestoreApi.downloadBackup();
   *
   * // Encrypted backup
   * await backupRestoreApi.downloadBackup('my-secret-passphrase');
   */
  async downloadBackup(passphrase?: string): Promise<void> {
    const headers: Record<string, string> = {};
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

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition');
    const filename = disposition?.match(/filename="(.+)"/)?.[1] || 'krkn-backup.tar.gz';

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
   * Polls the status of an async restore job.
   * GET /restore/{jobId}
   */
  async getRestoreStatus(jobId: string): Promise<RestoreResponse> {
    return this.fetchJson<RestoreResponse>(`/restore/${encodeURIComponent(jobId)}`);
  }
}

export const backupRestoreApi = new BackupRestoreApi();
