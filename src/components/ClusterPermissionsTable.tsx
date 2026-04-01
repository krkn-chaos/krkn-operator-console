/**
 * ClusterPermissionsTable Component
 *
 * Reusable table for editing cluster permissions with checkboxes for actions.
 * Used by both CreateGroupModal and EditGroupModal.
 *
 * **Features:**
 * - Displays all available targets (clusters) in a table
 * - Checkboxes for view/run/cancel actions per cluster
 * - Detects orphaned clusters (in permissions but not in targets)
 * - Optional warning badges for orphaned clusters
 * - Select All / Deselect All functionality per action column
 *
 * @component
 */

import {
  Checkbox,
  Badge,
  Button,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import type { ClusterPermissions, TargetResponse } from '../types/api';

interface ClusterPermissionsTableProps {
  /** Available target clusters */
  targets: TargetResponse[];
  /** Current cluster permissions */
  clusterPermissions: ClusterPermissions;
  /** Callback when permissions change */
  onChange: (permissions: ClusterPermissions) => void;
  /** Whether to show warning for orphaned clusters */
  showOrphanedWarning?: boolean;
}

type Action = 'view' | 'run' | 'cancel';

/**
 * ClusterPermissionsTable - Table for managing cluster permissions
 *
 * Provides a checkbox-based interface for selecting cluster actions.
 * Handles both active clusters (from targets) and orphaned clusters
 * (in permissions but not in targets).
 *
 * **Table Structure:**
 * - Column 1: Cluster Name
 * - Column 2: Cluster API URL
 * - Column 3-5: Checkboxes for view/run/cancel actions
 *
 * **Orphaned Clusters:**
 * Clusters that exist in clusterPermissions but not in targets are:
 * - Listed at the end of the table
 * - Shown with a "Removed" badge
 * - Still editable (can be removed by unchecking all actions)
 *
 * @example
 * ```tsx
 * <ClusterPermissionsTable
 *   targets={targets}
 *   clusterPermissions={clusterPermissions}
 *   onChange={setClusterPermissions}
 *   showOrphanedWarning
 * />
 * ```
 */
export function ClusterPermissionsTable({
  targets,
  clusterPermissions,
  onChange,
  showOrphanedWarning = false,
}: ClusterPermissionsTableProps) {
  // Get all cluster API URLs from targets
  const targetUrls = new Set(targets.map((t) => t.clusterAPIURL));

  // Identify orphaned clusters (in permissions but not in targets)
  const orphanedUrls = Object.keys(clusterPermissions).filter((url) => !targetUrls.has(url));

  // Helper to check if an action is selected for a cluster
  const hasAction = (clusterUrl: string, action: Action): boolean => {
    const perms = clusterPermissions[clusterUrl];
    return perms?.actions?.includes(action) || false;
  };

  // Toggle an action for a cluster
  const toggleAction = (clusterUrl: string, action: Action) => {
    const currentPerms = clusterPermissions[clusterUrl] || { actions: [] };
    const currentActions = currentPerms.actions || [];

    let newActions: Action[];
    if (currentActions.includes(action)) {
      // Remove action
      newActions = currentActions.filter((a) => a !== action);
    } else {
      // Add action
      newActions = [...currentActions, action];
    }

    // If no actions remain, remove the cluster from permissions
    if (newActions.length === 0) {
      const { [clusterUrl]: _, ...rest } = clusterPermissions;
      onChange(rest);
    } else {
      onChange({
        ...clusterPermissions,
        [clusterUrl]: { actions: newActions },
      });
    }
  };

  // Select all clusters for a specific action
  const selectAllForAction = (action: Action) => {
    const updated = { ...clusterPermissions };

    targets.forEach((target) => {
      const url = target.clusterAPIURL;
      const current = updated[url] || { actions: [] };
      if (!current.actions.includes(action)) {
        updated[url] = {
          actions: [...current.actions, action],
        };
      }
    });

    onChange(updated);
  };

  // Deselect all clusters for a specific action
  const deselectAllForAction = (action: Action) => {
    const updated = { ...clusterPermissions };

    Object.keys(updated).forEach((url) => {
      const current = updated[url];
      const newActions = current.actions.filter((a) => a !== action);

      if (newActions.length === 0) {
        delete updated[url];
      } else {
        updated[url] = { actions: newActions };
      }
    });

    onChange(updated);
  };

  // Check if all targets have a specific action
  const allHaveAction = (action: Action): boolean => {
    return targets.every((target) => hasAction(target.clusterAPIURL, action));
  };

  if (targets.length === 0 && orphanedUrls.length === 0) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--pf-v5-global--Color--200)' }}>
        No clusters available. Please add target clusters first.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <Table aria-label="Cluster permissions table" variant="compact">
        <Thead>
          <Tr>
            <Th>Cluster Name</Th>
            <Th>Cluster API URL</Th>
            <Th>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span>View</span>
                <div style={{ fontSize: '0.75rem' }}>
                  <Button
                    variant="link"
                    isInline
                    onClick={() => selectAllForAction('view')}
                    isDisabled={allHaveAction('view')}
                  >
                    All
                  </Button>
                  {' / '}
                  <Button
                    variant="link"
                    isInline
                    onClick={() => deselectAllForAction('view')}
                    isDisabled={!Object.values(clusterPermissions).some((p) => p.actions.includes('view'))}
                  >
                    None
                  </Button>
                </div>
              </div>
            </Th>
            <Th>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span>Run</span>
                <div style={{ fontSize: '0.75rem' }}>
                  <Button
                    variant="link"
                    isInline
                    onClick={() => selectAllForAction('run')}
                    isDisabled={allHaveAction('run')}
                  >
                    All
                  </Button>
                  {' / '}
                  <Button
                    variant="link"
                    isInline
                    onClick={() => deselectAllForAction('run')}
                    isDisabled={!Object.values(clusterPermissions).some((p) => p.actions.includes('run'))}
                  >
                    None
                  </Button>
                </div>
              </div>
            </Th>
            <Th>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span>Cancel</span>
                <div style={{ fontSize: '0.75rem' }}>
                  <Button
                    variant="link"
                    isInline
                    onClick={() => selectAllForAction('cancel')}
                    isDisabled={allHaveAction('cancel')}
                  >
                    All
                  </Button>
                  {' / '}
                  <Button
                    variant="link"
                    isInline
                    onClick={() => deselectAllForAction('cancel')}
                    isDisabled={!Object.values(clusterPermissions).some((p) => p.actions.includes('cancel'))}
                  >
                    None
                  </Button>
                </div>
              </div>
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {/* Active targets */}
          {targets.map((target) => (
            <Tr key={target.clusterAPIURL}>
              <Td dataLabel="Cluster Name">{target.clusterName}</Td>
              <Td dataLabel="Cluster API URL">
                <span style={{ fontSize: '0.875rem', color: 'var(--pf-v5-global--Color--200)' }}>
                  {target.clusterAPIURL}
                </span>
              </Td>
              <Td dataLabel="View">
                <Checkbox
                  id={`${target.uuid}-view`}
                  isChecked={hasAction(target.clusterAPIURL, 'view')}
                  onChange={() => toggleAction(target.clusterAPIURL, 'view')}
                  aria-label={`View permission for ${target.clusterName}`}
                />
              </Td>
              <Td dataLabel="Run">
                <Checkbox
                  id={`${target.uuid}-run`}
                  isChecked={hasAction(target.clusterAPIURL, 'run')}
                  onChange={() => toggleAction(target.clusterAPIURL, 'run')}
                  aria-label={`Run permission for ${target.clusterName}`}
                />
              </Td>
              <Td dataLabel="Cancel">
                <Checkbox
                  id={`${target.uuid}-cancel`}
                  isChecked={hasAction(target.clusterAPIURL, 'cancel')}
                  onChange={() => toggleAction(target.clusterAPIURL, 'cancel')}
                  aria-label={`Cancel permission for ${target.clusterName}`}
                />
              </Td>
            </Tr>
          ))}

          {/* Orphaned clusters (in permissions but not in targets) */}
          {orphanedUrls.map((url) => (
            <Tr key={url}>
              <Td dataLabel="Cluster Name">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>Unknown</span>
                  {showOrphanedWarning && <Badge>Removed</Badge>}
                </div>
              </Td>
              <Td dataLabel="Cluster API URL">
                <span style={{ fontSize: '0.875rem', color: 'var(--pf-v5-global--Color--200)' }}>
                  {url}
                </span>
              </Td>
              <Td dataLabel="View">
                <Checkbox
                  id={`${url}-view`}
                  isChecked={hasAction(url, 'view')}
                  onChange={() => toggleAction(url, 'view')}
                  aria-label={`View permission for ${url}`}
                />
              </Td>
              <Td dataLabel="Run">
                <Checkbox
                  id={`${url}-run`}
                  isChecked={hasAction(url, 'run')}
                  onChange={() => toggleAction(url, 'run')}
                  aria-label={`Run permission for ${url}`}
                />
              </Td>
              <Td dataLabel="Cancel">
                <Checkbox
                  id={`${url}-cancel`}
                  isChecked={hasAction(url, 'cancel')}
                  onChange={() => toggleAction(url, 'cancel')}
                  aria-label={`Cancel permission for ${url}`}
                />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
