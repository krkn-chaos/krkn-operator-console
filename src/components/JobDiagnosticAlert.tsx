import { Alert } from '@patternfly/react-core';
import type { ClusterJob } from '../types/api';

interface JobDiagnosticAlertProps {
  job: Pick<ClusterJob, 'phase' | 'message' | 'podName'>;
}

/** Renders job diagnostics consistently across the list and detail views. */
export function JobDiagnosticAlert({ job }: JobDiagnosticAlertProps) {
  if (!job.message) return null;

  const hasPod = Boolean(job.podName);
  const isPodStartError = job.phase === 'Pending';
  const guidance = isPodStartError
    ? ' Investigate the pod events for more detail.'
    : hasPod
      ? ' Investigate the pod events and logs for more detail.'
      : '';

  return (
    <Alert variant="danger" isInline title={isPodStartError ? 'Pod did not start running' : 'Job failure reason'}>
      {job.message}{guidance}
    </Alert>
  );
}
