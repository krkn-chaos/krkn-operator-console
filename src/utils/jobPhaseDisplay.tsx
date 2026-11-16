import {
  BanIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  HourglassHalfIcon,
  SyncAltIcon,
} from '@patternfly/react-icons';
import type { ClusterJobPhase } from '../types/api';

export function getJobPhaseDisplay(phase: ClusterJobPhase) {
  switch (phase) {
    case 'Creating':
    case 'Pending':
      return { icon: <HourglassHalfIcon />, color: 'orange' as const, label: phase };
    case 'Running':
    case 'Retrying':
      return { icon: <SyncAltIcon className="pf-m-spin" />, color: 'blue' as const, label: phase };
    case 'Cancelling':
      return { icon: <SyncAltIcon className="pf-m-spin" />, color: 'orange' as const, label: 'Cancelling' };
    case 'Succeeded':
      return { icon: <CheckCircleIcon />, color: 'green' as const, label: 'Succeeded' };
    case 'Failed':
      return { icon: <ExclamationCircleIcon />, color: 'red' as const, label: 'Failed' };
    case 'Cancelled':
      return { icon: <BanIcon />, color: 'grey' as const, label: 'Cancelled' };
    case 'MaxRetriesExceeded':
      return { icon: <ExclamationCircleIcon />, color: 'red' as const, label: 'Max retries exceeded' };
    default:
      return { icon: <ExclamationCircleIcon />, color: 'grey' as const, label: phase };
  }
}
