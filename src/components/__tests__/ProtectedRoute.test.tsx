import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';
import { useAuth } from '../../context/AuthContext';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

describe('ProtectedRoute OIDC access', () => {
  it('shows no-groups guidance and reports logout failure', async () => {
    const logout = vi.fn().mockRejectedValue(new Error('server unavailable'));
    vi.mocked(useAuth).mockReturnValue({
      state: { loading: false, isAuthenticated: true, user: { userId: 'oidc-1', name: 'Alice', surname: '', role: 'user', provider: 'corp', groups: [] } },
      logout, login: vi.fn(), register: vi.fn(), isAdmin: vi.fn(),
    });
    render(<MemoryRouter><ProtectedRoute><span>Private content</span></ProtectedRoute></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'No groups assigned' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh access' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByText(/Logout failed\. Your session is still active/)).toBeInTheDocument();
    expect(screen.queryByText('Private content')).not.toBeInTheDocument();
  });

  it('renders the page when at least one external group is mapped', () => {
    vi.mocked(useAuth).mockReturnValue({
      state: { loading: false, isAuthenticated: true, user: { userId: 'oidc-1', name: 'Alice', surname: '', role: 'user', provider: 'corp', groups: ['Operators'] } },
      logout: vi.fn(), login: vi.fn(), register: vi.fn(), isAdmin: vi.fn(),
    });
    render(<MemoryRouter><ProtectedRoute><span>Private content</span></ProtectedRoute></MemoryRouter>);
    expect(screen.getByText('Private content')).toBeInTheDocument();
  });
});
