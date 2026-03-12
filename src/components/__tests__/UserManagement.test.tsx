import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserDetails } from '../../types/api';

// Mock usersApi - define mocks first
const mockListUsers = vi.fn();
const mockGetUser = vi.fn();
const mockCreateUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockDeleteUser = vi.fn();

vi.mock('../../services/usersApi', () => {
  return {
    usersApi: {
      listUsers: (...args: any[]) => mockListUsers(...args),
      getUser: (...args: any[]) => mockGetUser(...args),
      createUser: (...args: any[]) => mockCreateUser(...args),
      updateUser: (...args: any[]) => mockUpdateUser(...args),
      deleteUser: (...args: any[]) => mockDeleteUser(...args),
    },
  };
});

// Mock hooks
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}));

const mockIsAdmin = vi.fn(() => true);

vi.mock('../../hooks/useRole', () => ({
  useRole: () => ({
    isAdmin: mockIsAdmin(),
  }),
}));

const mockAuthState = {
  user: {
    userId: 'admin@example.com',
    role: 'admin',
  },
  isAuthenticated: true,
};

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    state: mockAuthState,
  }),
}));

// Import after mocking
const { UserManagement } = await import('../UserManagement');

describe('UserManagement', () => {
  const mockUsers: UserDetails[] = [
    {
      userId: 'user1@example.com',
      name: 'John',
      surname: 'Doe',
      role: 'admin',
      organization: 'Test Org',
      active: true,
      created: '2023-01-01T00:00:00Z',
      lastLogin: '2023-01-15T00:00:00Z',
    },
    {
      userId: 'user2@example.com',
      name: 'Jane',
      surname: 'Smith',
      role: 'user',
      organization: 'Another Org',
      active: true,
      created: '2023-02-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockReturnValue(true);
    mockAuthState.user = { userId: 'admin@example.com', role: 'admin' };
  });

  describe('Loading and Display', () => {
    it('should render loading state initially', () => {
      mockListUsers.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<UserManagement />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should display user list after loading', async () => {
      mockListUsers.mockResolvedValue(mockUsers);

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      expect(screen.getByText('Users (2)')).toBeInTheDocument();
    });

    it('should show empty state when no users', async () => {
      mockListUsers.mockResolvedValue([]);

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText(/no users found/i)).toBeInTheDocument();
      });
    });

    it('should show API unavailable message on error', async () => {
      mockListUsers.mockRejectedValue(new Error('Network error'));

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText(/users api not available/i)).toBeInTheDocument();
      });
    });
  });

  describe('Admin Permissions', () => {
    it('should show "Create User" button for admin', async () => {
      mockListUsers.mockResolvedValue(mockUsers);
      mockIsAdmin.mockReturnValue(true);

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
      });
    });

    it('should not show "Create User" button for non-admin', async () => {
      mockListUsers.mockResolvedValue(mockUsers);
      mockIsAdmin.mockReturnValue(false);

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /create user/i })).not.toBeInTheDocument();
      });
    });

    it('should show Edit and Delete buttons for admin', async () => {
      const user = userEvent.setup();
      mockListUsers.mockResolvedValue(mockUsers);
      mockIsAdmin.mockReturnValue(true);

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Open the first user's action menu
      const actionMenus = screen.getAllByRole('button', { name: /user actions/i });
      await user.click(actionMenus[0]);

      // Now the dropdown should be open and we can find Edit and Delete
      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument();
        expect(screen.getByText('Delete User')).toBeInTheDocument();
      });
    });

    it('should not show Edit and Delete buttons for non-admin', async () => {
      const user = userEvent.setup();
      mockListUsers.mockResolvedValue(mockUsers);
      mockIsAdmin.mockReturnValue(false);

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Open the first user's action menu
      const actionMenus = screen.getAllByRole('button', { name: /user actions/i });
      await user.click(actionMenus[0]);

      // Non-admin should only see View Details, not Edit/Delete
      await waitFor(() => {
        expect(screen.getByText('View Details')).toBeInTheDocument();
        expect(screen.queryByText('Edit Profile')).not.toBeInTheDocument();
        expect(screen.queryByText('Delete User')).not.toBeInTheDocument();
      });
    });
  });

  describe('Create User Workflow', () => {
    it('should open create form when Create User button clicked', async () => {
      const user = userEvent.setup();
      mockListUsers.mockResolvedValue(mockUsers);

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /create user/i }));

      expect(screen.getByText(/create new user/i)).toBeInTheDocument();
    });

    it.skip('should execute create and reload users on form submission', async () => {
      const userInteraction = userEvent.setup();
      mockListUsers.mockResolvedValue(mockUsers);
      mockCreateUser.mockResolvedValue({ userId: 'newuser@example.com' });

      const { container } = render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
      });

      // Open create form
      await userInteraction.click(screen.getByRole('button', { name: /create user/i }));

      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByText(/create new user/i)).toBeInTheDocument();
      });

      // Fill form - use container queries for password fields
      await userInteraction.type(screen.getByLabelText(/email/i), 'newuser@example.com');

      await waitFor(() => {
        expect(container.querySelector('#password')).toBeInTheDocument();
      });

      const passwordInput = container.querySelector('#password') as HTMLInputElement;
      const confirmInput = container.querySelector('#confirmPassword') as HTMLInputElement;
      await userInteraction.type(passwordInput, 'password123');
      await userInteraction.type(confirmInput, 'password123');
      await userInteraction.type(screen.getByLabelText(/first name/i), 'New');
      await userInteraction.type(screen.getByLabelText(/last name/i), 'User');

      // Submit
      const createButton = screen.getAllByRole('button', { name: /create user/i })[1]; // Second one is in modal
      await userInteraction.click(createButton);

      await waitFor(() => {
        expect(mockCreateUser).toHaveBeenCalled();
        expect(mockShowSuccess).toHaveBeenCalledWith(
          'User created',
          'User has been created successfully'
        );
      });

      // Should reload users
      expect(mockListUsers).toHaveBeenCalledTimes(2); // Initial load + reload
    });

    it.skip('should show error notification on create failure', async () => {
      const userInteraction = userEvent.setup();
      mockListUsers.mockResolvedValue(mockUsers);
      mockCreateUser.mockRejectedValue(new Error('Email already exists'));

      const { container } = render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
      });

      await userInteraction.click(screen.getByRole('button', { name: /create user/i }));

      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByText(/create new user/i)).toBeInTheDocument();
      });

      // Fill and submit form
      await userInteraction.type(screen.getByLabelText(/email/i), 'duplicate@example.com');

      await waitFor(() => {
        expect(container.querySelector('#password')).toBeInTheDocument();
      });

      const passwordInput = container.querySelector('#password') as HTMLInputElement;
      const confirmInput = container.querySelector('#confirmPassword') as HTMLInputElement;
      await userInteraction.type(passwordInput, 'password123');
      await userInteraction.type(confirmInput, 'password123');
      await userInteraction.type(screen.getByLabelText(/first name/i), 'Duplicate');
      await userInteraction.type(screen.getByLabelText(/last name/i), 'User');

      const createButton = screen.getAllByRole('button', { name: /create user/i })[1]; // Second one is in modal
      await userInteraction.click(createButton);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(
          'Failed to create user',
          'Email already exists'
        );
      });
    });
  });

  describe('Edit User Workflow', () => {
    it('should open edit form when Edit clicked', async () => {
      const user = userEvent.setup();
      mockListUsers.mockResolvedValue(mockUsers);

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Open first user's action menu
      const actionMenus = screen.getAllByRole('button', { name: /user actions/i });
      await user.click(actionMenus[0]);

      // Click Edit Profile
      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Edit Profile'));

      expect(screen.getByText(/edit user/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toHaveValue('user1@example.com');
    });

    it('should execute update and reload users on form submission', async () => {
      const user = userEvent.setup();
      mockListUsers.mockResolvedValue(mockUsers);
      mockUpdateUser.mockResolvedValue({ userId: 'user1@example.com' });

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Open first user's action menu and click Edit Profile
      const actionMenus = screen.getAllByRole('button', { name: /user actions/i });
      await user.click(actionMenus[0]);
      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Edit Profile'));

      // Update name
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Updated');

      // Submit
      await user.click(screen.getByRole('button', { name: /update user/i }));

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith('user1@example.com', expect.any(Object));
        expect(mockShowSuccess).toHaveBeenCalledWith(
          'User updated',
          'User has been updated successfully'
        );
      });

      // Should reload users
      expect(mockListUsers).toHaveBeenCalledTimes(2);
    });
  });

  describe('Delete User Workflow', () => {
    it.skip('should open delete confirmation when Delete clicked', async () => {
      const userInteraction = userEvent.setup();
      mockListUsers.mockResolvedValue(mockUsers);
      // Set authenticated user to a different user than the ones in the list
      mockAuthState.user = { userId: 'other-admin@example.com', role: 'admin' };

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /delete/i }).length).toBeGreaterThan(0);
      });

      // Click delete on the second user (not an admin)
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await userInteraction.click(deleteButtons[1]); // Delete user2 (not admin)

      await waitFor(() => {
        expect(screen.getByText(/delete user/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/are you sure you want to delete user/i)).toBeInTheDocument();
    });

    it('should execute deletion after confirmation', async () => {
      const user = userEvent.setup();
      mockListUsers.mockResolvedValue(mockUsers);
      mockDeleteUser.mockResolvedValue({ userId: 'user2@example.com' });
      mockAuthState.user = { userId: 'other-admin@example.com', role: 'admin' };

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // Open second user's action menu (Jane Smith)
      const actionMenus = screen.getAllByRole('button', { name: /user actions/i });
      await user.click(actionMenus[1]);

      // Click Delete User
      await waitFor(() => {
        expect(screen.getByText('Delete User')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Delete User'));

      // Confirm deletion
      const modal = screen.getByRole('dialog');
      const confirmButton = within(modal).getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteUser).toHaveBeenCalledWith('user2@example.com');
        expect(mockShowSuccess).toHaveBeenCalledWith(
          'User deleted',
          expect.stringContaining('Jane Smith')
        );
      });

      // Should reload users
      expect(mockListUsers).toHaveBeenCalledTimes(2);
    });

    it('should prevent deleting yourself', async () => {
      const user = userEvent.setup();
      mockListUsers.mockResolvedValue(mockUsers);
      mockAuthState.user = { userId: 'user1@example.com', role: 'admin' };

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Open first user's action menu (yourself)
      const actionMenus = screen.getAllByRole('button', { name: /user actions/i });
      await user.click(actionMenus[0]);

      // Click Delete User
      await waitFor(() => {
        expect(screen.getByText('Delete User')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Delete User'));

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(
          'Cannot delete yourself',
          'You cannot delete your own account'
        );
      });

      // Should not show confirmation modal
      expect(screen.queryByText(/are you sure you want to delete user/i)).not.toBeInTheDocument();
    });

    it('should prevent deleting last admin', async () => {
      const user = userEvent.setup();
      const onlyAdminUsers = [mockUsers[0]]; // Only one admin
      mockListUsers.mockResolvedValue(onlyAdminUsers);

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Open the only user's action menu
      const actionMenu = screen.getByRole('button', { name: /user actions/i });
      await user.click(actionMenu);

      // Click Delete User
      await waitFor(() => {
        expect(screen.getByText('Delete User')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Delete User'));

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(
          'Cannot delete last admin',
          'At least one admin must exist'
        );
      });
    });
  });

  describe('View User Details', () => {
    it('should show user details when View Details clicked', async () => {
      const userInteraction = userEvent.setup();
      mockListUsers.mockResolvedValue(mockUsers);

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Open first user's action menu
      const actionMenus = screen.getAllByRole('button', { name: /user actions/i });
      await userInteraction.click(actionMenus[0]);

      // Click View Details
      await waitFor(() => {
        expect(screen.getByText('View Details')).toBeInTheDocument();
      });
      await userInteraction.click(screen.getByText('View Details'));

      expect(screen.getByText(/user details/i)).toBeInTheDocument();
      // Text appears multiple times (in list + modal), so use getAllByText
      expect(screen.getAllByText('user1@example.com').length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle API failures gracefully', async () => {
      mockListUsers.mockRejectedValue(new Error('Network error'));

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText(/users api not available/i)).toBeInTheDocument();
      });

      // Should not crash
      expect(screen.queryByText(/john doe/i)).not.toBeInTheDocument();
    });

    it('should show error on delete failure', async () => {
      const user = userEvent.setup();
      mockListUsers.mockResolvedValue(mockUsers);
      mockDeleteUser.mockRejectedValue(new Error('Cannot delete user'));

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // Open second user's action menu
      const actionMenus = screen.getAllByRole('button', { name: /user actions/i });
      await user.click(actionMenus[1]);

      // Click Delete User
      await waitFor(() => {
        expect(screen.getByText('Delete User')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Delete User'));

      const modal = screen.getByRole('dialog');
      const confirmButton = within(modal).getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(
          'Failed to delete user',
          'Cannot delete user'
        );
      });
    });
  });
});
