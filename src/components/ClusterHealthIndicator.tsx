import { Label, Tooltip } from '@patternfly/react-core';
import type { ClusterHealthStatus } from '../types/api';

const healthStatusDetails: Record<ClusterHealthStatus, { color: 'green' | 'red' | 'grey'; description: string }> = {
  healthy: {
    color: 'green',
    description: 'Cluster is active and reachable.',
  },
  unhealthy: {
    color: 'red',
    description: 'Chaos scenarios may fail because this cluster is in an inconsistent state. Ask your administrator to investigate its status.',
  },
  unknown: {
    color: 'grey',
    description: 'Health could not be determined because the availability status is missing or inconclusive.',
  },
};

interface ClusterHealthIndicatorProps {
  status?: ClusterHealthStatus;
}

export function ClusterHealthIndicator({ status }: ClusterHealthIndicatorProps) {
  if (!status) return null;

  const details = healthStatusDetails[status];

  return (
    <Tooltip content={details.description} position="top">
      <span style={{ display: 'inline-flex', marginLeft: '0.5rem' }}>
        <Label
          color={details.color}
          variant="filled"
          isCompact
          aria-label={`Cluster status: ${status}`}
        >
          {status}
        </Label>
      </span>
    </Tooltip>
  );
}
