import { useState, useEffect } from 'react';
import {
  Modal,
  ModalVariant,
  Button,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
  Title,
  Spinner,
  Alert,
  Bullseye,
  Checkbox,
  FormGroup,
  Form,
  HelperText,
  HelperTextItem,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  Label,
} from '@patternfly/react-core';
import { UsersIcon } from '@patternfly/react-icons';
import { groupsApi } from '../services/groupsApi';
import { usersApi } from '../services/usersApi';
import { useNotifications } from '../hooks';
import type { GroupMemberDetails, UserDetails } from '../types/api';

/**
 * AddMembersModal component props
 */
interface AddMembersModalProps {
  /**
   * The name of the group to add members to
   */
  groupName: string;
  /**
   * Current members of the group (to filter them out)
   */
  currentMembers: GroupMemberDetails[];
  /**
   * Whether the modal is open
   */
  isOpen: boolean;
  /**
   * Close handler for the modal
   */
  onClose: () => void;
  /**
   * Success callback after members are added
   */
  onSuccess: () => void;
}

/**
 * AddMembersModal component
 *
 * Displays a modal for adding new members to a group. Shows all available
 * users (excluding current members) with multi-select checkboxes.
 *
 * **Features:**
 * - Fetch all users from the system
 * - Filter out users who are already members
 * - Multi-select interface with checkboxes
 * - Bulk add operation with progress indication
 * - Sequential API calls for each selected user
 * - Success/error notifications for each operation
 * - Empty state when no users are available
 *
 * **API Integration:**
 * - Fetches all users via `usersApi.listUsers()`
 * - Adds members via `groupsApi.addGroupMember(groupName, userId)`
 * - Handles partial failures (some adds succeed, some fail)
 *
 * **User Experience:**
 * - Loading spinner during initial fetch
 * - Disabled state during submission
 * - Progress feedback during bulk operation
 * - Summary notification of results
 * - Modal closes automatically on full success
 *
 * **Edge Cases:**
 * - No users in system: Shows empty state
 * - All users already members: Shows empty state
 * - API errors: Shows error alert
 * - Partial failures: Shows summary with counts
 *
 * @component
 *
 * @param props - Component props
 * @param props.groupName - The group name to add members to
 * @param props.currentMembers - Existing group members (for filtering)
 * @param props.isOpen - Whether the modal is visible
 * @param props.onClose - Callback to close the modal
 * @param props.onSuccess - Callback after successful addition
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 * const [currentMembers, setCurrentMembers] = useState<GroupMemberDetails[]>([]);
 *
 * <AddMembersModal
 *   groupName="dev-team"
 *   currentMembers={currentMembers}
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={() => {
 *     setIsOpen(false);
 *     refreshMembers();
 *   }}
 * />
 * ```
 */
export function AddMembersModal({
  groupName,
  currentMembers,
  isOpen,
  onClose,
  onSuccess,
}: AddMembersModalProps) {
  const [allUsers, setAllUsers] = useState<UserDetails[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserDetails[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const { showSuccess, showError } = useNotifications();

  /**
   * Load all users and filter out current members
   */
  useEffect(() => {
    if (isOpen) {
      loadUsers();
    } else {
      // Reset state when modal closes
      setSelectedUserIds(new Set());
      setProgress(null);
      setError(null);
    }
  }, [isOpen, currentMembers]);

  /**
   * Fetch all users and filter out current members
   */
  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const users = await usersApi.listUsers();
      setAllUsers(users);

      // Filter out users who are already members
      const currentMemberIds = new Set(currentMembers.map((m) => m.userId));
      const available = users.filter((user) => !currentMemberIds.has(user.userId));
      setAvailableUsers(available);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load users';
      setError(errorMessage);
      showError('Failed to load users', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Toggle user selection
   */
  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  /**
   * Select/deselect all users
   */
  const handleToggleAll = () => {
    if (selectedUserIds.size === availableUsers.length) {
      // Deselect all
      setSelectedUserIds(new Set());
    } else {
      // Select all
      setSelectedUserIds(new Set(availableUsers.map((u) => u.userId)));
    }
  };

  /**
   * Submit: Add selected users to the group
   * Handles sequential API calls with progress indication
   */
  const handleSubmit = async () => {
    if (selectedUserIds.size === 0) return;

    setSubmitting(true);
    setProgress({ current: 0, total: selectedUserIds.size });

    const selectedIds = Array.from(selectedUserIds);
    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    // Add members sequentially (to avoid overwhelming the API)
    for (let i = 0; i < selectedIds.length; i++) {
      const userId = selectedIds[i];
      setProgress({ current: i + 1, total: selectedIds.length });

      try {
        await groupsApi.addGroupMember(groupName, userId);
        successCount++;
      } catch (err) {
        failureCount++;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${userId}: ${errorMessage}`);
      }
    }

    setSubmitting(false);
    setProgress(null);

    // Show summary notification
    if (failureCount === 0) {
      showSuccess(
        'Members added',
        `Successfully added ${successCount} member${successCount !== 1 ? 's' : ''} to ${groupName}`
      );
      onSuccess(); // Close modal and refresh parent
    } else if (successCount === 0) {
      showError(
        'Failed to add members',
        `All ${failureCount} member addition(s) failed. ${errors.slice(0, 3).join(', ')}`
      );
    } else {
      showSuccess(
        'Partially completed',
        `Added ${successCount} member(s), failed ${failureCount}. ${errors.slice(0, 2).join(', ')}`
      );
      onSuccess(); // Still refresh parent to show successful additions
    }
  };

  /**
   * Render modal actions
   */
  const actions = [
    <Button
      key="add"
      variant="primary"
      onClick={handleSubmit}
      isDisabled={selectedUserIds.size === 0 || submitting}
      isLoading={submitting}
    >
      {submitting
        ? `Adding ${progress?.current}/${progress?.total}...`
        : `Add Selected (${selectedUserIds.size})`}
    </Button>,
    <Button key="cancel" variant="link" onClick={onClose} isDisabled={submitting}>
      Cancel
    </Button>,
  ];

  return (
    <Modal
      variant={ModalVariant.large}
      title={`Add Members to ${groupName}`}
      isOpen={isOpen}
      onClose={onClose}
      actions={actions}
    >
      {loading ? (
        <Bullseye style={{ minHeight: '200px' }}>
          <Spinner size="xl" />
        </Bullseye>
      ) : error ? (
        <Alert variant="danger" title="Error loading users" isInline>
          {error}
        </Alert>
      ) : availableUsers.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon icon={UsersIcon} />
          <Title headingLevel="h2" size="lg">
            No Available Users
          </Title>
          <EmptyStateBody>
            {allUsers.length === 0
              ? 'There are no users in the system.'
              : 'All users are already members of this group.'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <Form>
          <FormGroup>
            <HelperText>
              <HelperTextItem>
                Select users to add to the group. Selected users will inherit the group's cluster
                permissions.
              </HelperTextItem>
            </HelperText>
          </FormGroup>

          <div style={{ marginBottom: '1rem' }}>
            <Checkbox
              id="select-all"
              label="Select all users"
              isChecked={
                selectedUserIds.size > 0 && selectedUserIds.size === availableUsers.length
              }
              onChange={handleToggleAll}
              isDisabled={submitting}
            />
          </div>

          <DataList aria-label="Available users list" isCompact>
            {availableUsers.map((user) => (
              <DataListItem key={user.userId}>
                <DataListItemRow>
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell key="checkbox" width={1}>
                        <Checkbox
                          id={`select-${user.userId}`}
                          aria-label={`Select ${user.name} ${user.surname}`}
                          isChecked={selectedUserIds.has(user.userId)}
                          onChange={() => handleToggleUser(user.userId)}
                          isDisabled={submitting}
                        />
                      </DataListCell>,
                      <DataListCell key="name" width={2}>
                        <div>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <strong style={{ fontSize: 'var(--pf-v5-global--FontSize--md)' }}>
                              {user.name} {user.surname}
                            </strong>
                          </div>
                          <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)', color: 'var(--pf-v5-global--Color--200)' }}>
                            {user.userId}
                          </div>
                        </div>
                      </DataListCell>,
                      <DataListCell key="role" width={1}>
                        <div>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <strong>Role:</strong>
                          </div>
                          <Label color={user.role === 'admin' ? 'blue' : 'green'}>
                            {user.role}
                          </Label>
                        </div>
                      </DataListCell>,
                      <DataListCell key="organization" width={1}>
                        <div>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <strong>Organization:</strong>
                          </div>
                          <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                            {user.organization || 'N/A'}
                          </div>
                        </div>
                      </DataListCell>,
                    ]}
                  />
                </DataListItemRow>
              </DataListItem>
            ))}
          </DataList>
        </Form>
      )}
    </Modal>
  );
}
