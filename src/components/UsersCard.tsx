import { useState, useEffect } from 'react';
import {
  Card,
  CardTitle,
  CardBody,
  Button,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
  Title,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  Flex,
  FlexItem,
  Label,
  Modal,
  ModalVariant,
  Spinner,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  Tooltip,
  SearchInput,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Select,
  SelectOption,
  SelectList,
} from '@patternfly/react-core';
import { PlusCircleIcon, UsersIcon, TrashIcon, EditIcon, EyeIcon, EllipsisVIcon, KeyIcon, SortAmountDownIcon, SortAmountUpIcon } from '@patternfly/react-icons';
import { usersApi } from '../services/usersApi';
import { groupsApi } from '../services/groupsApi';
import { useNotifications, useRole } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { UserForm } from './UserForm';
import { UserDetails as UserDetailsComponent } from './UserDetails';
import { ChangePasswordForm } from './ChangePasswordForm';
import type { UserDetails, CreateUserRequest, UpdateUserRequest, ChangePasswordRequest, GroupDetails } from '../types/api';

/**
 * UsersCard component
 *
 * Displays a card containing a list of all users with CRUD operations.
 * Provides user management functionality including create, edit, view, and delete operations.
 *
 * **Features:**
 * - List all users with details (name, role, organization, status, last login)
 * - Create new users with group validation (requires at least one group to exist)
 * - Edit existing users
 * - View detailed user information
 * - Delete users with safety checks
 * - Change user passwords (admin only)
 * - Empty state with helpful guidance
 * - Loading spinner while fetching
 *
 * **Group Validation:**
 * - Create User button is disabled if no groups exist
 * - Tooltip explains requirement to create groups first
 * - Ensures users always have at least one group available for assignment
 *
 * **Access Control:**
 * - Admin: Full CRUD access
 * - User: Read-only access (view details only)
 *
 * **Safety Mechanisms:**
 * - Self-deletion prevention
 * - Last admin protection
 * - Confirmation dialog before deletion
 * - Loading states during async operations
 *
 * @component
 *
 * @example
 * ```tsx
 * import { UsersCard } from './UsersCard';
 *
 * function UsersAndGroupsPage() {
 *   const [groups, setGroups] = useState<GroupDetails[]>([]);
 *
 *   return (
 *     <div>
 *       <UsersCard groups={groups} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @param {Object} props - Component props
 * @param {GroupDetails[]} props.groups - Array of groups used for validation
 */
interface UsersCardProps {
  groups: GroupDetails[];
}

export function UsersCard({ groups }: UsersCardProps) {
  const [users, setUsers] = useState<UserDetails[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserDetails[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDetails | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<{ userId: string; name: string } | null>(null);
  const [viewingUser, setViewingUser] = useState<UserDetails | null>(null);
  const [apiAvailable, setApiAvailable] = useState(true);
  const [changingPasswordFor, setChangingPasswordFor] = useState<UserDetails | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<'name' | 'organization' | 'lastLogin'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isSortColumnSelectOpen, setIsSortColumnSelectOpen] = useState(false);
  const { showSuccess, showError } = useNotifications();
  const { isAdmin } = useRole();
  const { state } = useAuth();

  useEffect(() => {
    loadUsers();
  }, []);

  // Filter and sort users based on search value and sort settings
  useEffect(() => {
    let result = users;

    // Apply search filter
    if (searchValue) {
      const searchLower = searchValue.toLowerCase();
      result = result.filter(
        (user) =>
          user.userId.toLowerCase().includes(searchLower) ||
          user.name.toLowerCase().includes(searchLower) ||
          user.surname.toLowerCase().includes(searchLower) ||
          (user.organization && user.organization.toLowerCase().includes(searchLower))
      );
    }

    // Apply sorting
    result = [...result].sort((a, b) => {
      let compareValue = 0;

      switch (sortColumn) {
        case 'name':
          compareValue = `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`);
          break;
        case 'organization':
          compareValue = (a.organization || '').localeCompare(b.organization || '');
          break;
        case 'lastLogin': {
          const dateA = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
          const dateB = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
          compareValue = dateA - dateB;
          break;
        }
      }

      return sortDirection === 'asc' ? compareValue : -compareValue;
    });

    setFilteredUsers(result);
  }, [users, searchValue, sortColumn, sortDirection]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await usersApi.listUsers();
      setUsers(data);
      setApiAvailable(true);
    } catch (error) {
      setUsers([]);
      setApiAvailable(false);
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    setIsFormOpen(true);
  };

  const handleEdit = (user: UserDetails) => {
    setEditingUser(user);
    setIsFormOpen(true);
  };

  const handleDelete = (userId: string, name: string, role: string) => {
    if (userId === state.user?.userId) {
      showError('Cannot delete yourself', 'You cannot delete your own account');
      return;
    }

    if (role === 'admin') {
      const adminCount = users.filter(u => u.role === 'admin').length;
      if (adminCount === 1) {
        showError('Cannot delete last admin', 'At least one admin must exist');
        return;
      }
    }

    setConfirmDeleteUser({ userId, name });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteUser) return;

    setDeletingUserId(confirmDeleteUser.userId);
    setConfirmDeleteUser(null);

    try {
      await usersApi.deleteUser(confirmDeleteUser.userId);
      showSuccess('User deleted', `User "${confirmDeleteUser.name}" has been deleted successfully`);
      await loadUsers();
    } catch (error) {
      showError('Failed to delete user', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleFormSubmit = async (data: CreateUserRequest | UpdateUserRequest, selectedGroups?: string[]) => {
    try {
      if (editingUser) {
        const updateData = data as UpdateUserRequest;
        if (editingUser.userId === state.user?.userId && updateData.active === false) {
          showError('Cannot disable yourself', 'You cannot disable your own account');
          return;
        }

        await usersApi.updateUser(editingUser.userId, updateData);
        showSuccess('User updated', `User has been updated successfully`);
      } else {
        // CREATE MODE: Create user first, then add to groups
        const createData = data as CreateUserRequest;
        await usersApi.createUser(createData);

        // Add user to each selected group
        if (selectedGroups && selectedGroups.length > 0) {
          let successCount = 0;
          let failureCount = 0;
          const errors: string[] = [];

          for (const groupName of selectedGroups) {
            try {
              await groupsApi.addGroupMember(groupName, createData.userId);
              successCount++;
            } catch (err) {
              failureCount++;
              const errorMessage = err instanceof Error ? err.message : 'Unknown error';
              errors.push(`${groupName}: ${errorMessage}`);
            }
          }

          // Show appropriate notification based on results
          if (failureCount === 0) {
            showSuccess('User created', `User has been created and added to ${successCount} group${successCount !== 1 ? 's' : ''} successfully`);
          } else if (successCount === 0) {
            showError(
              'User created with warnings',
              `User was created but failed to add to groups. ${errors.slice(0, 3).join(', ')}`
            );
          } else {
            showSuccess(
              'User created with warnings',
              `User was created and added to ${successCount} group(s), but failed to add to ${failureCount} group(s). ${errors.slice(0, 2).join(', ')}`
            );
          }
        } else {
          showSuccess('User created', `User has been created successfully`);
        }
      }
      setIsFormOpen(false);
      await loadUsers();
    } catch (error) {
      showError(
        editingUser ? 'Failed to update user' : 'Failed to create user',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setEditingUser(null);
  };

  const handleViewDetails = (user: UserDetails) => {
    setViewingUser(user);
  };

  const handleChangePassword = (user: UserDetails) => {
    setChangingPasswordFor(user);
    setOpenDropdownId(null);
  };

  const handlePasswordChangeSubmit = async (data: ChangePasswordRequest) => {
    if (!changingPasswordFor) return;

    try {
      await usersApi.changePassword(changingPasswordFor.userId, data);
      showSuccess('Password changed', `Password for ${changingPasswordFor.name} ${changingPasswordFor.surname} has been changed successfully`);
      setChangingPasswordFor(null);
    } catch (error) {
      showError('Failed to change password', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handlePasswordChangeCancel = () => {
    setChangingPasswordFor(null);
  };

  // Check if groups exist for validation
  const hasGroups = groups.length > 0;
  const createButtonDisabled = !hasGroups;

  return (
    <Card>
      <CardTitle>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
          <FlexItem>
            <Title headingLevel="h2" size="lg">
              Users ({users.length})
            </Title>
          </FlexItem>
          {isAdmin && (
            <FlexItem>
              <Tooltip
                content={!hasGroups ? 'Create at least one group before adding users' : ''}
                position="left"
              >
                <Button
                  variant="primary"
                  icon={<PlusCircleIcon />}
                  onClick={handleCreate}
                  isDisabled={createButtonDisabled}
                >
                  Create User
                </Button>
              </Tooltip>
            </FlexItem>
          )}
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
                    placeholder="Filter by name, email, or organization"
                    value={searchValue}
                    onChange={(_event, value) => setSearchValue(value)}
                    onClear={() => setSearchValue('')}
                  />
                </ToolbarItem>
                <ToolbarItem>
                  <Select
                    isOpen={isSortColumnSelectOpen}
                    onOpenChange={(isOpen) => setIsSortColumnSelectOpen(isOpen)}
                    onSelect={(_event, value) => {
                      setSortColumn(value as 'name' | 'organization' | 'lastLogin');
                      setIsSortColumnSelectOpen(false);
                    }}
                    toggle={(toggleRef) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={() => setIsSortColumnSelectOpen(!isSortColumnSelectOpen)}
                        style={{ minWidth: '150px' }}
                      >
                        Sort by: {sortColumn === 'name' ? 'Name' : sortColumn === 'organization' ? 'Organization' : 'Last Login'}
                      </MenuToggle>
                    )}
                  >
                    <SelectList>
                      <SelectOption value="name">Name</SelectOption>
                      <SelectOption value="organization">Organization</SelectOption>
                      <SelectOption value="lastLogin">Last Login</SelectOption>
                    </SelectList>
                  </Select>
                </ToolbarItem>
                <ToolbarItem>
                  <Button
                    variant="plain"
                    aria-label={`Sort ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
                    onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortDirection === 'asc' ? <SortAmountUpIcon /> : <SortAmountDownIcon />}
                  </Button>
                </ToolbarItem>
              </ToolbarContent>
            </Toolbar>

            {users.length === 0 ? (
              <EmptyState>
                <EmptyStateIcon icon={UsersIcon} />
                <Title headingLevel="h2" size="lg">
                  {apiAvailable ? 'No Users Found' : 'Users API Not Available'}
                </Title>
                <EmptyStateBody>
                  {apiAvailable
                    ? !hasGroups
                      ? 'Create at least one group before adding users.'
                      : 'Click "Create User" to start adding users.'
                    : 'The users API endpoint is not available. Make sure the backend service is running and the API is properly configured.'}
                </EmptyStateBody>
              </EmptyState>
            ) : filteredUsers.length === 0 ? (
              <EmptyState>
                <EmptyStateIcon icon={UsersIcon} />
                <Title headingLevel="h2" size="lg">
                  No Matching Users
                </Title>
                <EmptyStateBody>
                  No users match your search criteria. Try a different filter.
                </EmptyStateBody>
              </EmptyState>
            ) : (
              <DataList aria-label="Users list" isCompact>
                {filteredUsers.map((user) => (
                  <DataListItem key={user.userId}>
                    <DataListItemRow>
                      <DataListItemCells
                        dataListCells={[
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
                          <DataListCell key="status" width={1}>
                            <div>
                              <div style={{ marginBottom: '0.25rem' }}>
                                <strong>Status:</strong>
                              </div>
                              <Label color={user.active ? 'green' : 'red'}>
                                {user.active ? 'Active' : 'Inactive'}
                              </Label>
                            </div>
                          </DataListCell>,
                          <DataListCell key="lastLogin" width={1}>
                            <div>
                              <div style={{ marginBottom: '0.25rem' }}>
                                <strong>Last Login:</strong>
                              </div>
                              <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                                {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                              </div>
                            </div>
                          </DataListCell>,
                          <DataListCell key="actions" width={1}>
                            <Dropdown
                              isOpen={openDropdownId === user.userId}
                              onOpenChange={(isOpen) => setOpenDropdownId(isOpen ? user.userId : null)}
                              toggle={(toggleRef) => (
                                <MenuToggle
                                  ref={toggleRef}
                                  onClick={() => setOpenDropdownId(openDropdownId === user.userId ? null : user.userId)}
                                  variant="plain"
                                  aria-label="User actions"
                                  isDisabled={deletingUserId === user.userId}
                                >
                                  <EllipsisVIcon />
                                </MenuToggle>
                              )}
                            >
                              <DropdownList>
                                <DropdownItem
                                  key="view"
                                  icon={<EyeIcon />}
                                  onClick={() => {
                                    handleViewDetails(user);
                                    setOpenDropdownId(null);
                                  }}
                                >
                                  View Details
                                </DropdownItem>
                                {isAdmin && (
                                  <>
                                    <DropdownItem
                                      key="edit"
                                      icon={<EditIcon />}
                                      onClick={() => {
                                        handleEdit(user);
                                        setOpenDropdownId(null);
                                      }}
                                    >
                                      Edit Profile
                                    </DropdownItem>
                                    <DropdownItem
                                      key="password"
                                      icon={<KeyIcon />}
                                      onClick={() => handleChangePassword(user)}
                                    >
                                      Change Password
                                    </DropdownItem>
                                    <DropdownItem
                                      key="delete"
                                      icon={<TrashIcon />}
                                      onClick={() => {
                                        handleDelete(user.userId, `${user.name} ${user.surname}`, user.role);
                                        setOpenDropdownId(null);
                                      }}
                                      style={{ color: 'var(--pf-v5-global--danger-color--100)' }}
                                    >
                                      Delete User
                                    </DropdownItem>
                                  </>
                                )}
                              </DropdownList>
                            </Dropdown>
                          </DataListCell>,
                        ]}
                      />
                    </DataListItemRow>
                  </DataListItem>
                ))}
              </DataList>
            )}
          </>
        )}
      </CardBody>

      {/* Create/Edit User Modal */}
      <Modal
        variant={ModalVariant.medium}
        title={editingUser ? 'Edit User' : 'Create New User'}
        isOpen={isFormOpen}
        onClose={handleFormCancel}
      >
        <UserForm
          initialData={editingUser || undefined}
          groups={!editingUser ? groups : undefined}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      </Modal>

      {/* Confirmation Modal for User Deletion */}
      <Modal
        variant={ModalVariant.small}
        title="Delete User"
        isOpen={confirmDeleteUser !== null}
        onClose={() => setConfirmDeleteUser(null)}
        actions={[
          <Button
            key="confirm"
            variant="danger"
            onClick={handleConfirmDelete}
            isLoading={deletingUserId !== null}
            isDisabled={deletingUserId !== null}
          >
            {deletingUserId !== null ? 'Deleting...' : 'Delete'}
          </Button>,
          <Button key="cancel" variant="link" onClick={() => setConfirmDeleteUser(null)}>
            Cancel
          </Button>,
        ]}
      >
        Are you sure you want to delete user <strong>{confirmDeleteUser?.name}</strong>?
      </Modal>

      {/* User Details Modal */}
      <Modal
        variant={ModalVariant.medium}
        title="User Details"
        isOpen={viewingUser !== null}
        onClose={() => setViewingUser(null)}
        actions={[
          <Button key="close" variant="primary" onClick={() => setViewingUser(null)}>
            Close
          </Button>,
        ]}
      >
        <UserDetailsComponent user={viewingUser} />
      </Modal>

      {/* Change Password Modal */}
      <Modal
        variant={ModalVariant.small}
        title={`Change Password${changingPasswordFor ? ` - ${changingPasswordFor.name} ${changingPasswordFor.surname}` : ''}`}
        isOpen={changingPasswordFor !== null}
        onClose={handlePasswordChangeCancel}
      >
        {changingPasswordFor && (
          <ChangePasswordForm
            isSelfChange={false}
            onSubmit={handlePasswordChangeSubmit}
            onCancel={handlePasswordChangeCancel}
          />
        )}
      </Modal>
    </Card>
  );
}
