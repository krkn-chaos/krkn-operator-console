import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Login } from '../Login';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { identityApi } from '../../services/identityApi';

vi.mock('../../context/AuthContext');
vi.mock('../../services/authService');
vi.mock('../../services/identityApi');

function renderLogin() {
  return render(<MemoryRouter initialEntries={['/login']}><Login /></MemoryRouter>);
}

describe('Login OIDC choices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      state: { isAuthenticated: false, user: null, loading: false },
      login: vi.fn(), logout: vi.fn(), register: vi.fn(), isAdmin: vi.fn(() => false),
    });
    vi.mocked(authService.isRegistered).mockResolvedValue(true);
  });

  it('shows the enabled provider route alongside local login', async () => {
    vi.mocked(identityApi.loginProviders).mockResolvedValue([{
      id: 'corp', type: 'keycloak', displayName: 'Corporate Keycloak',
      loginUrl: '/api/v1/auth/oidc/corp/login',
    }]);
    renderLogin();

    const provider = await screen.findByRole('link', { name: 'Log in with Corporate Keycloak' });
    expect(provider).toHaveAttribute('href', '/api/v1/auth/oidc/corp/login');
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    provider.addEventListener('click', event => event.preventDefault());
    fireEvent.click(provider);
    expect(authService.startExternalLogin).toHaveBeenCalledOnce();
  });

  it('keeps local login available when no external provider is discovered', async () => {
    vi.mocked(identityApi.loginProviders).mockResolvedValue([]);
    renderLogin();

    await waitFor(() => expect(identityApi.loginProviders).toHaveBeenCalledOnce());
    expect(screen.queryByRole('link', { name: /Log in with/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('offers a retry if provider discovery fails', async () => {
    vi.mocked(identityApi.loginProviders)
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce([{
        id: 'corp', type: 'keycloak', displayName: 'Corporate Keycloak',
        loginUrl: '/api/v1/auth/oidc/corp/login',
      }]);
    renderLogin();

    expect(await screen.findByText('External login options are unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('link', { name: 'Log in with Corporate Keycloak' })).toBeInTheDocument();
  });
});
