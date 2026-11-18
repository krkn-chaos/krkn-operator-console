import { Tooltip } from '@patternfly/react-core';
import { DisconnectedIcon } from '@patternfly/react-icons';

interface ClusterOfflineIndicatorProps {
  /** When the cluster's liveness was last checked (ISO 8601) */
  checkedAt?: string;
}

function formatCheckedAt(checkedAt?: string): string {
  if (!checkedAt) return 'unknown';

  const date = new Date(checkedAt);
  if (Number.isNaN(date.getTime())) return checkedAt;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/**
 * Disconnected icon with a tooltip saying the cluster is offline and when
 * that was last checked. Render it next to the cluster name.
 *
 * @example
 * ```tsx
 * {cluster.online === false && <ClusterOfflineIndicator checkedAt={cluster.checkedAt} />}
 * ```
 */
export function ClusterOfflineIndicator({ checkedAt }: ClusterOfflineIndicatorProps) {
  const message = `Cluster is offline. Last checked: ${formatCheckedAt(checkedAt)}.`;

  return (
    <Tooltip content={message} position="top">
      {/* Focusable so keyboard users can open the tooltip too. */}
      <span
        role="img"
        tabIndex={0}
        aria-label={message}
        style={{ marginLeft: '0.5rem', color: 'var(--pf-v5-global--danger-color--100)' }}
      >
        <DisconnectedIcon />
      </span>
    </Tooltip>
  );
}
