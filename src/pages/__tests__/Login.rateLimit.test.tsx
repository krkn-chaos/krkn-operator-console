import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Login } from '../Login';
import { RateLimitError } from '../../types/auth';

vi.mock('../../context/AuthContext');
vi.mock('../../services/authService');

import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Login />
    </MemoryRouter>,
  );
}

describe('Login - rate limit handling', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      state: { isAuthenticated: false, user: null, loading: false },
      login: mockLogin,
      logout: vi.fn(),
      register: vi.fn(),
      isAdmin: vi.fn(() => false),
    });

    vi.mocked(authService.isRegistered).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show rate-limit message and disabled button on login 429', async () => {
    mockLogin.mockRejectedValue(new RateLimitError());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderLogin();

    // PatternFly LoginForm uses specific IDs for inputs
    const emailInput = document.getElementById('pf-login-username-id') as HTMLInputElement;
    const passwordInput = document.getElementById('pf-login-password-id') as HTMLInputElement;

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText('Too many attempts. Please wait and try again.')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /please wait \(5s\)/i })).toBeDisabled();
  });

  it('should re-enable button after cooldown expires', async () => {
    mockLogin.mockRejectedValue(new RateLimitError());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderLogin();

    const emailInput = document.getElementById('pf-login-username-id') as HTMLInputElement;
    const passwordInput = document.getElementById('pf-login-password-id') as HTMLInputElement;

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /please wait/i })).toBeDisabled();
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled();
    });
  });

  it('should show rate-limit message when isRegistered check returns 429', async () => {
    vi.mocked(authService.isRegistered).mockRejectedValue(new RateLimitError());

    renderLogin();

    await waitFor(() => {
      expect(screen.getByText('Too many attempts. Please wait and try again.')).toBeInTheDocument();
    });
  });
});
