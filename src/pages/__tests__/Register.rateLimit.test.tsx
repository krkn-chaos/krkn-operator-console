import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Register } from '../Register';
import { RateLimitError } from '../../types/auth';

vi.mock('../../context/AuthContext');

import { useAuth } from '../../context/AuthContext';

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Register />
    </MemoryRouter>,
  );
}

describe('Register - rate limit handling', () => {
  const mockRegister = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      state: { isAuthenticated: false, user: null, loading: false },
      login: vi.fn(),
      logout: vi.fn(),
      register: mockRegister,
      isAdmin: vi.fn(() => false),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show rate-limit message and disabled button on register 429', async () => {
    mockRegister.mockRejectedValue(new RateLimitError());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderRegister();

    // Use element IDs defined in the Register component
    const emailInput = document.getElementById('register-email') as HTMLInputElement;
    const nameInput = document.getElementById('register-name') as HTMLInputElement;
    const surnameInput = document.getElementById('register-surname') as HTMLInputElement;
    const passwordInput = document.getElementById('register-password') as HTMLInputElement;
    const confirmPasswordInput = document.getElementById('register-confirm-password') as HTMLInputElement;

    await user.type(emailInput, 'admin@example.com');
    await user.type(nameInput, 'Admin');
    await user.type(surnameInput, 'User');
    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123');
    await user.click(screen.getByRole('button', { name: /create admin account/i }));

    await waitFor(() => {
      expect(screen.getByText('Too many attempts. Please wait and try again.')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /please wait \(5s\)/i })).toBeDisabled();
  });

  it('should re-enable button after cooldown expires', async () => {
    mockRegister.mockRejectedValue(new RateLimitError());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderRegister();

    const emailInput = document.getElementById('register-email') as HTMLInputElement;
    const nameInput = document.getElementById('register-name') as HTMLInputElement;
    const surnameInput = document.getElementById('register-surname') as HTMLInputElement;
    const passwordInput = document.getElementById('register-password') as HTMLInputElement;
    const confirmPasswordInput = document.getElementById('register-confirm-password') as HTMLInputElement;

    await user.type(emailInput, 'admin@example.com');
    await user.type(nameInput, 'Admin');
    await user.type(surnameInput, 'User');
    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123');
    await user.click(screen.getByRole('button', { name: /create admin account/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /please wait/i })).toBeDisabled();
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create admin account/i })).toBeEnabled();
    });
  });
});
