/**
 * EditGroupModal Component Tests
 *
 * Tests for the EditGroupModal component including:
 * - Loading state
 * - Form rendering with pre-populated data
 * - Validation
 * - Submit handling
 * - Error handling
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditGroupModal } from './EditGroupModal';
import { groupsApi } from '../services/groupsApi';
import { targetsApi } from '../services/targetsApi';
import type { GroupDetails, TargetResponse } from '../types/api';

// Mock the API modules
vi.mock('../services/groupsApi');
vi.mock('../services/targetsApi');

const mockGroupsApi = groupsApi as vi.Mocked<typeof groupsApi>;
const mockTargetsApi = targetsApi as vi.Mocked<typeof targetsApi>;

describe('EditGroupModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  const mockGroupData: GroupDetails = {
    name: 'test-group',
    description: 'Test group description',
    clusterPermissions: {
      'https://api.cluster1.example.com': { actions: ['view', 'run'] },
      'https://api.cluster2.example.com': { actions: ['view'] },
    },
    memberCount: 5,
  };

  const mockTargets: TargetResponse[] = [
    {
      uuid: 'target-1',
      clusterName: 'cluster1',
      clusterAPIURL: 'https://api.cluster1.example.com',
      secretType: 'token',
      ready: true,
    },
    {
      uuid: 'target-2',
      clusterName: 'cluster2',
      clusterAPIURL: 'https://api.cluster2.example.com',
      secretType: 'token',
      ready: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGroupsApi.getGroup.mockResolvedValue(mockGroupData);
    mockTargetsApi.listTargets.mockResolvedValue(mockTargets);
  });

  it('should display loading state initially', async () => {
    render(
      <EditGroupModal
        isOpen={true}
        onClose={mockOnClose}
        groupName="test-group"
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText(/Loading group data/i)).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/Loading group data/i)).not.toBeInTheDocument();
    });
  });

  it('should fetch group data and targets when modal opens', async () => {
    render(
      <EditGroupModal
        isOpen={true}
        onClose={mockOnClose}
        groupName="test-group"
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(mockGroupsApi.getGroup).toHaveBeenCalledWith('test-group');
      expect(mockTargetsApi.listTargets).toHaveBeenCalled();
    });
  });

  it('should render form with pre-populated data after loading', async () => {
    render(
      <EditGroupModal
        isOpen={true}
        onClose={mockOnClose}
        groupName="test-group"
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('test-group')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test group description')).toBeInTheDocument();
    });

    // Name field should be disabled
    const nameInput = screen.getByDisplayValue('test-group') as HTMLInputElement;
    expect(nameInput).toBeDisabled();
  });

  it('should display error when group fetch fails', async () => {
    mockGroupsApi.getGroup.mockRejectedValue(new Error('Group not found'));

    render(
      <EditGroupModal
        isOpen={true}
        onClose={mockOnClose}
        groupName="test-group"
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed to Load Group/i)).toBeInTheDocument();
      expect(screen.getByText(/Group not found/i)).toBeInTheDocument();
    });
  });

  it('should reset state when modal closes and reopens', async () => {
    const { rerender } = render(
      <EditGroupModal
        isOpen={true}
        onClose={mockOnClose}
        groupName="test-group"
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('test-group')).toBeInTheDocument();
    });

    // Close modal
    rerender(
      <EditGroupModal
        isOpen={false}
        onClose={mockOnClose}
        groupName="test-group"
        onSuccess={mockOnSuccess}
      />
    );

    // Reopen modal
    rerender(
      <EditGroupModal
        isOpen={true}
        onClose={mockOnClose}
        groupName="test-group"
        onSuccess={mockOnSuccess}
      />
    );

    // Should show loading again
    expect(screen.getByText(/Loading group data/i)).toBeInTheDocument();
  });

  it('should handle orphaned clusters (clusters in permissions but not in targets)', async () => {
    const groupWithOrphanedCluster: GroupDetails = {
      ...mockGroupData,
      clusterPermissions: {
        ...mockGroupData.clusterPermissions,
        'https://api.removed-cluster.example.com': { actions: ['view'] },
      },
    };

    mockGroupsApi.getGroup.mockResolvedValue(groupWithOrphanedCluster);

    render(
      <EditGroupModal
        isOpen={true}
        onClose={mockOnClose}
        groupName="test-group"
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Removed/i)).toBeInTheDocument();
      expect(screen.getByText('https://api.removed-cluster.example.com')).toBeInTheDocument();
    });
  });
});
