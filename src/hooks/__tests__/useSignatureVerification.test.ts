import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSignatureVerification } from '../useSignatureVerification';

const { mockGetSettings, mockUpdateSettings } = vi.hoisted(() => ({
  mockGetSettings: vi.fn(),
  mockUpdateSettings: vi.fn(),
}));

vi.mock('../../services/signatureVerificationApi', () => ({
  signatureVerificationApi: {
    getSettings: mockGetSettings,
    updateSettings: mockUpdateSettings,
  },
}));

describe('useSignatureVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue({ enabled: true });
    mockUpdateSettings.mockImplementation(async (enabled: boolean) => ({ enabled }));
  });

  it('loads the setting and refreshes when the setting changes', async () => {
    const { result } = renderHook(() => useSignatureVerification());

    await waitFor(() => expect(result.current.enabled).toBe(true));
    expect(mockGetSettings).toHaveBeenCalledTimes(1);

    mockGetSettings.mockResolvedValue({ enabled: false });
    act(() => window.dispatchEvent(new Event('signature-verification-changed')));

    await waitFor(() => expect(result.current.enabled).toBe(false));
    expect(mockGetSettings).toHaveBeenCalledTimes(2);
  });

  it('updates the setting', async () => {
    const { result } = renderHook(() => useSignatureVerification());
    await waitFor(() => expect(result.current.enabled).toBe(true));

    mockGetSettings.mockResolvedValue({ enabled: false });
    await act(async () => {
      await result.current.updateSettings(false);
    });
    expect(mockUpdateSettings).toHaveBeenCalledWith(false);
    expect(result.current.enabled).toBe(false);
    await waitFor(() => expect(mockGetSettings).toHaveBeenCalledTimes(2));

  });

  it('exposes loading errors', async () => {
    mockGetSettings.mockRejectedValue(new Error('Forbidden'));
    const { result } = renderHook(() => useSignatureVerification());

    await waitFor(() => expect(result.current.error).toBe('Forbidden'));
  });
});
