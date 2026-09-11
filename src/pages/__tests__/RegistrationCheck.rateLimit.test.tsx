import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RegistrationCheck } from '../RegistrationCheck';
import { RateLimitError } from '../../types/auth';

vi.mock('../../context/AuthContext');
vi.mock('../../services/authService');

import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';

function renderRegistrationCheck() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <RegistrationCheck />
    </MemoryRouter>,
  );
}

describe('RegistrationCheck - rate limit handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      state: { isAuthenticated: false, user: null, loading: false },
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      isAdmin: vi.fn(() => false),
    });
  });

  it('should show rate-limit title and message on 429', async () => {
    vi.mocked(authService.isRegistered).mockRejectedValue(new RateLimitError());

    renderRegistrationCheck();

    await waitFor(() => {
      expect(screen.getByText('Too Many Requests')).toBeInTheDocument();
    });

    expect(screen.getByText('Too many requests. Please wait a moment and refresh the page.')).toBeInTheDocument();
    expect(screen.queryByText('Please check that the backend server is running.')).not.toBeInTheDocument();
  });

  it('should show connection error title on non-429 error', async () => {
    vi.mocked(authService.isRegistered).mockRejectedValue(new Error('Network failure'));

    renderRegistrationCheck();

    await waitFor(() => {
      expect(screen.getByText('Connection Error')).toBeInTheDocument();
    });

    expect(screen.getByText('Network failure')).toBeInTheDocument();
    expect(screen.getByText('Please check that the backend server is running.')).toBeInTheDocument();
  });
});
