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
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  ToolbarGroup,
} from '@patternfly/react-core';
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
  /** Whether to show bulk action toolbar (All/None buttons) */
  showBulkActions?: boolean;
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
  showBulkActions = true,
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
    <div>
      {showBulkActions && (
        <Toolbar>
          <ToolbarContent>
            <ToolbarGroup>
              <ToolbarItem>
                <strong style={{ marginRight: '0.5rem' }}>View:</strong>
                <Button
                  variant="link"
                  isInline
                  onClick={() => selectAllForAction('view')}
                  isDisabled={allHaveAction('view')}
                  size="sm"
                >
                  All
                </Button>
                {' / '}
                <Button
                  variant="link"
                  isInline
                  onClick={() => deselectAllForAction('view')}
                  isDisabled={!Object.values(clusterPermissions).some((p) => p.actions.includes('view'))}
                  size="sm"
                >
                  None
                </Button>
              </ToolbarItem>
              <ToolbarItem>
                <strong style={{ marginRight: '0.5rem' }}>Run:</strong>
                <Button
                  variant="link"
                  isInline
                  onClick={() => selectAllForAction('run')}
                  isDisabled={allHaveAction('run')}
                  size="sm"
                >
                  All
                </Button>
                {' / '}
                <Button
                  variant="link"
                  isInline
                  onClick={() => deselectAllForAction('run')}
                  isDisabled={!Object.values(clusterPermissions).some((p) => p.actions.includes('run'))}
                  size="sm"
                >
                  None
                </Button>
              </ToolbarItem>
              <ToolbarItem>
                <strong style={{ marginRight: '0.5rem' }}>Cancel:</strong>
                <Button
                  variant="link"
                  isInline
                  onClick={() => selectAllForAction('cancel')}
                  isDisabled={allHaveAction('cancel')}
                  size="sm"
                >
                  All
                </Button>
                {' / '}
                <Button
                  variant="link"
                  isInline
                  onClick={() => deselectAllForAction('cancel')}
                  isDisabled={!Object.values(clusterPermissions).some((p) => p.actions.includes('cancel'))}
                  size="sm"
                >
                  None
                </Button>
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      )}

      <DataList aria-label="Cluster permissions list" isCompact>
        {/* Active targets */}
        {targets.map((target) => (
          <DataListItem key={target.clusterAPIURL}>
            <DataListItemRow>
              <DataListItemCells
                dataListCells={[
                  <DataListCell key="name" width={2}>
                    <div>
                      <div style={{ marginBottom: '0.25rem' }}>
                        <strong style={{ fontSize: 'var(--pf-v5-global--FontSize--md)' }}>
                          {target.clusterName}
                        </strong>
                      </div>
                      <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)', color: 'var(--pf-v5-global--Color--200)' }}>
                        {target.clusterAPIURL}
                      </div>
                    </div>
                  </DataListCell>,
                  <DataListCell key="view" width={1}>
                    <div>
                      <div style={{ marginBottom: '0.25rem' }}>
                        <strong>View:</strong>
                      </div>
                      <Checkbox
                        id={`${target.uuid}-view`}
                        isChecked={hasAction(target.clusterAPIURL, 'view')}
                        onChange={() => toggleAction(target.clusterAPIURL, 'view')}
                        aria-label={`View permission for ${target.clusterName}`}
                      />
                    </div>
                  </DataListCell>,
                  <DataListCell key="run" width={1}>
                    <div>
                      <div style={{ marginBottom: '0.25rem' }}>
                        <strong>Run:</strong>
                      </div>
                      <Checkbox
                        id={`${target.uuid}-run`}
                        isChecked={hasAction(target.clusterAPIURL, 'run')}
                        onChange={() => toggleAction(target.clusterAPIURL, 'run')}
                        aria-label={`Run permission for ${target.clusterName}`}
                      />
                    </div>
                  </DataListCell>,
                  <DataListCell key="cancel" width={1}>
                    <div>
                      <div style={{ marginBottom: '0.25rem' }}>
                        <strong>Cancel:</strong>
                      </div>
                      <Checkbox
                        id={`${target.uuid}-cancel`}
                        isChecked={hasAction(target.clusterAPIURL, 'cancel')}
                        onChange={() => toggleAction(target.clusterAPIURL, 'cancel')}
                        aria-label={`Cancel permission for ${target.clusterName}`}
                      />
                    </div>
                  </DataListCell>,
                ]}
              />
            </DataListItemRow>
          </DataListItem>
        ))}

        {/* Orphaned clusters (in permissions but not in targets) */}
        {orphanedUrls.map((url) => (
          <DataListItem key={url}>
            <DataListItemRow>
              <DataListItemCells
                dataListCells={[
                  <DataListCell key="name" width={2}>
                    <div>
                      <div style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: 'var(--pf-v5-global--FontSize--md)', color: 'var(--pf-v5-global--Color--200)' }}>
                          Unknown
                        </strong>
                        {showOrphanedWarning && <Badge>Removed</Badge>}
                      </div>
                      <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)', color: 'var(--pf-v5-global--Color--200)' }}>
                        {url}
                      </div>
                    </div>
                  </DataListCell>,
                  <DataListCell key="view" width={1}>
                    <div>
                      <div style={{ marginBottom: '0.25rem' }}>
                        <strong>View:</strong>
                      </div>
                      <Checkbox
                        id={`${url}-view`}
                        isChecked={hasAction(url, 'view')}
                        onChange={() => toggleAction(url, 'view')}
                        aria-label={`View permission for ${url}`}
                      />
                    </div>
                  </DataListCell>,
                  <DataListCell key="run" width={1}>
                    <div>
                      <div style={{ marginBottom: '0.25rem' }}>
                        <strong>Run:</strong>
                      </div>
                      <Checkbox
                        id={`${url}-run`}
                        isChecked={hasAction(url, 'run')}
                        onChange={() => toggleAction(url, 'run')}
                        aria-label={`Run permission for ${url}`}
                      />
                    </div>
                  </DataListCell>,
                  <DataListCell key="cancel" width={1}>
                    <div>
                      <div style={{ marginBottom: '0.25rem' }}>
                        <strong>Cancel:</strong>
                      </div>
                      <Checkbox
                        id={`${url}-cancel`}
                        isChecked={hasAction(url, 'cancel')}
                        onChange={() => toggleAction(url, 'cancel')}
                        aria-label={`Cancel permission for ${url}`}
                      />
                    </div>
                  </DataListCell>,
                ]}
              />
            </DataListItemRow>
          </DataListItem>
        ))}
      </DataList>
    </div>
  );
}
