import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchJson = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  BaseApiClient: class {
    protected fetchJson(...args: unknown[]) {
      return mockFetchJson(...args);
    }
  },
}));

const { signatureVerificationApi } = await import('../signatureVerificationApi');

describe('signatureVerificationApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gets the current signature verification setting', async () => {
    mockFetchJson.mockResolvedValue({ enabled: true });

    await expect(signatureVerificationApi.getSettings()).resolves.toEqual({ enabled: true });
    expect(mockFetchJson).toHaveBeenCalledWith('/operator/signature-verification');
  });

  it('updates the setting with the enabled value', async () => {
    mockFetchJson.mockResolvedValue({ enabled: false });

    await expect(signatureVerificationApi.updateSettings(false)).resolves.toEqual({ enabled: false });
    expect(mockFetchJson).toHaveBeenCalledWith('/operator/signature-verification', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false }),
    });
  });

  it('propagates API errors', async () => {
    mockFetchJson.mockRejectedValue(new Error('Forbidden'));

    await expect(signatureVerificationApi.updateSettings(true)).rejects.toThrow('Forbidden');
  });
});
