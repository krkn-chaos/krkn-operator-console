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
import { operatorApi } from '../services/operatorApi';
import type { GroupDetails, TargetResponse, ClustersResponse } from '../types/api';

// Mock the API modules
vi.mock('../services/groupsApi');
vi.mock('../services/operatorApi');

describe('EditGroupModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  const mockGroupData: GroupDetails = {
    name: 'test-group',
    description: 'Test group description',
    clusterPermissions: {
      'https://api.cluster1.example.com': { actions: ['view', 'run'] },
      'https://api.cluster2.example.com': { actions: ['view'] },
    },
    memberCount: 5,
  };

  const mockClustersResponse: ClustersResponse = {
    targetData: {
      'krkn-operator': [
        {
          'cluster-name': 'cluster1',
          'cluster-api-url': 'https://api.cluster1.example.com',
        },
        {
          'cluster-name': 'cluster2',
          'cluster-api-url': 'https://api.cluster2.example.com',
        },
      ],
    },
    status: 'Completed',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(groupsApi).getGroup.mockResolvedValue(mockGroupData);

    // Mock cluster discovery flow
    vi.mocked(operatorApi).createTargetRequest.mockResolvedValue({ uuid: 'test-discovery-uuid' });
    vi.mocked(operatorApi).getTargetStatus.mockResolvedValue(200); // Ready immediately
    vi.mocked(operatorApi).getClusters.mockResolvedValue(mockClustersResponse);
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

    // Should show loading message (can be various messages depending on what's loading)
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByDisplayValue('test-group')).toBeInTheDocument();
    });
  });

  it('should fetch group data and start cluster discovery when modal opens', async () => {
    render(
      <EditGroupModal
        isOpen={true}
        onClose={mockOnClose}
        groupName="test-group"
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(vi.mocked(groupsApi).getGroup).toHaveBeenCalledWith('test-group');
      expect(vi.mocked(operatorApi).createTargetRequest).toHaveBeenCalled();
      expect(vi.mocked(operatorApi).getTargetStatus).toHaveBeenCalledWith('test-discovery-uuid');
      expect(vi.mocked(operatorApi).getClusters).toHaveBeenCalledWith('test-discovery-uuid');
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
    vi.mocked(groupsApi).getGroup.mockRejectedValue(new Error('Group not found'));

    render(
      <EditGroupModal
        isOpen={true}
        onClose={mockOnClose}
        groupName="test-group"
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed to Load/i)).toBeInTheDocument();
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

    // Should show loading again (any loading message)
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('should handle orphaned clusters (clusters in permissions but not in targets)', async () => {
    const groupWithOrphanedCluster: GroupDetails = {
      ...mockGroupData,
      clusterPermissions: {
        ...mockGroupData.clusterPermissions,
        'https://api.removed-cluster.example.com': { actions: ['view'] },
      },
    };

    vi.mocked(groupsApi).getGroup.mockResolvedValue(groupWithOrphanedCluster);

    render(
      <EditGroupModal
        isOpen={true}
        onClose={mockOnClose}
        groupName="test-group"
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Removed/i).length).toBeGreaterThan(0);
      expect(screen.getByText('https://api.removed-cluster.example.com')).toBeInTheDocument();
    });
  });
});
