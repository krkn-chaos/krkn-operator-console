/**
 * CreateRobotModal component
 *
 * Modal for creating a new MCP robot. Validates the robot name against the
 * backend's DNS-label-like pattern, counts the description in UTF-8 bytes,
 * and lets the admin pick optional groups from groupsApi.listGroups().
 *
 * When "Issue a token now" is checked, the token is requested immediately
 * after creation and handed to the parent (which owns the token value in
 * useState and opens TokenRevealModal). If creation succeeds but token issue
 * fails, a warning toast is shown and the robot simply appears without a
 * token.
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
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalVariant,
  Spinner,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { groupsApi } from '../../services/groupsApi';
import { robotsApi } from '../../services/robotsApi';
import { isApiError } from '../../utils/apiClient';
import { useNotifications } from '../../hooks/useNotifications';
import type { GroupDetails, IssueRobotTokenResponse } from '../../types/api';

/** Backend-validated robot name pattern (1–48 chars, DNS-label-like) */
const ROBOT_NAME_PATTERN = /^[a-z0-9]([-a-z0-9]{0,46}[a-z0-9])?$/;

const DESCRIPTION_MAX_BYTES = 256;

const utf8ByteLength = (value: string): number =>
  new TextEncoder().encode(value).length;

interface CreateRobotModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when the modal is dismissed */
  onClose: () => void;
  /** Called after the robot is created (and, if requested, its token issued) */
  onSuccess: () => void;
  /** Called with the one-time token when "Issue a token now" succeeds */
  onTokenIssued: (token: IssueRobotTokenResponse, robotName: string) => void;
}

export function CreateRobotModal({
  isOpen,
  onClose,
  onSuccess,
  onTokenIssued,
}: CreateRobotModalProps) {
  const { showWarning } = useNotifications();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [issueTokenNow, setIssueTokenNow] = useState(false);
  const [groups, setGroups] = useState<GroupDetails[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load available groups and reset the form each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setSelectedGroups([]);
      setIssueTokenNow(false);
      setErrors({});
      setGroupsError(null);
      setLoadingGroups(true);
      groupsApi
        .listGroups()
        .then((data) => setGroups(data))
        .catch(() => {
          setGroups([]);
          setGroupsError('Failed to load groups. You can still create the robot and manage its groups later.');
        })
        .finally(() => setLoadingGroups(false));
    }
  }, [isOpen]);

  const descriptionBytes = utf8ByteLength(description);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = 'Robot name is required';
    } else if (!ROBOT_NAME_PATTERN.test(name)) {
      newErrors.name =
        'Name must be 1-48 lowercase alphanumeric characters or hyphens, and must start and end with an alphanumeric character';
    }
    if (descriptionBytes > DESCRIPTION_MAX_BYTES) {
      newErrors.description = `Description must be at most ${DESCRIPTION_MAX_BYTES} bytes (UTF-8)`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const robot = await robotsApi.createRobot({
        name: name.trim(),
        description: description.trim() || undefined,
        groups: selectedGroups.length > 0 ? selectedGroups : undefined,
      });

      if (issueTokenNow) {
        try {
          const token = await robotsApi.issueRobotToken(robot.name);
          onTokenIssued(token, robot.name);
        } catch (issueError) {
          // Creation succeeded; only the token issue failed. The row will
          // show "no token". (Never include a token value here.)
          showWarning(
            'Token not issued',
            `Robot "${robot.name}" was created, but issuing its token failed: ${
              issueError instanceof Error ? issueError.message : 'Unknown error'
            }`
          );
        }
      }

      onSuccess();
    } catch (error) {
      if (isApiError(error) && error.status === 409) {
        setErrors({
          name: error.message || 'A robot with this name already exists',
        });
      } else if (isApiError(error) && error.status === 400) {
        const message = error.message || 'Invalid request';
        if (/group/i.test(message)) {
          setErrors({ groups: message });
        } else {
          setErrors({ name: message });
        }
      } else {
        setErrors({
          submit: error instanceof Error ? error.message : 'Failed to create robot',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleGroup = (groupName: string, checked: boolean) => {
    setSelectedGroups((prev) =>
      checked ? [...prev, groupName] : prev.filter((g) => g !== groupName)
    );
  };

  return (
    <Modal
      variant={ModalVariant.medium}
      title="Create Robot"
      isOpen={isOpen}
      onClose={onClose}
    >
      <Form>
        <FormGroup label="Name" isRequired fieldId="robot-name">
          <TextInput
            id="robot-name"
            value={name}
            onChange={(_event, value) => setName(value)}
            isRequired
            validated={errors.name ? 'error' : 'default'}
            isDisabled={submitting}
            placeholder="ci-runner"
            autoComplete="off"
          />
          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                1-48 characters; lowercase letters, numbers, and hyphens; must start and end with
                a letter or number
              </HelperTextItem>
              {errors.name && (
                <HelperTextItem variant="error">{errors.name}</HelperTextItem>
              )}
            </HelperText>
          </FormHelperText>
        </FormGroup>

        <FormGroup label="Description" fieldId="robot-description">
          <TextArea
            id="robot-description"
            value={description}
            onChange={(_event, value) => setDescription(value)}
            isDisabled={submitting}
            rows={3}
            validated={errors.description ? 'error' : 'default'}
          />
          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                Optional. {descriptionBytes} / {DESCRIPTION_MAX_BYTES} bytes (UTF-8)
              </HelperTextItem>
              {errors.description && (
                <HelperTextItem variant="error">{errors.description}</HelperTextItem>
              )}
            </HelperText>
          </FormHelperText>
        </FormGroup>

        <FormGroup label="Groups" fieldId="robot-groups">
          {loadingGroups ? (
            <Spinner size="lg" />
          ) : groupsError ? (
            <Alert variant="warning" title={groupsError} isInline />
          ) : (
            <div aria-label="Robot groups">
              {groups.map((group) => (
                <Checkbox
                  key={group.name}
                  id={`robot-group-${group.name}`}
                  name={`robot-group-${group.name}`}
                  label={group.name}
                  description={group.description}
                  isChecked={selectedGroups.includes(group.name)}
                  onChange={(_event, checked) => toggleGroup(group.name, checked)}
                  isDisabled={submitting}
                />
              ))}
            </div>
          )}
          <FormHelperText>
            <HelperText>
              {selectedGroups.length === 0 && (
                <HelperTextItem variant="warning">
                  No groups = no cluster access. Robots inherit their groups&apos; cluster
                  permissions.
                </HelperTextItem>
              )}
              {errors.groups && (
                <HelperTextItem variant="error">{errors.groups}</HelperTextItem>
              )}
            </HelperText>
          </FormHelperText>
        </FormGroup>

        <FormGroup fieldId="robot-issue-token">
          <Checkbox
            id="robot-issue-token"
            name="robot-issue-token"
            label="Issue a token now"
            description="The token is shown once immediately after creation."
            isChecked={issueTokenNow}
            onChange={(_event, checked) => setIssueTokenNow(checked)}
            isDisabled={submitting}
          />
        </FormGroup>

        {errors.submit && (
          <Alert variant="danger" title={errors.submit} isInline />
        )}

        <ActionGroup>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={submitting}
            isDisabled={submitting}
          >
            Create Robot
          </Button>
          <Button variant="link" onClick={onClose} isDisabled={submitting}>
            Cancel
          </Button>
        </ActionGroup>
      </Form>
    </Modal>
  );
}
