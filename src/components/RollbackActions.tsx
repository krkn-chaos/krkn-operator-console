import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Modal, ModalVariant, Spinner } from '@patternfly/react-core';
import { HistoryIcon } from '@patternfly/react-icons';
import { operatorApi } from '../services/operatorApi';
import type { ClusterJob, RollbackAvailability } from '../types/api';

interface RollbackActionsProps {
  scenarioRunName: string;
  job: ClusterJob;
}

/** Inspects each attempt's retained files and offers rollback for available attempts. */
export function RollbackActions({ scenarioRunName, job }: RollbackActionsProps) {
  const attemptIds = useMemo(
    () => [...new Set([...(job.attemptHistory ?? []).map((attempt) => attempt.jobId), job.jobId])],
    [job.attemptHistory, job.jobId]
  );
  const [availability, setAvailability] = useState<Record<string, RollbackAvailability>>({});
  const [confirmJobId, setConfirmJobId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const inspect = async () => {
      const results = await Promise.all(attemptIds.map(async (jobId) => {
        try {
          return await operatorApi.getRollbackAvailability(scenarioRunName, jobId);
        } catch (cause) {
          return { jobId, state: 'error' as const, message: cause instanceof Error ? cause.message : 'Inspection failed' };
        }
      }));
      if (active) setAvailability(Object.fromEntries(results.map((result) => [result.jobId, result])));
    };
    void inspect();
    const timer = window.setInterval(() => { void inspect(); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [attemptIds, scenarioRunName]);

  const start = async () => {
    if (!confirmJobId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await operatorApi.startRollback(scenarioRunName, confirmJobId);
      setAvailability((current) => ({ ...current, [confirmJobId]: result }));
      setConfirmJobId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to start rollback');
    } finally {
      setSubmitting(false);
    }
  };

  const available = attemptIds.filter((id) => availability[id]?.canExecute && (availability[id]?.state === 'available' || availability[id]?.state === 'failed'));
  const checking = attemptIds.some((id) => !availability[id] || availability[id]?.state === 'checking');
  const running = attemptIds.some((id) => availability[id]?.state === 'running');
  const completed = attemptIds.some((id) => availability[id]?.state === 'succeeded');
  const failures = attemptIds.filter((id) => availability[id]?.state === 'error');
  const unavailable = attemptIds.filter((id) => availability[id]?.state === 'unavailable' ||
    (!availability[id]?.canExecute && ['available', 'failed'].includes(availability[id]?.state ?? '')));
  const noFiles = attemptIds.every((id) => availability[id]?.state === 'absent' && !availability[id]?.rollbackRunName);

  return (
    <div aria-label={`Rollback for ${job.providerName}/${job.clusterName}`}>
      {checking && <span><Spinner size="sm" /> Checking rollback files…</span>}
      {available.map((id) => (
        <Button key={id} variant="secondary" icon={<HistoryIcon />} onClick={() => setConfirmJobId(id)}>
          {availability[id]?.state === 'failed' ? 'Retry rollback' : 'Rollback attempt'} {id.slice(0, 8)}
        </Button>
      ))}
      {running && <Alert variant="info" isInline title="Rollback is running" />}
      {completed && <Alert variant="success" isInline title="Rollback completed" />}
      {noFiles && <span>No rollback files found.</span>}
      {unavailable.map((id) => <Alert key={id} variant="warning" isInline title={availability[id]?.message || 'Rollback is unavailable'} />)}
      {failures.map((id) => <Alert key={id} variant="danger" isInline title={availability[id]?.message || 'Rollback failed'} />)}
      {error && <Alert variant="danger" isInline title={error} />}
      <Modal
        variant={ModalVariant.small}
        title="Confirm rollback"
        isOpen={confirmJobId !== null}
        onClose={() => { if (!submitting) setConfirmJobId(null); }}
        actions={[
          <Button key="rollback" variant="danger" isLoading={submitting} isDisabled={submitting} onClick={() => { void start(); }}>Execute rollback</Button>,
          <Button key="cancel" variant="link" isDisabled={submitting} onClick={() => setConfirmJobId(null)}>Cancel</Button>,
        ]}
      >
        Run rollback for {job.providerName}/{job.clusterName}, attempt {confirmJobId?.slice(0, 8)}?
      </Modal>
    </div>
  );
}
