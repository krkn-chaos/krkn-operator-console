import { useState, useEffect } from 'react';
import {
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
} from '@patternfly/react-core';
import { PlusCircleIcon, UsersIcon, TrashIcon, EditIcon, EyeIcon } from '@patternfly/react-icons';
import { usersApi } from '../services/usersApi';
import { useNotifications, useRole } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { UserForm } from './UserForm';
import { UserDetails as UserDetailsComponent } from './UserDetails';
import type { UserDetails, CreateUserRequest, UpdateUserRequest } from '../types/api';

/**
 * User Management component
 *
 * Provides a comprehensive CRUD interface for managing user accounts
 * in the krkn-operator-console. Implements role-based access control (RBAC)
 * with different capabilities for Admin and User roles.
 *
 * **Access Control:**
 * - **Admin**: Full CRUD access (Create, Read, Update, Delete)
 * - **User**: Read-only access (List and view details)
 *
 * **Features:**
 * - List all users with real-time count
 * - Create new users with validation (admin only)
 * - Edit existing users (admin only)
 * - View detailed user information (all users)
 * - Delete users with safety checks (admin only)
 * - Real-time notifications for all operations
 * - Empty state with helpful guidance
 * - API availability detection
 *
 * **Safety Mechanisms:**
 * - Self-deletion prevention (users cannot delete themselves)
 * - Last admin protection (cannot delete the last admin account)
 * - Confirmation dialog before deletion
 * - Loading states during async operations
 *
 * **State Management:**
 * - Manages user list, loading states, and modal visibility
 * - Automatic refresh after CRUD operations
 * - Error handling with user-friendly notifications
 *
 * **User List Display:**
 * Each user row shows:
 * - Full name and email
 * - Role with color-coded label (Admin=blue, User=green)
 * - Organization affiliation
 * - Account status (Enabled/Disabled)
 * - Last login timestamp
 * - Action buttons (View, Edit, Delete)
 *
 * @component
 *
 * @example
 * ```tsx
 * // In Settings page or dedicated Users section
 * import { UserManagement } from './UserManagement';
 *
 * function SettingsPage() {
 *   return (
 *     <div>
 *       <h1>Settings</h1>
 *       <UserManagement />
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Standalone usage with custom wrapper
 * <PageSection>
 *   <UserManagement />
 * </PageSection>
 * ```
 */
export function UserManagement() {
  const [users, setUsers] = useState<UserDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDetails | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<{ userId: string; name: string } | null>(null);
  const [viewingUser, setViewingUser] = useState<UserDetails | null>(null);
  const [apiAvailable, setApiAvailable] = useState(true);
  const { showSuccess, showError } = useNotifications();
  const { isAdmin } = useRole();
  const { state } = useAuth();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await usersApi.listUsers();
      setUsers(data);
      setApiAvailable(true);
    } catch (error) {
      setUsers([]);
      setApiAvailable(false);
      // Don't show error notification on initial load - the empty state will handle it
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
    // Cannot delete yourself
    if (userId === state.user?.userId) {
      showError('Cannot delete yourself', 'You cannot delete your own account');
      return;
    }

    // Cannot delete last admin
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

  const handleFormSubmit = async (data: CreateUserRequest | UpdateUserRequest) => {
    try {
      if (editingUser) {
        await usersApi.updateUser(editingUser.userId, data as UpdateUserRequest);
        showSuccess('User updated', `User has been updated successfully`);
      } else {
        await usersApi.createUser(data as CreateUserRequest);
        showSuccess('User created', `User has been created successfully`);
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <>
      <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} style={{ marginBottom: '1rem' }}>
        <FlexItem>
          <Title headingLevel="h2" size="md">
            Users ({users.length})
          </Title>
        </FlexItem>
        {isAdmin && (
          <FlexItem>
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleCreate}>
              Create User
            </Button>
          </FlexItem>
        )}
      </Flex>

      {users.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon icon={UsersIcon} />
          <Title headingLevel="h2" size="lg">
            {apiAvailable ? 'No Users Found' : 'Users API Not Available'}
          </Title>
          <EmptyStateBody>
            {apiAvailable
              ? 'Click "Create User" in the toolbar above to start adding users.'
              : 'The users API endpoint is not available. Make sure the backend service is running and the API is properly configured.'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <DataList aria-label="Users list" isCompact>
          {users.map((user) => (
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
                        <Label color={user.enabled ? 'green' : 'red'}>
                          {user.enabled ? 'Enabled' : 'Disabled'}
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
                      <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                        <FlexItem>
                          <Button
                            variant="secondary"
                            icon={<EyeIcon />}
                            onClick={() => handleViewDetails(user)}
                            size="sm"
                          >
                            View Details
                          </Button>
                        </FlexItem>
                        {isAdmin && (
                          <>
                            <FlexItem>
                              <Button
                                variant="secondary"
                                icon={<EditIcon />}
                                onClick={() => handleEdit(user)}
                                size="sm"
                              >
                                Edit
                              </Button>
                            </FlexItem>
                            <FlexItem>
                              <Button
                                variant="danger"
                                icon={<TrashIcon />}
                                onClick={() => handleDelete(user.userId, `${user.name} ${user.surname}`, user.role)}
                                isLoading={deletingUserId === user.userId}
                                isDisabled={deletingUserId === user.userId}
                                size="sm"
                              >
                                Delete
                              </Button>
                            </FlexItem>
                          </>
                        )}
                      </Flex>
                    </DataListCell>,
                  ]}
                />
              </DataListItemRow>
            </DataListItem>
          ))}
        </DataList>
      )}

      {/* Create/Edit User Modal */}
      <Modal
        variant={ModalVariant.medium}
        title={editingUser ? 'Edit User' : 'Create New User'}
        isOpen={isFormOpen}
        onClose={handleFormCancel}
      >
        <UserForm
          initialData={editingUser || undefined}
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
        <UserDetailsComponent user={viewingUser} onClose={() => setViewingUser(null)} />
      </Modal>
    </>
  );
}
