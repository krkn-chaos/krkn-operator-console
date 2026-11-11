/**
 * RobotsCard component
 *
 * Settings tab body for managing MCP robots: admin-created service accounts
 * that authenticate ONLY to the MCP endpoint (/api/mcp) with long-lived
 * tokens. Robot tokens cannot sign in to this console.
 *
 * **Features:**
 * - Persistent info/warning alert about the MCP endpoint and mcp.enabled
 * - Table of robots with token status derived via deriveRobotTokenState
 * - Row kebab menu: Edit, Manage groups, Issue/Rotate token, Revoke token,
 *   Disable/Enable, Delete (with confirmation modals)
 * - One-time token reveal handled by TokenRevealModal; the token value lives
 *   ONLY in this component's useState and is cleared on close — never in a
 *   reducer, context, URL, log, or toast
 * - Loading / empty / error / 404-unsupported (old operator) states
 *
 * @component
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  Flex,
  FlexItem,
  Label,
  MenuToggle,
  Spinner,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import {
  BanIcon,
  CheckIcon,
  EllipsisVIcon,
  KeyIcon,
  PlusCircleIcon,
  RobotIcon,
  TrashIcon,
  EditIcon,
  UsersIcon,
  SyncIcon,
} from '@patternfly/react-icons';
import { robotsApi } from '../../services/robotsApi';
import { isApiError } from '../../utils/apiClient';
import {
  deriveRobotTokenState,
  formatExpiry,
  type RobotTokenState,
} from '../../utils/robotTokenStatus';
import { useNotifications } from '../../hooks/useNotifications';
import type { IssueRobotTokenResponse, RobotDetails } from '../../types/api';
import { CreateRobotModal } from './CreateRobotModal';
import { EditRobotModal } from './EditRobotModal';
import { RobotGroupsModal } from './RobotGroupsModal';
import { RobotConfirmModal, type RobotConfirmAction } from './RobotConfirmModal';
import { TokenRevealModal } from './TokenRevealModal';

const TOKEN_LABEL_COLORS: Record<RobotTokenState, 'green' | 'orange' | 'red' | 'grey'> = {
  active: 'green',
  expiring: 'orange',
  expired: 'red',
  none: 'grey',
  disabled: 'grey',
};

const WITHIN_FIVE_MINUTES_MS = 5 * 60 * 1000;

interface RobotsCardProps {
  /** Optional navigation to the Users & Groups settings tab */
  onNavigateToGroups?: () => void;
}

interface TokenRevealState {
  token: string;
  tokenId: string;
  expiresAt: string;
  robotName: string;
}

/** Maps action errors to user-facing messages (never includes token values). */
function actionErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    switch (error.status) {
      case 400:
      case 409:
        return error.message;
      case 403:
        return 'Admin privileges required';
      case 404:
        return 'Robot no longer exists';
      default:
        return 'Something went wrong. Please try again.';
    }
  }
  return error instanceof Error ? error.message : 'Unknown error';
}

export function RobotsCard({ onNavigateToGroups }: RobotsCardProps = {}) {
  const { showSuccess, showError } = useNotifications();

  const [robots, setRobots] = useState<RobotDetails[]>([]);
  const [mcpEnabled, setMcpEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  /** 'error' = fetch failed (retryable), 'unsupported' = HTTP 404 (old operator) */
  const [loadError, setLoadError] = useState<'error' | 'unsupported' | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRobot, setEditingRobot] = useState<RobotDetails | null>(null);
  const [groupsRobot, setGroupsRobot] = useState<RobotDetails | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: RobotConfirmAction; robot: RobotDetails } | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // The one-time token value lives ONLY here, in useState. Cleared on close.
  const [tokenReveal, setTokenReveal] = useState<TokenRevealState | null>(null);

  const loadRobots = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await robotsApi.listRobots();
      setRobots(data.robots);
      setMcpEnabled(data.mcpEnabled);
    } catch (error) {
      setRobots([]);
      if (isApiError(error) && error.status === 404) {
        // Old operator without robot support — no retry loop
        setLoadError('unsupported');
      } else {
        setLoadError('error');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRobots();
  }, [loadRobots]);

  /** Shared error handling for kebab/confirm actions. Returns an inline message. */
  const handleActionError = (error: unknown): string => {
    const message = actionErrorMessage(error);
    if (isApiError(error) && error.status === 404) {
      loadRobots(); // refetch — the robot is gone
    }
    return message;
  };

  const handleIssueToken = async (robot: RobotDetails) => {
    setOpenDropdownId(null);
    try {
      const issued: IssueRobotTokenResponse = await robotsApi.issueRobotToken(robot.name);
      setTokenReveal({
        token: issued.token,
        tokenId: issued.tokenId,
        expiresAt: issued.expiresAt,
        robotName: robot.name,
      });
      // Success toast never contains the token value
      showSuccess('Token issued', `A new token was issued for "${robot.name}" — it is shown only once.`);
      loadRobots();
    } catch (error) {
      showError('Failed to issue token', handleActionError(error));
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { action, robot } = confirmAction;

    setActionSubmitting(true);
    setConfirmError(null);
    try {
      switch (action) {
        case 'rotate': {
          const issued = await robotsApi.issueRobotToken(robot.name);
          setConfirmAction(null);
          setTokenReveal({
            token: issued.token,
            tokenId: issued.tokenId,
            expiresAt: issued.expiresAt,
            robotName: robot.name,
          });
          showSuccess('Token rotated', `A new token was issued for "${robot.name}" — it is shown only once.`);
          loadRobots();
          break;
        }
        case 'revoke':
          await robotsApi.revokeRobotToken(robot.name);
          showSuccess('Token revoked', `The token for "${robot.name}" has been revoked`);
          setConfirmAction(null);
          loadRobots();
          break;
        case 'disable':
          await robotsApi.setRobotDisabled(robot.name, true);
          showSuccess('Robot disabled', `Robot "${robot.name}" has been disabled`);
          setConfirmAction(null);
          loadRobots();
          break;
        case 'enable':
          await robotsApi.setRobotDisabled(robot.name, false);
          showSuccess('Robot enabled', `Robot "${robot.name}" has been enabled`);
          setConfirmAction(null);
          loadRobots();
          break;
        case 'delete':
          await robotsApi.deleteRobot(robot.name);
          showSuccess('Robot deleted', `Robot "${robot.name}" has been deleted`);
          setConfirmAction(null);
          loadRobots();
          break;
      }
    } catch (error) {
      // Inline in the confirm modal (400/409 server message, 403 admin,
      // 404 gone + refetch, 500 generic + retry via the confirm button)
      setConfirmError(handleActionError(error));
    } finally {
      setActionSubmitting(false);
    }
  };

  const openConfirm = (action: RobotConfirmAction, robot: RobotDetails) => {
    setOpenDropdownId(null);
    setConfirmError(null);
    setConfirmAction({ action, robot });
  };

  const formatLastUsed = (robot: RobotDetails): string => {
    if (!robot.lastUsedAt) {
      return 'Never';
    }
    const lastUsed = new Date(robot.lastUsedAt);
    if (Number.isNaN(lastUsed.getTime())) {
      return 'Never';
    }
    const withinFiveMinutes = Date.now() - lastUsed.getTime() < WITHIN_FIVE_MINUTES_MS;
    return `${lastUsed.toLocaleString()}${withinFiveMinutes ? ' (within 5 min)' : ''}`;
  };

  const formatCreated = (robot: RobotDetails): string => {
    const created = new Date(robot.createdAt);
    return Number.isNaN(created.getTime()) ? '—' : created.toLocaleString();
  };

  const renderTokenExpiry = (robot: RobotDetails): string => {
    if (!robot.tokenId || !robot.tokenExpiresAt) {
      return '—';
    }
    return formatExpiry(robot.tokenExpiresAt, new Date());
  };

  const renderKebab = (robot: RobotDetails) => {
    const state = deriveRobotTokenState(robot, new Date());
    const canIssue = (state === 'none' || state === 'expired') && !robot.disabled;
    const canRotate = (state === 'active' || state === 'expiring') && !robot.disabled;
    const canRevoke = robot.tokenId !== '';

    return (
      <Dropdown
        isOpen={openDropdownId === robot.name}
        onOpenChange={(isOpen) => setOpenDropdownId(isOpen ? robot.name : null)}
        toggle={(toggleRef) => (
          <MenuToggle
            ref={toggleRef}
            onClick={() => setOpenDropdownId(openDropdownId === robot.name ? null : robot.name)}
            variant="plain"
            aria-label={`Robot actions for ${robot.name}`}
          >
            <EllipsisVIcon />
          </MenuToggle>
        )}
      >
        <DropdownList>
          <DropdownItem
            key="edit"
            icon={<EditIcon />}
            onClick={() => {
              setEditingRobot(robot);
              setOpenDropdownId(null);
            }}
          >
            Edit
          </DropdownItem>
          <DropdownItem
            key="groups"
            icon={<UsersIcon />}
            onClick={() => {
              setGroupsRobot(robot);
              setOpenDropdownId(null);
            }}
          >
            Manage groups
          </DropdownItem>
          {canRotate ? (
            <DropdownItem
              key="rotate"
              icon={<SyncIcon />}
              onClick={() => openConfirm('rotate', robot)}
            >
              Rotate token
            </DropdownItem>
          ) : robot.disabled ? (
            <Tooltip content="Enable the robot to issue a token" position="left">
              <DropdownItem key="issue" icon={<KeyIcon />} isDisabled>
                Issue token
              </DropdownItem>
            </Tooltip>
          ) : (
            <DropdownItem
              key="issue"
              icon={<KeyIcon />}
              isDisabled={!canIssue}
              onClick={() => canIssue && handleIssueToken(robot)}
            >
              Issue token
            </DropdownItem>
          )}
          {canRevoke && (
            <DropdownItem
              key="revoke"
              icon={<BanIcon />}
              onClick={() => openConfirm('revoke', robot)}
            >
              Revoke token
            </DropdownItem>
          )}
          <DropdownItem
            key="disable"
            icon={<BanIcon />}
            onClick={() => openConfirm(robot.disabled ? 'enable' : 'disable', robot)}
          >
            {robot.disabled ? 'Enable' : 'Disable'}
          </DropdownItem>
          <DropdownItem
            key="delete"
            icon={<TrashIcon />}
            onClick={() => openConfirm('delete', robot)}
            style={{ color: 'var(--pf-v5-global--danger-color--100)' }}
          >
            Delete
          </DropdownItem>
        </DropdownList>
      </Dropdown>
    );
  };

  const endpoint = `${window.location.origin}/api/mcp`;

  return (
    <Card>
      <CardTitle>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            <Title headingLevel="h2" size="lg">
              MCP Robots ({robots.length})
            </Title>
          </FlexItem>
          <FlexItem>
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setIsCreateOpen(true)}>
              Create robot
            </Button>
          </FlexItem>
        </Flex>
      </CardTitle>
      <CardBody>
        {mcpEnabled ? (
          <Alert
            variant="info"
            title="Robot tokens authenticate only to the MCP endpoint"
            isInline
            style={{ marginBottom: '1rem' }}
          >
            <p>
              Robot tokens authenticate ONLY to the MCP endpoint <code>{endpoint}</code>, enabled by
              the operator setting <code>mcp.enabled</code> / <code>KRKN_MCP_ENABLED</code>.
            </p>
            <p>Robot tokens cannot sign in to this console.</p>
          </Alert>
        ) : (
          <Alert
            variant="warning"
            title="MCP endpoint is disabled on this operator"
            isInline
            style={{ marginBottom: '1rem' }}
          >
            MCP endpoint is disabled on this operator — issued tokens will not work until it is
            enabled. Tokens authenticate only to <code>{endpoint}</code> (setting{' '}
            <code>mcp.enabled</code> / <code>KRKN_MCP_ENABLED</code>) and cannot sign in to this
            console.
          </Alert>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Spinner size="xl" />
          </div>
        ) : loadError === 'unsupported' ? (
          <EmptyState>
            <EmptyStateIcon icon={RobotIcon} />
            <Title headingLevel="h3" size="lg">
              Robot accounts are not supported by this operator version
            </Title>
            <EmptyStateBody>
              Update the krkn operator to manage MCP robots from this console.
            </EmptyStateBody>
          </EmptyState>
        ) : loadError === 'error' ? (
          <EmptyState>
            <EmptyStateIcon icon={RobotIcon} />
            <Title headingLevel="h3" size="lg">
              Failed to load robots
            </Title>
            <EmptyStateBody>
              An error occurred while loading the robots list.
            </EmptyStateBody>
            <Button variant="primary" onClick={loadRobots}>
              Retry
            </Button>
          </EmptyState>
        ) : robots.length === 0 ? (
          <EmptyState>
            <EmptyStateIcon icon={RobotIcon} />
            <Title headingLevel="h3" size="lg">
              No robots yet
            </Title>
            <EmptyStateBody>
              Robots are service accounts that authenticate to the MCP endpoint. Create one to let
              automated clients run chaos scenarios.
            </EmptyStateBody>
            <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
              Create robot
            </Button>
          </EmptyState>
        ) : (
          <Table variant="compact" borders aria-label="MCP robots list">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Groups</Th>
                <Th>Token status</Th>
                <Th>Token expiry</Th>
                <Th>Last used</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {robots.map((robot) => {
                const state = deriveRobotTokenState(robot, new Date());
                return (
                  <Tr key={robot.name}>
                    <Td dataLabel="Name">
                      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsXs' }}>
                        <FlexItem>
                          <strong>{robot.name}</strong>
                        </FlexItem>
                        {robot.disabled && (
                          <FlexItem>
                            <Label color="grey" icon={<BanIcon />}>
                              Disabled
                            </Label>
                          </FlexItem>
                        )}
                      </Flex>
                    </Td>
                    <Td dataLabel="Description">{robot.description || '—'}</Td>
                    <Td dataLabel="Groups">
                      {robot.groups.length === 0 ? (
                        '—'
                      ) : (
                        <Flex spaceItems={{ default: 'spaceItemsXs' }}>
                          {robot.groups.map((group) => (
                            <FlexItem key={group}>
                              <Label color="blue">{group}</Label>
                            </FlexItem>
                          ))}
                        </Flex>
                      )}
                    </Td>
                    <Td dataLabel="Token status">
                      <Label color={TOKEN_LABEL_COLORS[state]} icon={state === 'active' ? <CheckIcon /> : undefined}>
                        {state}
                      </Label>
                    </Td>
                    <Td dataLabel="Token expiry">{renderTokenExpiry(robot)}</Td>
                    <Td dataLabel="Last used">{formatLastUsed(robot)}</Td>
                    <Td dataLabel="Created">{formatCreated(robot)}</Td>
                    <Td dataLabel="Actions">{renderKebab(robot)}</Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </CardBody>

      <CreateRobotModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          setIsCreateOpen(false);
          loadRobots();
        }}
        onTokenIssued={(issued, robotName) =>
          setTokenReveal({
            token: issued.token,
            tokenId: issued.tokenId,
            expiresAt: issued.expiresAt,
            robotName,
          })
        }
      />

      {editingRobot && (
        <EditRobotModal
          robot={editingRobot}
          isOpen={true}
          onClose={() => setEditingRobot(null)}
          onSuccess={() => {
            setEditingRobot(null);
            loadRobots();
          }}
        />
      )}

      {groupsRobot && (
        <RobotGroupsModal
          robot={groupsRobot}
          isOpen={true}
          onClose={() => setGroupsRobot(null)}
          onSuccess={() => {
            setGroupsRobot(null);
            loadRobots();
          }}
          onNavigateToGroups={onNavigateToGroups}
        />
      )}

      <RobotConfirmModal
        action={confirmAction?.action ?? 'delete'}
        robotName={confirmAction?.robot.name ?? ''}
        isOpen={confirmAction !== null}
        isSubmitting={actionSubmitting}
        error={confirmError}
        onClose={() => {
          setConfirmAction(null);
          setConfirmError(null);
        }}
        onConfirm={handleConfirmAction}
      />

      {tokenReveal && (
        <TokenRevealModal
          isOpen={true}
          robotName={tokenReveal.robotName}
          token={tokenReveal.token}
          tokenId={tokenReveal.tokenId}
          expiresAt={tokenReveal.expiresAt}
          onClose={() => setTokenReveal(null)}
        />
      )}
    </Card>
  );
}
