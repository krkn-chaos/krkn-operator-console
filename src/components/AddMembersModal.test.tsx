import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddMembersModal } from './AddMembersModal';
import { groupsApi } from '../services/groupsApi';
import { usersApi } from '../services/usersApi';
import type { GroupMemberDetails, UserDetails } from '../types/api';

// Mock the services and hooks
vi.mock('../services/groupsApi');
vi.mock('../services/usersApi');
vi.mock('../hooks', () => ({
  useNotifications: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

describe('AddMembersModal', () => {
  const mockCurrentMembers: GroupMemberDetails[] = [
    {
      userId: 'existing@example.com',
      name: 'Existing',
      surname: 'User',
      role: 'user',
    },
  ];

  const mockAllUsers: UserDetails[] = [
    {
      userId: 'existing@example.com',
      name: 'Existing',
      surname: 'User',
      role: 'user',
      active: true,
    },
    {
      userId: 'user1@example.com',
      name: 'John',
      surname: 'Doe',
      role: 'user',
      active: true,
    },
    {
      userId: 'user2@example.com',
      name: 'Jane',
      surname: 'Smith',
      role: 'admin',
      active: true,
    },
  ];

  const defaultProps = {
    groupName: 'test-group',
    currentMembers: mockCurrentMembers,
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display loading spinner initially', () => {
    vi.mocked(usersApi.listUsers).mockReturnValue(
      new Promise(() => {}) // Never resolves
    );

    render(<AddMembersModal {...defaultProps} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display available users (excluding current members)', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue(mockAllUsers);

    render(<AddMembersModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    expect(screen.getByText('user2@example.com')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    // Existing member should NOT be in the list
    expect(screen.queryByText('existing@example.com')).not.toBeInTheDocument();
  });

  it('should display empty state when all users are already members', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue([mockCurrentMembers[0] as UserDetails]);

    render(<AddMembersModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No Available Users')).toBeInTheDocument();
    });

    expect(screen.getByText('All users are already members of this group.')).toBeInTheDocument();
  });

  it('should display empty state when no users exist', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue([]);

    render(<AddMembersModal {...defaultProps} currentMembers={[]} />);

    await waitFor(() => {
      expect(screen.getByText('No Available Users')).toBeInTheDocument();
    });

    expect(screen.getByText('There are no users in the system.')).toBeInTheDocument();
  });

  it('should allow selecting and deselecting users', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue(mockAllUsers);
    const user = userEvent.setup();

    render(<AddMembersModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    });

    // Find checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    const user1Checkbox = checkboxes.find((cb) =>
      cb.getAttribute('id')?.includes('user1@example.com')
    )!;

    // Select user
    await user.click(user1Checkbox);
    expect(user1Checkbox).toBeChecked();

    // Deselect user
    await user.click(user1Checkbox);
    expect(user1Checkbox).not.toBeChecked();
  });

  it('should allow selecting all users', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue(mockAllUsers);
    const user = userEvent.setup();

    render(<AddMembersModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    });

    // Find the "select all" checkbox (first one)
    const selectAllCheckbox = screen.getByLabelText('Select all users');

    // Select all
    await user.click(selectAllCheckbox);

    const allCheckboxes = screen.getAllByRole('checkbox');
    // All individual checkboxes should be checked (excluding the select-all checkbox)
    allCheckboxes.slice(1).forEach((checkbox) => {
      expect(checkbox).toBeChecked();
    });

    // Deselect all
    await user.click(selectAllCheckbox);
    allCheckboxes.slice(1).forEach((checkbox) => {
      expect(checkbox).not.toBeChecked();
    });
  });

  it('should call addGroupMember API for each selected user', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue(mockAllUsers);
    vi.mocked(groupsApi.addGroupMember).mockResolvedValue({
      groupName: 'test-group',
      userId: 'user1@example.com',
      message: 'Member added',
    });
    const user = userEvent.setup();

    render(<AddMembersModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    });

    // Select a user
    const checkboxes = screen.getAllByRole('checkbox');
    const user1Checkbox = checkboxes.find((cb) =>
      cb.getAttribute('id')?.includes('user1@example.com')
    )!;
    await user.click(user1Checkbox);

    // Click Add Selected button
    const addButton = screen.getByRole('button', { name: /Add Selected \(1\)/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(groupsApi.addGroupMember).toHaveBeenCalledWith('test-group', 'user1@example.com');
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
  });

  it('should handle partial failures when adding multiple users', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue(mockAllUsers);
    vi.mocked(groupsApi.addGroupMember)
      .mockResolvedValueOnce({
        groupName: 'test-group',
        userId: 'user1@example.com',
        message: 'Member added',
      })
      .mockRejectedValueOnce(new Error('Failed to add user2'));
    const user = userEvent.setup();

    render(<AddMembersModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    });

    // Select both users
    const selectAllCheckbox = screen.getByLabelText('Select all users');
    await user.click(selectAllCheckbox);

    // Click Add Selected button
    const addButton = screen.getByRole('button', { name: /Add Selected \(2\)/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(groupsApi.addGroupMember).toHaveBeenCalledTimes(2);
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
  });

  it('should disable submit button when no users are selected', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue(mockAllUsers);

    render(<AddMembersModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /Add Selected \(0\)/i });
    expect(addButton).toBeDisabled();
  });

  it('should call onClose when Cancel button is clicked', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue(mockAllUsers);
    const user = userEvent.setup();

    render(<AddMembersModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
