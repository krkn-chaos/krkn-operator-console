import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { TargetsList } from '../TargetsList';
import { targetsApi } from '../../services/targetsApi';
import { useNotifications } from '../../hooks/useNotifications';

vi.mock('../../services/targetsApi');
vi.mock('../../hooks/useNotifications');

describe('TargetsList', () => {
  const mockShowSuccess = vi.fn();
  const mockShowError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useNotifications).mockReturnValue({
      showNotification: vi.fn(),
      showSuccess: mockShowSuccess,
      showError: mockShowError,
      showInfo: vi.fn(),
      showWarning: vi.fn(),
      hideNotification: vi.fn(),
    });

    vi.mocked(targetsApi.listTargets).mockResolvedValue([]);
  });

  describe('form submission errors', () => {
    it('does not call showError when target creation fails', async () => {
      const user = userEvent.setup();
      vi.mocked(targetsApi.createTarget).mockRejectedValue(new Error('invalid kubeconfig'));

      render(<TargetsList />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add target/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add target/i }));

      const clusterNameInput = await screen.findByRole('textbox', { name: /cluster name/i });
      await user.type(clusterNameInput, 'test-cluster');

      const kubeconfigArea = document.querySelector('#kubeconfig') as HTMLTextAreaElement;
      await user.type(kubeconfigArea, 'apiVersion: v1\nkind: Config');

      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => {
        expect(targetsApi.createTarget).toHaveBeenCalled();
      });

      expect(mockShowError).not.toHaveBeenCalled();
    });

    it('does not call showError when target update fails', async () => {
      const user = userEvent.setup();
      vi.mocked(targetsApi.listTargets).mockResolvedValue([
        {
          uuid: 'abc-123',
          clusterName: 'existing-cluster',
          clusterAPIURL: 'https://api.example.com:6443',
          secretType: 'kubeconfig',
          ready: true,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ]);
      vi.mocked(targetsApi.updateTarget).mockRejectedValue(new Error('update failed'));

      render(<TargetsList />);

      await waitFor(() => {
        expect(screen.getByText('existing-cluster')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit/i }));

      // Kubeconfig is not pre-filled in edit mode — fill it to pass client-side validation
      const kubeconfigArea = document.querySelector('#kubeconfig') as HTMLTextAreaElement;
      await user.type(kubeconfigArea, 'apiVersion: v1\nkind: Config');

      await user.click(screen.getByRole('button', { name: /update/i }));

      await waitFor(() => {
        expect(targetsApi.updateTarget).toHaveBeenCalled();
      });

      expect(mockShowError).not.toHaveBeenCalled();
    });
  });
});
