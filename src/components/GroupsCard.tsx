import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardTitle,
  CardBody,
  Button,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
  Title,
  Modal,
  ModalVariant,
  Spinner,
  SearchInput,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  Flex,
  FlexItem,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
} from '@patternfly/react-core';
import { PlusCircleIcon, UsersIcon, EditIcon, TrashIcon, EllipsisVIcon } from '@patternfly/react-icons';
import { groupsApi } from '../services/groupsApi';
import { useNotifications } from '../hooks';
import { CreateGroupModal } from './CreateGroupModal';
import { EditGroupModal } from './EditGroupModal';
import { ViewGroupMembersModal } from './ViewGroupMembersModal';
import type { GroupDetails } from '../types/api';

/**
 * GroupsCard component
 *
 * Displays a card containing a table of all groups with CRUD operations.
 * Provides group management functionality including create, edit, and delete operations.
 *
 * **Features:**
 * - List all groups with details (name, description, member count, clusters)
 * - Create new groups with cluster permissions
 * - Edit existing groups
 * - Delete groups with confirmation
 * - Search/filter groups by name
 * - Sort by name or member count
 * - Empty state with helpful guidance
 * - Loading skeleton while fetching
 *
 * **Table Columns:**
 * - Name: Group name (sortable)
 * - Description: Group description
 * - Member Count: Number of users in group (sortable)
 * - Clusters: Number of clusters with permissions
 * - Actions: Edit and Delete buttons
 *
 * **Access Control:**
 * - Admin only (enforced by API)
 *
 * @component
 *
 * @example
 * ```tsx
 * import { GroupsCard } from './GroupsCard';
 *
 * function AdminPage() {
 *   return (
 *     <div>
 *       <GroupsCard />
 *     </div>
 *   );
 * }
 * ```
 *
 * @param {Object} props - Component props
 * @param {() => void} [props.onGroupsChange] - Optional callback invoked when groups are created/edited/deleted
 */
interface GroupsCardProps {
  onGroupsChange?: () => void;
}

export function GroupsCard({ onGroupsChange }: GroupsCardProps = {}) {
  const [groups, setGroups] = useState<GroupDetails[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<GroupDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<{ name: string } | null>(null);
  const [deletingGroupName, setDeletingGroupName] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [viewMembersGroupName, setViewMembersGroupName] = useState<string | null>(null);
  const { showSuccess, showError } = useNotifications();

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await groupsApi.listGroups();
      setGroups(data);
    } catch (error) {
      showError('Failed to load groups', error instanceof Error ? error.message : 'Unknown error');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Filter and sort groups based on search value
  useEffect(() => {
    let result = groups;

    // Apply search filter
    if (searchValue) {
      const searchLower = searchValue.toLowerCase();
      result = result.filter((group) =>
        group.name.toLowerCase().includes(searchLower) ||
        (group.description && group.description.toLowerCase().includes(searchLower))
      );
    }

    // Sort alphabetically by name (ascending)
    result = [...result].sort((a, b) => a.name.localeCompare(b.name));

    setFilteredGroups(result);
  }, [groups, searchValue]);

  const handleCreate = () => {
    setIsCreateModalOpen(true);
  };

  const handleEdit = (group: GroupDetails) => {
    setEditingGroupName(group.name);
  };

  const handleDelete = (name: string) => {
    setConfirmDeleteGroup({ name });
  };

  const handleViewMembers = (groupName: string) => {
    setViewMembersGroupName(groupName);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteGroup) return;

    setDeletingGroupName(confirmDeleteGroup.name);
    setConfirmDeleteGroup(null);

    try {
      await groupsApi.deleteGroup(confirmDeleteGroup.name);
      showSuccess('Group deleted', `Group "${confirmDeleteGroup.name}" has been deleted successfully`);
      await loadGroups();
      onGroupsChange?.();
    } catch (error) {
      showError('Failed to delete group', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setDeletingGroupName(null);
    }
  };

  const handleCreateSuccess = async () => {
    setIsCreateModalOpen(false);
    await loadGroups(); // Wait for refresh to complete
    onGroupsChange?.();
  };

  const handleEditSuccess = async () => {
    setEditingGroupName(null);
    await loadGroups(); // Wait for refresh to complete
    onGroupsChange?.();
  };

  return (
    <Card>
      <CardTitle>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
          <FlexItem>
            <Title headingLevel="h2" size="lg">
              Groups ({groups.length})
            </Title>
          </FlexItem>
          <FlexItem>
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleCreate}>
              Create Group
            </Button>
          </FlexItem>
        </Flex>
      </CardTitle>
      <CardBody>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spinner size="xl" />
          </div>
        ) : (
          <>
            <Toolbar>
              <ToolbarContent>
                <ToolbarItem>
                  <SearchInput
                    placeholder="Filter by name"
                    value={searchValue}
                    onChange={(_event, value) => setSearchValue(value)}
                    onClear={() => setSearchValue('')}
                  />
                </ToolbarItem>
              </ToolbarContent>
            </Toolbar>

            {filteredGroups.length === 0 ? (
              <EmptyState>
                <EmptyStateIcon icon={UsersIcon} />
                <Title headingLevel="h2" size="lg">
                  {searchValue
                    ? 'No groups match your filter'
                    : 'No groups yet. Create your first group to get started.'}
                </Title>
                <EmptyStateBody>
                  {searchValue
                    ? 'Try adjusting your search criteria.'
                    : 'Groups organize users and define access to clusters. Click "Create Group" to get started.'}
                </EmptyStateBody>
              </EmptyState>
            ) : (
              <DataList aria-label="Groups list" isCompact>
                {filteredGroups.map((group) => {
                  const clusterCount = Object.keys(group.clusterPermissions || {}).length;
                  return (
                    <DataListItem key={group.name}>
                      <DataListItemRow>
                        <DataListItemCells
                          dataListCells={[
                            <DataListCell key="name" width={2}>
                              <div>
                                <div style={{ marginBottom: '0.25rem' }}>
                                  <strong style={{ fontSize: 'var(--pf-v5-global--FontSize--md)' }}>
                                    {group.name}
                                  </strong>
                                </div>
                                <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)', color: 'var(--pf-v5-global--Color--200)' }}>
                                  {group.description || 'No description'}
                                </div>
                              </div>
                            </DataListCell>,
                            <DataListCell key="members" width={1}>
                              <div>
                                <div style={{ marginBottom: '0.25rem' }}>
                                  <strong>Members:</strong>
                                </div>
                                <Button
                                  variant="link"
                                  isInline
                                  onClick={() => handleViewMembers(group.name)}
                                  style={{ padding: 0, fontSize: 'var(--pf-v5-global--FontSize--sm)' }}
                                >
                                  {group.memberCount || 0}
                                </Button>
                              </div>
                            </DataListCell>,
                            <DataListCell key="clusters" width={1}>
                              <div>
                                <div style={{ marginBottom: '0.25rem' }}>
                                  <strong>Clusters:</strong>
                                </div>
                                <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                                  {clusterCount}
                                </div>
                              </div>
                            </DataListCell>,
                            <DataListCell key="actions" width={1}>
                              <Dropdown
                                isOpen={openDropdownId === group.name}
                                onOpenChange={(isOpen) => setOpenDropdownId(isOpen ? group.name : null)}
                                toggle={(toggleRef) => (
                                  <MenuToggle
                                    ref={toggleRef}
                                    onClick={() =>
                                      setOpenDropdownId(openDropdownId === group.name ? null : group.name)
                                    }
                                    variant="plain"
                                    aria-label="Group actions"
                                    isDisabled={deletingGroupName === group.name}
                                  >
                                    <EllipsisVIcon />
                                  </MenuToggle>
                                )}
                              >
                                <DropdownList>
                                  <DropdownItem
                                    key="members"
                                    icon={<UsersIcon />}
                                    onClick={() => {
                                      handleViewMembers(group.name);
                                      setOpenDropdownId(null);
                                    }}
                                  >
                                    Members
                                  </DropdownItem>
                                  <DropdownItem
                                    key="edit"
                                    icon={<EditIcon />}
                                    onClick={() => {
                                      handleEdit(group);
                                      setOpenDropdownId(null);
                                    }}
                                  >
                                    Edit
                                  </DropdownItem>
                                  <DropdownItem
                                    key="delete"
                                    icon={<TrashIcon />}
                                    onClick={() => {
                                      handleDelete(group.name);
                                      setOpenDropdownId(null);
                                    }}
                                    style={{ color: 'var(--pf-v5-global--danger-color--100)' }}
                                  >
                                    Delete
                                  </DropdownItem>
                                </DropdownList>
                              </Dropdown>
                            </DataListCell>,
                          ]}
                        />
                      </DataListItemRow>
                    </DataListItem>
                  );
                })}
              </DataList>
            )}
          </>
        )}
      </CardBody>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Group Modal */}
      {editingGroupName && (
        <EditGroupModal
          isOpen={true}
          onClose={() => setEditingGroupName(null)}
          groupName={editingGroupName}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Confirmation Modal for Group Deletion */}
      <Modal
        variant={ModalVariant.small}
        title="Delete Group"
        isOpen={confirmDeleteGroup !== null}
        onClose={() => setConfirmDeleteGroup(null)}
        actions={[
          <Button
            key="confirm"
            variant="danger"
            onClick={handleConfirmDelete}
            isLoading={deletingGroupName !== null}
            isDisabled={deletingGroupName !== null}
          >
            {deletingGroupName !== null ? 'Deleting...' : 'Delete'}
          </Button>,
          <Button key="cancel" variant="link" onClick={() => setConfirmDeleteGroup(null)}>
            Cancel
          </Button>,
        ]}
      >
        Are you sure you want to delete group <strong>{confirmDeleteGroup?.name}</strong>? All users
        will be removed from this group.
      </Modal>

      {/* View Group Members Modal */}
      {viewMembersGroupName && (
        <ViewGroupMembersModal
          groupName={viewMembersGroupName}
          isOpen={viewMembersGroupName !== null}
          onClose={() => {
            setViewMembersGroupName(null);
            loadGroups(); // Refresh groups to update member counts
          }}
        />
      )}
    </Card>
  );
}
