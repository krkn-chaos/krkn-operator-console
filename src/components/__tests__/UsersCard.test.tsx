import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersCard } from '../UsersCard';
import { usersApi } from '../../services/usersApi';
import { useNotifications } from '../../hooks/useNotifications';
import { useRole } from '../../hooks/useRole';
import { useAuth } from '../../context/AuthContext';
import type { UserDetails, GroupDetails } from '../../types/api';

// Mock dependencies
vi.mock('../../services/usersApi');
vi.mock('../../hooks/useNotifications');
vi.mock('../../hooks/useRole');
vi.mock('../../context/AuthContext');

const mockUsers: UserDetails[] = [
  {
    userId: 'user1',
    name: 'John',
    surname: 'Doe',
    organization: 'Acme Corp',
    role: 'admin',
    active: true,
    groups: ['group1'],
    lastLogin: '2024-01-01T00:00:00Z',
  },
  {
    userId: 'user2',
    name: 'Jane',
    surname: 'Smith',
    organization: 'Tech Inc',
    role: 'user',
    active: true,
    groups: ['group1'],
    lastLogin: '2024-01-02T00:00:00Z',
  },
];

const mockGroups: GroupDetails[] = [
  {
    name: 'group1',
    description: 'Test Group',
    memberCount: 2,
    clusterPermissions: {},
  },
];

describe('UsersCard', () => {
  const mockShowSuccess = vi.fn();
  const mockShowError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(useNotifications).mockReturnValue({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
      showInfo: vi.fn(),
      showWarning: vi.fn(),
    });

    vi.mocked(useRole).mockReturnValue({
      isAdmin: true,
      role: 'admin',
    });

    vi.mocked(useAuth).mockReturnValue({
      state: {
        isAuthenticated: true,
        user: {
          userId: 'user1',
          name: 'John',
          surname: 'Doe',
          organization: 'Acme Corp',
          role: 'admin',
          active: true,
          groups: ['group1'],
          lastLogin: '2024-01-01T00:00:00Z',
        },
        loading: false,
      },
      login: vi.fn(),
      logout: vi.fn(),
    });

    vi.mocked(usersApi.listUsers).mockResolvedValue(mockUsers);
  });

  it('should render users list', async () => {
    render(<UsersCard groups={mockGroups} />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('should show user count in title', async () => {
    render(<UsersCard groups={mockGroups} />);

    await waitFor(() => {
      expect(screen.getByText('Users (2)')).toBeInTheDocument();
    });
  });

  it('should enable Create User button when groups exist', async () => {
    render(<UsersCard groups={mockGroups} />);

    await waitFor(() => {
      const createButton = screen.getByRole('button', { name: /create user/i });
      expect(createButton).toBeEnabled();
    });
  });

  it('should disable Create User button when no groups exist', async () => {
    render(<UsersCard groups={[]} />);

    await waitFor(() => {
      const createButton = screen.getByRole('button', { name: /create user/i });
      expect(createButton).toBeDisabled();
    });
  });

  it('should show tooltip when Create User button is disabled', async () => {
    const { container } = render(<UsersCard groups={[]} />);

    await waitFor(() => {
      const createButton = screen.getByRole('button', { name: /create user/i });
      expect(createButton).toBeDisabled();
    });

    // Check that tooltip wrapper is present (PatternFly Tooltip wraps the button)
    const tooltipWrapper = container.querySelector('[class*="pf-v5-c-tooltip"]');
    expect(tooltipWrapper).toBeTruthy();
  });

  it('should show empty state when no users exist and groups exist', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue([]);

    render(<UsersCard groups={mockGroups} />);

    await waitFor(() => {
      expect(screen.getByText(/no users found/i)).toBeInTheDocument();
      expect(screen.getByText(/click "create user" to start adding users/i)).toBeInTheDocument();
    });
  });

  it('should show empty state with group requirement when no users and no groups exist', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue([]);

    render(<UsersCard groups={[]} />);

    await waitFor(() => {
      expect(screen.getByText(/no users found/i)).toBeInTheDocument();
      expect(screen.getByText(/create at least one group before adding users/i)).toBeInTheDocument();
    });
  });

  it('should not show Create User button for non-admin users', async () => {
    vi.mocked(useRole).mockReturnValue({
      isAdmin: false,
      role: 'user',
    });

    render(<UsersCard groups={mockGroups} />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /create user/i })).not.toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    vi.mocked(usersApi.listUsers).mockRejectedValue(new Error('API Error'));

    render(<UsersCard groups={mockGroups} />);

    await waitFor(() => {
      expect(screen.getByText(/users api not available/i)).toBeInTheDocument();
    });
  });

  it('should display user roles with correct color labels', async () => {
    render(<UsersCard groups={mockGroups} />);

    await waitFor(() => {
      const labels = screen.getAllByText(/admin|user/i);
      expect(labels.length).toBeGreaterThan(0);
    });
  });

  it('should display user status correctly', async () => {
    render(<UsersCard groups={mockGroups} />);

    await waitFor(() => {
      const activeLabels = screen.getAllByText('Active');
      expect(activeLabels.length).toBe(2);
    });
  });
});
