/**
 * RobotGroupsModal component
 *
 * Manages a robot's group MEMBERSHIP only. Groups are listed from
 * groupsApi.listGroups() with a read-only summary of what each group grants
 * (N clusters with view/run/cancel) — the permissions themselves are never
 * editable here and groupsApi.updateGroup is never called. Saving sends the
 * FULL set of group names via robotsApi.setRobotGroups (which replaces all
 * labels).
 *
 * @component
 */

import { useEffect, useState } from 'react';
import {
  ActionGroup,
  Alert,
  Button,
  Checkbox,
  Form,
  FormGroup,
  Modal,
  ModalVariant,
  Spinner,
} from '@patternfly/react-core';
import { groupsApi } from '../../services/groupsApi';
import { robotsApi } from '../../services/robotsApi';
import { isApiError } from '../../utils/apiClient';
import type { GroupDetails, RobotDetails } from '../../types/api';

interface RobotGroupsModalProps {
  /** Robot whose groups are being managed */
  robot: RobotDetails;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when the modal is dismissed */
  onClose: () => void;
  /** Called after the group set is saved */
  onSuccess: () => void;
  /** Optional navigation to the Users & Groups settings tab */
  onNavigateToGroups?: () => void;
}

export function RobotGroupsModal({
  robot,
  isOpen,
  onClose,
  onSuccess,
  onNavigateToGroups,
}: RobotGroupsModalProps) {
  const [allGroups, setAllGroups] = useState<GroupDetails[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(robot.groups));
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all groups and seed the selection from the robot each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setSelected(new Set(robot.groups));
      setError(null);
      setLoading(true);
      groupsApi
        .listGroups()
        .then((data) => setAllGroups(data))
        .catch(() => {
          setAllGroups([]);
          setError('Failed to load groups. Reload and retry.');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, robot]);

  const toggleGroup = (groupName: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(groupName);
      } else {
        next.delete(groupName);
      }
      return next;
    });
  };

  // Adds/Removes diff against the robot's current groups
  const adds = [...selected].filter((g) => !robot.groups.includes(g));
  const removes = robot.groups.filter((g) => !selected.has(g));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Send the FULL set — setRobotGroups replaces all group labels
      await robotsApi.setRobotGroups(robot.name, [...selected]);
      onSuccess();
    } catch (err) {
      if (isApiError(err) && err.status === 500) {
        setError('Update failed, reload and retry');
      } else if (isApiError(err) && err.status === 404) {
        setError('Robot no longer exists');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to update groups');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      variant={ModalVariant.medium}
      title={`Manage Groups: ${robot.name}`}
      isOpen={isOpen}
      onClose={onClose}
    >
      <Form>
        {loading ? (
          <Spinner size="lg" />
        ) : (
          <FormGroup fieldId="robot-group-membership">
            {allGroups.length === 0 ? (
              <Alert variant="info" title="No groups exist" isInline>
                Create groups in Users &amp; Groups first — a robot without groups has no cluster
                access.
              </Alert>
            ) : (
              <div>
                {allGroups.map((group) => {
                  const clusterCount = Object.keys(group.clusterPermissions || {}).length;
                  return (
                    <div
                      key={group.name}
                      style={{
                        padding: '0.5rem 0',
                        borderBottom: '1px solid var(--pf-v5-global--BorderColor--100)',
                      }}
                    >
                      <Checkbox
                        id={`robot-group-${group.name}`}
                        name={`robot-group-${group.name}`}
                        label={group.name}
                        description={group.description}
                        isChecked={selected.has(group.name)}
                        onChange={(_event, checked) => toggleGroup(group.name, checked)}
                        isDisabled={submitting}
                      />
                      <div
                        style={{
                          marginLeft: '1.75rem',
                          fontSize: 'var(--pf-v5-global--FontSize--sm)',
                          color: 'var(--pf-v5-global--Color--200)',
                        }}
                      >
                        grants: {clusterCount} clusters (view/run/cancel)
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </FormGroup>
        )}

        {/* Diff summary */}
        {(adds.length > 0 || removes.length > 0) && (
          <div style={{ margin: '1rem 0' }}>
            {adds.length > 0 && <div>Adds: {adds.join(', ')}</div>}
            {removes.length > 0 && <div>Removes: {removes.join(', ')}</div>}
          </div>
        )}

        {selected.size === 0 && (
          <Alert variant="warning" title="No groups selected" isInline>
            The robot will belong to no groups and have no cluster access.
          </Alert>
        )}

        {error && <Alert variant="danger" title={error} isInline />}

        <ActionGroup>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={submitting}
            isDisabled={submitting || loading}
          >
            Save Groups
          </Button>
          <Button variant="link" onClick={onClose} isDisabled={submitting}>
            Cancel
          </Button>
        </ActionGroup>

        <p>
          Group membership controls which clusters the robot can access. To change what a group
          itself can do, edit it in Users &amp; Groups.{' '}
          <Button variant="link" isInline onClick={onNavigateToGroups}>
            Edit what a group can do → Users &amp; Groups
          </Button>
        </p>
      </Form>
    </Modal>
  );
}
