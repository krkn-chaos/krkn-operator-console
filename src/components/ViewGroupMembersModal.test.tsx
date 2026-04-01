import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewGroupMembersModal } from './ViewGroupMembersModal';
import { groupsApi } from '../services/groupsApi';
import type { GroupMemberDetails } from '../types/api';

// Mock the services and hooks
vi.mock('../services/groupsApi');
vi.mock('../hooks', () => ({
  useNotifications: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

describe('ViewGroupMembersModal', () => {
  const mockMembers: GroupMemberDetails[] = [
    {
      userId: 'user1@example.com',
      name: 'John',
      surname: 'Doe',
      role: 'user',
    },
    {
      userId: 'user2@example.com',
      name: 'Jane',
      surname: 'Smith',
      role: 'admin',
    },
  ];

  const defaultProps = {
    groupName: 'test-group',
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display loading spinner initially', () => {
    vi.mocked(groupsApi.listGroupMembers).mockReturnValue(
      new Promise(() => {}) // Never resolves
    );

    render(<ViewGroupMembersModal {...defaultProps} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display group members in a table', async () => {
    vi.mocked(groupsApi.listGroupMembers).mockResolvedValue(mockMembers);

    render(<ViewGroupMembersModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('Doe')).toBeInTheDocument();
    });

    expect(screen.getByText('user2@example.com')).toBeInTheDocument();
    expect(screen.getByText('Jane')).toBeInTheDocument();
    expect(screen.getByText('Smith')).toBeInTheDocument();
  });

  it('should display empty state when group has no members', async () => {
    vi.mocked(groupsApi.listGroupMembers).mockResolvedValue([]);

    render(<ViewGroupMembersModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No Members')).toBeInTheDocument();
    });

    expect(
      screen.getByText('This group has no members yet. Click "Add Members" to add users to this group.')
    ).toBeInTheDocument();
  });

  it('should display error message on API failure', async () => {
    const errorMessage = 'Failed to fetch members';
    vi.mocked(groupsApi.listGroupMembers).mockRejectedValue(new Error(errorMessage));

    render(<ViewGroupMembersModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Error loading members')).toBeInTheDocument();
    });
  });

  it('should show confirmation dialog when removing a member', async () => {
    vi.mocked(groupsApi.listGroupMembers).mockResolvedValue(mockMembers);
    const user = userEvent.setup();

    render(<ViewGroupMembersModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    // Click the remove button for the first member
    const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
    await user.click(removeButtons[0]);

    // Confirmation modal should appear
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to remove/i)).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('should call removeGroupMember API when confirming removal', async () => {
    vi.mocked(groupsApi.listGroupMembers).mockResolvedValue(mockMembers);
    vi.mocked(groupsApi.removeGroupMember).mockResolvedValue({
      groupName: 'test-group',
      userId: 'user1@example.com',
      message: 'Member removed',
    });
    const user = userEvent.setup();

    render(<ViewGroupMembersModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    // Click remove button
    const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
    await user.click(removeButtons[0]);

    // Confirm removal
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to remove/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /Remove/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(groupsApi.removeGroupMember).toHaveBeenCalledWith('test-group', 'user1@example.com');
    });
  });

  it('should open AddMembersModal when Add Members button is clicked', async () => {
    vi.mocked(groupsApi.listGroupMembers).mockResolvedValue(mockMembers);
    const user = userEvent.setup();

    render(<ViewGroupMembersModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    const addMembersButton = screen.getByRole('button', { name: /Add Members/i });
    await user.click(addMembersButton);

    // AddMembersModal should appear
    await waitFor(() => {
      expect(screen.getByText(/Add Members to test-group/i)).toBeInTheDocument();
    });
  });

  it('should call onClose when Close button is clicked', async () => {
    vi.mocked(groupsApi.listGroupMembers).mockResolvedValue(mockMembers);
    const user = userEvent.setup();

    render(<ViewGroupMembersModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: /Close/i });
    await user.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
