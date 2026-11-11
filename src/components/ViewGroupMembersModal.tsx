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
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  Label,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import { UsersIcon, TrashIcon, PlusCircleIcon, RobotIcon } from '@patternfly/react-icons';
import { groupsApi } from '../services/groupsApi';
import { robotsApi } from '../services/robotsApi';
import { useNotifications } from '../hooks';
import { isApiError } from '../utils/apiClient';
import { AddMembersModal } from './AddMembersModal';
import type { GroupMemberDetails, RobotDetails } from '../types/api';

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
  // Robot accounts are NOT returned by the members API (KrknUser-only), so they
  // are fetched separately and filtered client-side by group membership labels.
  const [groupRobots, setGroupRobots] = useState<RobotDetails[]>([]);
  const [robotsAvailable, setRobotsAvailable] = useState(false);
  const [robotsError, setRobotsError] = useState<string | null>(null);
  const { showSuccess, showError } = useNotifications();

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
   * Fetch robot accounts that are members of this group.
   *
   * The group members API only covers KrknUser accounts, so robot membership
   * (stored as `group.krkn.krkn-chaos.dev/<group>` labels on KrknRobot CRs) is
   * fetched via the robots API and filtered client-side.
   *
   * A 404 means the operator version does not support robots — the section is
   * silently hidden in that case.
   */
  const loadRobots = async () => {
    setRobotsAvailable(false);
    setRobotsError(null);
    try {
      const response = await robotsApi.listRobots();
      setGroupRobots(response.robots.filter((robot) => robot.groups.includes(groupName)));
      setRobotsAvailable(true);
    } catch (err) {
      if (isApiError(err) && err.status === 404) {
        // Old operator without robot support — hide the section silently
        setGroupRobots([]);
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to load robot accounts';
      setGroupRobots([]);
      setRobotsError(errorMessage);
    }
  };

  /**
   * Load group members when modal opens
   */
  useEffect(() => {
    if (isOpen) {
      loadMembers();
      loadRobots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, groupName]); // Reload when modal opens or group changes

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
        ) : members.length === 0 && groupRobots.length === 0 ? (
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
          <>
          <DataList aria-label="Group members list" isCompact>
            {members.map((member) => (
              <DataListItem key={member.userId}>
                <DataListItemRow>
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell key="name" width={2}>
                        <div>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <strong style={{ fontSize: 'var(--pf-v5-global--FontSize--md)' }}>
                              {member.name} {member.surname}
                            </strong>
                          </div>
                          <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)', color: 'var(--pf-v5-global--Color--200)' }}>
                            {member.userId}
                          </div>
                        </div>
                      </DataListCell>,
                      <DataListCell key="role" width={1}>
                        <div>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <strong>Role:</strong>
                          </div>
                          <Label color={member.role === 'admin' ? 'blue' : 'green'}>
                            {member.role}
                          </Label>
                        </div>
                      </DataListCell>,
                      <DataListCell key="actions" width={1}>
                        <Button
                          variant="link"
                          icon={<TrashIcon />}
                          onClick={() => handleRemoveClick(member.userId, member.name, member.surname)}
                          isDisabled={removingUserId === member.userId}
                          isDanger
                        >
                          {removingUserId === member.userId ? 'Removing...' : 'Remove'}
                        </Button>
                      </DataListCell>,
                    ]}
                  />
                </DataListItemRow>
              </DataListItem>
            ))}
          </DataList>

          {/* Robot accounts (read-only) — membership is managed in Settings → MCP Robots */}
          {robotsAvailable && (
            <div style={{ marginTop: '1.5rem' }}>
              <Title headingLevel="h3" size="md" style={{ marginBottom: '0.5rem' }}>
                <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapXs' }}>
                  <FlexItem>
                    <RobotIcon />
                  </FlexItem>
                  <FlexItem>Robot accounts ({groupRobots.length})</FlexItem>
                </Flex>
              </Title>
              {robotsError ? (
                <Alert variant="warning" title="Error loading robot accounts" isInline>
                  {robotsError}
                </Alert>
              ) : groupRobots.length === 0 ? (
                <p style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)', color: 'var(--pf-v5-global--Color--200)' }}>
                  No robot accounts are members of this group. Manage robot membership in
                  Settings → MCP Robots.
                </p>
              ) : (
                <DataList aria-label="Robot accounts in group" isCompact>
                  {groupRobots.map((robot) => (
                    <DataListItem key={robot.name}>
                      <DataListItemRow>
                        <DataListItemCells
                          dataListCells={[
                            <DataListCell key="name" width={2}>
                              <div>
                                <div style={{ marginBottom: '0.25rem' }}>
                                  <strong style={{ fontSize: 'var(--pf-v5-global--FontSize--md)' }}>
                                    {robot.name}
                                  </strong>
                                </div>
                                <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)', color: 'var(--pf-v5-global--Color--200)' }}>
                                  {robot.description || 'No description'}
                                </div>
                              </div>
                            </DataListCell>,
                            <DataListCell key="status" width={1}>
                              <div>
                                <div style={{ marginBottom: '0.25rem' }}>
                                  <strong>Status:</strong>
                                </div>
                                <Label color={robot.disabled ? 'red' : 'green'}>
                                  {robot.disabled ? 'Disabled' : 'Enabled'}
                                </Label>
                              </div>
                            </DataListCell>,
                          ]}
                        />
                      </DataListItemRow>
                    </DataListItem>
                  ))}
                </DataList>
              )}
              <p style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)', color: 'var(--pf-v5-global--Color--200)', marginTop: '0.5rem' }}>
                Robot accounts are read-only here. Manage robot membership in Settings → MCP Robots.
              </p>
            </div>
          )}
          </>
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
