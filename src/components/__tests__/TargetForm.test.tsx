import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TargetForm } from '../TargetForm';

describe('TargetForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fillKubeconfigForm = async (
    user: ReturnType<typeof userEvent.setup>,
    container: HTMLElement
  ) => {
    await user.type(screen.getByRole('textbox', { name: /cluster name/i }), 'my-cluster');
    await user.type(container.querySelector('#kubeconfig') as HTMLTextAreaElement, 'apiVersion: v1\nkind: Config');
  };

  const hasAlertInContainer = (container: HTMLElement) =>
    container.querySelector('.pf-v5-c-alert.pf-m-danger') !== null;

  describe('initial state', () => {
    it('does not show an error alert on initial render', () => {
      const { container } = render(<TargetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      expect(hasAlertInContainer(container)).toBe(false);
    });
  });

  describe('API error handling', () => {
    it('shows an inline alert with the error message when onSubmit rejects', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockRejectedValue(new Error('invalid kubeconfig format'));

      const { container } = render(<TargetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      await fillKubeconfigForm(user, container);
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid kubeconfig format/i)).toBeInTheDocument();
        expect(hasAlertInContainer(container)).toBe(true);
      });
    });

    it('does not call onCancel when onSubmit rejects (form stays open)', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockRejectedValue(new Error('server error'));

      const { container } = render(<TargetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      await fillKubeconfigForm(user, container);
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });

      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('shows a generic message when the rejection is not an Error instance', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockRejectedValue('plain string rejection');

      const { container } = render(<TargetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      await fillKubeconfigForm(user, container);
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(screen.getByText(/an unexpected error occurred/i)).toBeInTheDocument();
      });
    });

    it('clears the previous error alert on the next submission attempt', async () => {
      const user = userEvent.setup();
      mockOnSubmit
        .mockRejectedValueOnce(new Error('first error'))
        .mockResolvedValue(undefined);

      const { container } = render(<TargetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      await fillKubeconfigForm(user, container);

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/first error/i)).toBeInTheDocument();
      });

      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText(/first error/i)).not.toBeInTheDocument();
        expect(hasAlertInContainer(container)).toBe(false);
      });
    });

    it('clears a previous API error when the next submit fails client-side validation', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockRejectedValueOnce(new Error('api error'));

      const { container } = render(<TargetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      await fillKubeconfigForm(user, container);

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/api error/i)).toBeInTheDocument();
      });

      // Clear a required field so the next submit fails validation before reaching onSubmit
      await user.clear(screen.getByRole('textbox', { name: /cluster name/i }));
      await user.click(submitButton);

      await waitFor(() => {
        expect(hasAlertInContainer(container)).toBe(false);
      });
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    it('re-enables the submit button after onSubmit rejects', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockRejectedValue(new Error('server error'));

      const { container } = render(<TargetForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      await fillKubeconfigForm(user, container);

      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });
});
