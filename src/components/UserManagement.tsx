import { useState, useEffect } from 'react';
import { Grid, GridItem, Spinner } from '@patternfly/react-core';
import { groupsApi } from '../services/groupsApi';
import { UsersCard } from './UsersCard';
import { GroupsCard } from './GroupsCard';
import type { GroupDetails } from '../types/api';

/**
 * User Management component
 *
 * Orchestrates both user and group management in a unified interface.
 * Displays GroupsCard and UsersCard in vertical layout, managing shared state
 * to ensure users can only be created when at least one group exists.
 *
 * **Features:**
 * - Vertical layout with Groups card above Users card
 * - Fetches groups and passes to UsersCard for validation
 * - Validates group existence before allowing user creation
 * - Responsive grid layout
 * - Loading states during data fetch
 *
 * **Validation:**
 * - UsersCard "Create User" button is disabled if no groups exist
 * - Tooltip guides users to create groups first
 * - Ensures referential integrity (users must belong to groups)
 *
 * **Access Control:**
 * - Admin: Full CRUD access for both users and groups
 * - User: Read-only access (view details only)
 *
 * @component
 *
 * @example
 * ```tsx
 * // In Settings page "Users & Groups" tab
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
 */
export function UserManagement() {
  const [groups, setGroups] = useState<GroupDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await groupsApi.listGroups();
      setGroups(data);
    } catch (error) {
      console.error('Failed to load groups:', error);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <Grid hasGutter>
      <GridItem span={12}>
        <GroupsCard onGroupsChange={loadGroups} />
      </GridItem>
      <GridItem span={12}>
        <UsersCard groups={groups} />
      </GridItem>
    </Grid>
  );
}
