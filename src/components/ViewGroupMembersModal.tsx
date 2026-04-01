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
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { UsersIcon, TrashIcon, PlusCircleIcon } from '@patternfly/react-icons';
import { groupsApi } from '../services/groupsApi';
import { useNotifications } from '../hooks';
import { AddMembersModal } from './AddMembersModal';
import type { GroupMemberDetails } from '../types/api';

/**
 * ViewGroupMembersModal component props
 */
interface ViewGroupMembersModalProps {
  /**
   * The name of the group to view members for
   */
  groupName: string;
  /**
   * Whether the modal is open
   */
  isOpen: boolean;
  /**
   * Close handler for the modal
   */
  onClose: () => void;
}

/**
 * ViewGroupMembersModal component
 *
 * Displays a modal showing all members of a specific group with the ability
 * to add or remove members. Only administrators can manage group membership.
 *
 * **Features:**
 * - View list of all group members
 * - Display user details: User ID (email), Name, Surname, Role
 * - Remove members with confirmation
 * - Add new members via nested AddMembersModal
 * - Real-time loading and error states
 * - Empty state when group has no members
 *
 * **API Integration:**
 * - Fetches members via `groupsApi.listGroupMembers(groupName)`
 * - Removes members via `groupsApi.removeGroupMember(groupName, userId)`
 * - Refreshes member list after add/remove operations
 *
 * **User Experience:**
 * - Loading spinner during initial fetch
 * - Confirmation before removing members
 * - Success/error toast notifications
 * - Disabled state during API operations
 *
 * @component
 *
 * @param props - Component props
 * @param props.groupName - The group name to display members for
 * @param props.isOpen - Whether the modal is visible
 * @param props.onClose - Callback to close the modal
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <ViewGroupMembersModal
 *   groupName="dev-team"
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 * />
 * ```
 */
export function ViewGroupMembersModal({
  groupName,
  isOpen,
  onClose,
}: ViewGroupMembersModalProps) {
  const [members, setMembers] = useState<GroupMemberDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const { showSuccess, showError } = useNotifications();

  /**
   * Load group members when modal opens
   */
  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen, groupName]);

  /**
   * Fetch group members from API
   */
  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await groupsApi.listGroupMembers(groupName);
      setMembers(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load members';
      setError(errorMessage);
      showError('Failed to load group members', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle remove member button click - shows confirmation
   */
  const handleRemoveClick = (userId: string, name: string, surname: string) => {
    setConfirmRemove({ userId, name: `${name} ${surname}` });
  };

  /**
   * Confirm and execute member removal
   */
  const handleConfirmRemove = async () => {
    if (!confirmRemove) return;

    setRemovingUserId(confirmRemove.userId);
    setConfirmRemove(null);

    try {
      await groupsApi.removeGroupMember(groupName, confirmRemove.userId);
      showSuccess(
        'Member removed',
        `${confirmRemove.name} has been removed from ${groupName}`
      );
      await loadMembers(); // Refresh list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove member';
      showError('Failed to remove member', errorMessage);
    } finally {
      setRemovingUserId(null);
    }
  };

  /**
   * Handle successful member addition
   */
  const handleMembersAdded = () => {
    setIsAddMembersOpen(false);
    loadMembers(); // Refresh list
  };

  /**
   * Render modal actions
   */
  const actions = [
    <Button key="add" variant="primary" icon={<PlusCircleIcon />} onClick={() => setIsAddMembersOpen(true)}>
      Add Members
    </Button>,
    <Button key="close" variant="link" onClick={onClose}>
      Close
    </Button>,
  ];

  /**
   * Render confirmation modal actions
   */
  const confirmActions = [
    <Button
      key="confirm"
      variant="danger"
      onClick={handleConfirmRemove}
      isLoading={removingUserId !== null}
      isDisabled={removingUserId !== null}
    >
      {removingUserId !== null ? 'Removing...' : 'Remove'}
    </Button>,
    <Button key="cancel" variant="link" onClick={() => setConfirmRemove(null)}>
      Cancel
    </Button>,
  ];

  return (
    <>
      <Modal
        variant={ModalVariant.large}
        title={`Group Members - ${groupName}`}
        isOpen={isOpen}
        onClose={onClose}
        actions={actions}
      >
        {loading ? (
          <Bullseye style={{ minHeight: '200px' }}>
            <Spinner size="xl" />
          </Bullseye>
        ) : error ? (
          <Alert variant="danger" title="Error loading members" isInline>
            {error}
          </Alert>
        ) : members.length === 0 ? (
          <EmptyState>
            <EmptyStateIcon icon={UsersIcon} />
            <Title headingLevel="h2" size="lg">
              No Members
            </Title>
            <EmptyStateBody>
              This group has no members yet. Click "Add Members" to add users to this group.
            </EmptyStateBody>
          </EmptyState>
        ) : (
          <Table variant="compact" aria-label="Group members table">
            <Thead>
              <Tr>
                <Th>User ID</Th>
                <Th>Name</Th>
                <Th>Surname</Th>
                <Th>Role</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {members.map((member) => (
                <Tr key={member.userId}>
                  <Td dataLabel="User ID">{member.userId}</Td>
                  <Td dataLabel="Name">{member.name}</Td>
                  <Td dataLabel="Surname">{member.surname}</Td>
                  <Td dataLabel="Role">{member.role}</Td>
                  <Td dataLabel="Actions">
                    <Button
                      variant="link"
                      icon={<TrashIcon />}
                      onClick={() => handleRemoveClick(member.userId, member.name, member.surname)}
                      isDisabled={removingUserId === member.userId}
                      isDanger
                    >
                      {removingUserId === member.userId ? 'Removing...' : 'Remove'}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Modal>

      {/* Confirmation Modal for Member Removal */}
      <Modal
        variant={ModalVariant.small}
        title="Remove Member"
        isOpen={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        actions={confirmActions}
      >
        Are you sure you want to remove <strong>{confirmRemove?.name}</strong> from group{' '}
        <strong>{groupName}</strong>?
      </Modal>

      {/* Add Members Modal */}
      {isAddMembersOpen && (
        <AddMembersModal
          groupName={groupName}
          currentMembers={members}
          isOpen={isAddMembersOpen}
          onClose={() => setIsAddMembersOpen(false)}
          onSuccess={handleMembersAdded}
        />
      )}
    </>
  );
}
