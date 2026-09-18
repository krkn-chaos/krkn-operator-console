import { BaseApiClient } from '../utils/apiClient';
import type {
  SignatureVerificationSettingsRequest,
  SignatureVerificationSettingsResponse,
} from '../types/api';

class SignatureVerificationApi extends BaseApiClient {
  constructor() {
    super('/api/v1');
  }

  async getSettings(): Promise<SignatureVerificationSettingsResponse> {
    return this.fetchJson<SignatureVerificationSettingsResponse>('/operator/signature-verification');
  }

  async updateSettings(enabled: boolean): Promise<SignatureVerificationSettingsResponse> {
    const request: SignatureVerificationSettingsRequest = { enabled };
    return this.fetchJson<SignatureVerificationSettingsResponse>('/operator/signature-verification', {
      method: 'PATCH',
      body: JSON.stringify(request),
    });
  }
}

export const signatureVerificationApi = new SignatureVerificationApi();
