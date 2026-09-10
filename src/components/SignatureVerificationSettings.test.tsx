import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignatureVerificationSettings } from './SignatureVerificationSettings';

const { mockGetSettings, mockUpdateSettings } = vi.hoisted(() => ({
  mockGetSettings: vi.fn(),
  mockUpdateSettings: vi.fn(),
}));

vi.mock('../services/signatureVerificationApi', () => ({
  signatureVerificationApi: {
    getSettings: mockGetSettings,
    updateSettings: mockUpdateSettings,
  },
}));

describe('SignatureVerificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue({ enabled: false });
    mockUpdateSettings.mockImplementation(async (enabled: boolean) => ({ enabled }));
  });

  it('loads and displays the disabled state', async () => {
    render(<SignatureVerificationSettings />);

    const toggle = await screen.findByRole('checkbox', { name: 'Require valid image signatures' });
    expect(toggle).not.toBeChecked();
    expect(mockGetSettings).toHaveBeenCalledTimes(1);
  });

  it('requires confirmation before disabling and does not update when cancelled', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue({ enabled: true });
    render(<SignatureVerificationSettings />);

    await user.click(await screen.findByRole('checkbox', { name: 'Require valid image signatures' }));
    expect(screen.getByText('Disable image signature verification?')).toBeInTheDocument();
    expect(mockUpdateSettings).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockUpdateSettings).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Require valid image signatures' })).toBeChecked();
  });

  it('updates after explicit disable confirmation', async () => {
    const user = userEvent.setup();
    mockGetSettings.mockResolvedValue({ enabled: true });
    render(<SignatureVerificationSettings />);

    await user.click(await screen.findByRole('checkbox', { name: 'Require valid image signatures' }));
    await user.click(screen.getByRole('button', { name: 'Disable verification' }));

    await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalledWith(false));
    expect(screen.getByRole('checkbox', { name: 'Require valid image signatures' })).not.toBeChecked();
  });

  it('updates immediately when enabling verification', async () => {
    const user = userEvent.setup();
    render(<SignatureVerificationSettings />);

    const toggle = await screen.findByRole('checkbox', { name: 'Require valid image signatures' });
    await user.click(toggle);

    await waitFor(() => expect(mockUpdateSettings).toHaveBeenCalledWith(true));
  });

  it('keeps the server state and shows an error when updating fails', async () => {
    mockUpdateSettings.mockRejectedValue(new Error('Forbidden'));
    mockGetSettings.mockResolvedValue({ enabled: true });
    const user = userEvent.setup();
    render(<SignatureVerificationSettings />);

    const toggle = await screen.findByRole('checkbox', { name: 'Require valid image signatures' });
    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Disable verification' }));

    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
    expect(toggle).toBeChecked();
  });
});
