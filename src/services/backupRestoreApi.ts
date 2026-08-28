import { BaseApiClient } from '../utils/apiClient';

const API_BASE = '/api/v1';

export interface BackupRequest {
  backupName?: string;
}

export interface BackupResponse {
  jobId: string;
  message: string;
}

export interface RestoreRequest {
  backupPath: string;
}

export interface RestoreResponse {
  jobId: string;
  message: string;
}

class BackupRestoreApi extends BaseApiClient {
  constructor() {
    super(API_BASE);
  }

  async startBackup(request?: BackupRequest): Promise<BackupResponse> {
    return this.fetchJson<BackupResponse>('/backup', {
      method: 'POST',
      body: JSON.stringify(request || {}),
    });
  }

  async startRestore(request: RestoreRequest): Promise<RestoreResponse> {
    return this.fetchJson<RestoreResponse>('/restore', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }
}

export const backupRestoreApi = new BackupRestoreApi();
