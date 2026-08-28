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
   * POST /backup returns binary tar.gz streamed directly to the client.
   */
  async downloadBackup(): Promise<void> {
    const response = await this.fetch('/backup', { method: 'POST' });

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
   */
  async uploadRestore(file: File): Promise<RestoreResponse> {
    const formData = new FormData();
    formData.append('backup', file);

    const response = await this.fetch('/restore', {
      method: 'POST',
      body: formData,
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
