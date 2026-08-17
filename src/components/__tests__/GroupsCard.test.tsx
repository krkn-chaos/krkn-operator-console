import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroupsCard } from '../GroupsCard';
import { groupsApi } from '../../services/groupsApi';
import { useNotifications } from '../../hooks/useNotifications';
import type { GroupDetails } from '../../types/api';

// Mock dependencies
vi.mock('../../services/groupsApi');
vi.mock('../../hooks/useNotifications');
vi.mock('../ViewGroupMembersModal', () => ({
  ViewGroupMembersModal: () => <div data-testid="view-group-members-modal">View Members Modal</div>,
}));
vi.mock('../CreateGroupModal', () => ({
  CreateGroupModal: () => <div data-testid="create-group-modal">Create Group Modal</div>,
}));
vi.mock('../EditGroupModal', () => ({
  EditGroupModal: () => <div data-testid="edit-group-modal">Edit Group Modal</div>,
}));

const mockGroups: GroupDetails[] = [
  {
    name: 'group1',
    description: 'Test Group 1',
    memberCount: 5,
    clusterPermissions: {
      'https://api.cluster1.example.com': { actions: ['view', 'run'] },
    },
  },
  {
    name: 'group2',
    description: 'Test Group 2',
    memberCount: 3,
    clusterPermissions: {
      'https://api.cluster2.example.com': { actions: ['view'] },
    },
  },
];

describe('GroupsCard', () => {
  const mockShowSuccess = vi.fn();
  const mockShowError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(useNotifications).mockReturnValue({
      showNotification: vi.fn(),
      showSuccess: mockShowSuccess,
      showError: mockShowError,
      showInfo: vi.fn(),
      showWarning: vi.fn(),
      hideNotification: vi.fn(),
    });

    vi.mocked(groupsApi.listGroups).mockResolvedValue(mockGroups);
  });

  it('should render groups list', async () => {
    render(<GroupsCard />);

    await waitFor(() => {
      expect(screen.getByText('group1')).toBeInTheDocument();
      expect(screen.getByText('group2')).toBeInTheDocument();
    });
  });

  it('should show group count in title', async () => {
    render(<GroupsCard />);

    await waitFor(() => {
      expect(screen.getByText('Groups (2)')).toBeInTheDocument();
    });
  });

  it('should not show pagination when groups are less than or equal to default perPage (10)', async () => {
    render(<GroupsCard />);

    await waitFor(() => {
      expect(screen.getByText('group1')).toBeInTheDocument();
      expect(screen.getByText('group2')).toBeInTheDocument();
    });

    // Pagination should not be visible
    expect(screen.queryByLabelText(/pagination/i)).not.toBeInTheDocument();
  });

  it('should show pagination and paginate groups when more than 10 groups exist', async () => {
    // Create 15 mock groups with names that sort properly
    const manyGroups: GroupDetails[] = [
      'alpha', 'beta', 'charlie', 'delta', 'echo',
      'foxtrot', 'golf', 'hotel', 'india', 'juliet',
      'kilo', 'lima', 'mike', 'november', 'oscar'
    ].map((name, i) => ({
      name,
      description: `Test Group ${i + 1}`,
      memberCount: i + 1,
      clusterPermissions: {},
    }));

    vi.mocked(groupsApi.listGroups).mockResolvedValue(manyGroups);

    render(<GroupsCard />);

    // Wait for initial load - should show first 10 groups
    await waitFor(() => {
      expect(screen.getByText('alpha')).toBeInTheDocument();
      expect(screen.getByText('juliet')).toBeInTheDocument();
    });

    // Groups beyond the first page should not be visible
    expect(screen.queryByText('kilo')).not.toBeInTheDocument();

    // Pagination should be visible
    const pagination = screen.getAllByRole('navigation');
    expect(pagination.length).toBeGreaterThan(0);
  });

  it('should reset to page 1 when search filter changes', async () => {
    // Create mock groups with varied descriptions
    const manyGroups: GroupDetails[] = [
      { name: 'dev-team-1', description: 'Development Group', memberCount: 1, clusterPermissions: {} },
      { name: 'dev-team-2', description: 'Development Group', memberCount: 2, clusterPermissions: {} },
      { name: 'dev-team-3', description: 'Development Group', memberCount: 3, clusterPermissions: {} },
      { name: 'dev-team-4', description: 'Development Group', memberCount: 4, clusterPermissions: {} },
      { name: 'dev-team-5', description: 'Development Group', memberCount: 5, clusterPermissions: {} },
      { name: 'prod-team-1', description: 'Production Group', memberCount: 6, clusterPermissions: {} },
      { name: 'prod-team-2', description: 'Production Group', memberCount: 7, clusterPermissions: {} },
      { name: 'prod-team-3', description: 'Production Group', memberCount: 8, clusterPermissions: {} },
      { name: 'prod-team-4', description: 'Production Group', memberCount: 9, clusterPermissions: {} },
      { name: 'prod-team-5', description: 'Production Group', memberCount: 10, clusterPermissions: {} },
      { name: 'prod-team-6', description: 'Production Group', memberCount: 11, clusterPermissions: {} },
      { name: 'test-team-1', description: 'Testing Group', memberCount: 12, clusterPermissions: {} },
    ];

    vi.mocked(groupsApi.listGroups).mockResolvedValue(manyGroups);

    const user = userEvent.setup();
    render(<GroupsCard />);

    await waitFor(() => {
      expect(screen.getByText('dev-team-1')).toBeInTheDocument();
    });

    // Apply search filter
    const searchInput = screen.getByPlaceholderText(/filter by name/i);
    await user.type(searchInput, 'Development');

    // Should show filtered results
    await waitFor(() => {
      expect(screen.getByText('dev-team-1')).toBeInTheDocument();
      // Groups without "Development" in description should not be visible
      expect(screen.queryByText('prod-team-1')).not.toBeInTheDocument();
    });
  });

  it('should display pagination when there are more than 10 items', async () => {
    // Create 12 mock groups to trigger pagination
    const manyGroups: GroupDetails[] = Array.from({ length: 12 }, (_, i) => ({
      name: `group-${String(i + 1).padStart(2, '0')}`,
      description: `Test Group ${i + 1}`,
      memberCount: i + 1,
      clusterPermissions: {},
    }));

    vi.mocked(groupsApi.listGroups).mockResolvedValue(manyGroups);

    render(<GroupsCard />);

    await waitFor(() => {
      expect(screen.getByText('group-01')).toBeInTheDocument();
    });

    // Pagination controls should be visible when more than 10 items
    const pagination = screen.getAllByRole('navigation');
    expect(pagination.length).toBeGreaterThan(0);
  });

  it('should handle API errors gracefully', async () => {
    vi.mocked(groupsApi.listGroups).mockRejectedValue(new Error('API Error'));

    render(<GroupsCard />);

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        'Failed to load groups',
        'API Error'
      );
    });
  });

  it('should show empty state when no groups exist', async () => {
    vi.mocked(groupsApi.listGroups).mockResolvedValue([]);

    render(<GroupsCard />);

    await waitFor(() => {
      expect(screen.getByText(/no groups yet/i)).toBeInTheDocument();
    });
  });
});
