import {
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Label,
} from '@patternfly/react-core';
import type { UserDetails as UserDetailsType } from '../types/api';

/**
 * User Details component props
 */
interface UserDetailsProps {
  /**
   * User data to display (null if no user selected)
   */
  user: UserDetailsType | null;
}

/**
 * User Details component
 *
 * Displays complete user information in a clean, read-only format.
 * Uses PatternFly DescriptionList component for key-value presentation.
 *
 * **Access Control:**
 * Available to all authenticated users (not admin-only).
 * Any user can view details for any other user.
 *
 * **Displayed Fields:**
 * - **Email** - User's email address (unique identifier)
 * - **Name** - Full name (first and last name)
 * - **Role** - User role with color-coded label
 *   - Admin: Blue label
 *   - User: Green label
 * - **Organization** - Organization affiliation (or "N/A" if not set)
 * - **Status** - Account status with color-coded label
 *   - Active (enabled): Green label
 *   - Disabled: Red label
 * - **Created At** - Account creation timestamp (formatted)
 * - **Last Login** - Last successful login timestamp (or "Never")
 *
 * **Component Characteristics:**
 * - Purely presentational (no state or API calls)
 * - Returns null if no user provided
 * - Read-only view (no editing capabilities)
 * - Automatic date/time formatting using browser locale
 *
 * **Usage Context:**
 * Typically rendered inside a Modal component, triggered by clicking
 * "View Details" button in the user list.
 *
 * @component
 *
 * @param props - Component props
 * @param props.user - The user details to display (null if no user selected)
 *
 * @example
 * ```tsx
 * // Basic usage in a modal
 * <Modal
 *   variant={ModalVariant.medium}
 *   title="User Details"
 *   isOpen={viewingUser !== null}
 *   onClose={() => setViewingUser(null)}
 *   actions={[
 *     <Button key="close" variant="primary" onClick={() => setViewingUser(null)}>
 *       Close
 *     </Button>
 *   ]}
 * >
 *   <UserDetails user={viewingUser} />
 * </Modal>
 * ```
 *
 * @example
 * ```tsx
 * // Standalone usage (less common)
 * <UserDetails user={selectedUser} />
 * ```
 */
export function UserDetails({ user }: UserDetailsProps) {
  if (!user) return null;

  return (
    <DescriptionList isHorizontal>
      <DescriptionListGroup>
        <DescriptionListTerm>Email</DescriptionListTerm>
        <DescriptionListDescription>{user.userId}</DescriptionListDescription>
      </DescriptionListGroup>

      <DescriptionListGroup>
        <DescriptionListTerm>Name</DescriptionListTerm>
        <DescriptionListDescription>
          {user.name} {user.surname}
        </DescriptionListDescription>
      </DescriptionListGroup>

      <DescriptionListGroup>
        <DescriptionListTerm>Role</DescriptionListTerm>
        <DescriptionListDescription>
          <Label color={user.role === 'admin' ? 'blue' : 'green'}>
            {user.role.toUpperCase()}
          </Label>
        </DescriptionListDescription>
      </DescriptionListGroup>

      <DescriptionListGroup>
        <DescriptionListTerm>Organization</DescriptionListTerm>
        <DescriptionListDescription>
          {user.organization || 'N/A'}
        </DescriptionListDescription>
      </DescriptionListGroup>

      <DescriptionListGroup>
        <DescriptionListTerm>Status</DescriptionListTerm>
        <DescriptionListDescription>
          <Label color={user.active ? 'green' : 'red'}>
            {user.active ? 'Active' : 'Inactive'}
          </Label>
        </DescriptionListDescription>
      </DescriptionListGroup>

      <DescriptionListGroup>
        <DescriptionListTerm>Created At</DescriptionListTerm>
        <DescriptionListDescription>
          {user.created ? new Date(user.created).toLocaleString() : 'N/A'}
        </DescriptionListDescription>
      </DescriptionListGroup>

      <DescriptionListGroup>
        <DescriptionListTerm>Last Login</DescriptionListTerm>
        <DescriptionListDescription>
          {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
        </DescriptionListDescription>
      </DescriptionListGroup>
    </DescriptionList>
  );
}
