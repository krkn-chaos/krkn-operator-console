import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, DropdownItem, Menu, MenuContent, MenuItem, MenuList, Modal, ModalVariant, Spinner } from '@patternfly/react-core';
import { HistoryIcon, TopologyIcon } from '@patternfly/react-icons';
import { useNotifications } from '../hooks/useNotifications';
import { operatorApi } from '../services/operatorApi';
import type { ClusterJob, RollbackAvailability } from '../types/api';

export interface RollbackAttempt {
  job: ClusterJob;
  jobId: string;
}

interface RollbackMenuActionProps {
  runName: string;
  rollbackEnabled: boolean;
  jobs: ClusterJob[];
  isJobsLoading: boolean;
  isMenuOpen: boolean;
  onConfirm: (attempt: RollbackAttempt) => void;
}

function canExecuteRollback(result?: RollbackAvailability): boolean {
  return result?.canExecute === true && (result.state === 'available' || result.state === 'failed');
}

function unavailableReason(result?: RollbackAvailability): string {
  if (!result || result.state === 'checking') return 'Checking rollback files…';
  if (result.message) return result.message;
  if (result.state === 'absent') return result.rollbackRunName ? 'Rollback already completed' : 'No rollback files found';
  if (result.state === 'running') return 'Rollback is already running';
  if (result.state === 'succeeded') return 'Rollback already completed';
  return 'Rollback is unavailable for this attempt';
}

/** Offers per-attempt rollback from the run overflow menu after checking retained files. */
export function RollbackMenuAction({ runName, rollbackEnabled, jobs, isJobsLoading, isMenuOpen, onConfirm }: RollbackMenuActionProps) {
  const attempts = useMemo(() => {
    const found = new Map<string, RollbackAttempt>();
    for (const job of jobs) {
      if (job.phase === 'Pending' || job.phase === 'Running' || job.phase === 'Retrying') continue;
      for (const jobId of [job.jobId, ...(job.attemptHistory ?? []).map((attempt) => attempt.jobId)]) {
        if (jobId && !found.has(jobId)) found.set(jobId, { job, jobId });
      }
    }
    return [...found.values()];
  }, [jobs]);
  const [availability, setAvailability] = useState<Record<string, RollbackAvailability>>({});

  useEffect(() => {
    if (!isMenuOpen) {
      setAvailability({});
      return;
    }
    if (!rollbackEnabled || attempts.length === 0) return;
    let active = true;
    const inspect = async () => {
      const results = await Promise.all(attempts.map(async ({ jobId }) => {
        try {
          return await operatorApi.getRollbackAvailability(runName, jobId);
        } catch (cause) {
          return { jobId, state: 'error' as const, canExecute: false, message: cause instanceof Error ? cause.message : 'Rollback inspection failed' };
        }
      }));
      if (active) setAvailability(Object.fromEntries(results.map((result) => [result.jobId, result])));
    };
    void inspect();
    const timer = window.setInterval(() => { void inspect(); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [attempts, isMenuOpen, rollbackEnabled, runName]);

  const executable = attempts.filter(({ jobId }) => canExecuteRollback(availability[jobId]));
  let reason: string | undefined;
  if (!rollbackEnabled) reason = 'Rollback was not enabled for this run';
  else if (executable.length === 0) {
    if (isJobsLoading || jobs.length === 0) reason = 'Loading cluster jobs…';
    else if (attempts.length === 0) reason = 'No completed cluster jobs to roll back';
    else if (attempts.some(({ jobId }) => !availability[jobId] || availability[jobId].state === 'checking')) reason = 'Checking rollback files…';
    else reason = unavailableReason(availability[attempts[0].jobId]);
  }

  return (
      <DropdownItem
        key="rollback"
        icon={reason === 'Checking rollback files…' ? <Spinner size="sm" /> : <HistoryIcon />}
        isAriaDisabled={Boolean(reason)}
        tooltipProps={reason ? { content: reason } : undefined}
        onClick={() => {
          if (executable.length !== 1) return;
          onConfirm(executable[0]);
        }}
        flyoutMenu={reason || executable.length === 1 ? undefined : (
          <Menu id={`rollback-attempts-${runName}`}>
            <MenuContent>
              <MenuList aria-label={`Rollback attempts for ${runName}`}>
                {attempts.map((attempt) => {
                  const result = availability[attempt.jobId];
                  const disabled = !canExecuteRollback(result);
                  return (
                    <MenuItem
                      key={attempt.jobId}
                      icon={<TopologyIcon aria-hidden="true" />}
                      isAriaDisabled={disabled}
                      tooltipProps={disabled ? { content: unavailableReason(result) } : undefined}
                      onClick={() => {
                        if (!disabled) onConfirm(attempt);
                      }}
                    >
                      {attempt.job.clusterName}
                    </MenuItem>
                  );
                })}
              </MenuList>
            </MenuContent>
          </Menu>
        )}
      >
        Rollback
      </DropdownItem>
  );
}

/** Keeps confirmation mounted independently of the overflow dropdown. */
export function RollbackConfirmation({ runName, attempt, onClose }: { runName: string; attempt: RollbackAttempt | null; onClose: () => void }) {
  const { showSuccess, showError } = useNotifications();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const close = () => {
    if (submitting) return;
    setSubmitError(null);
    onClose();
  };

  const startRollback = async () => {
    if (!attempt) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await operatorApi.startRollback(runName, attempt.jobId);
      showSuccess('Rollback started', `${attempt.job.providerName}/${attempt.job.clusterName}`);
      onClose();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Rollback could not be started';
      setSubmitError(message);
      showError('Rollback failed to start', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
      <Modal
        variant={ModalVariant.small}
        title="Confirm rollback"
        isOpen={attempt !== null}
        onClose={close}
        actions={[
          <Button key="rollback" variant="danger" isLoading={submitting} isDisabled={submitting} onClick={() => { void startRollback(); }}>Execute rollback</Button>,
          <Button key="cancel" variant="link" isDisabled={submitting} onClick={close}>Cancel</Button>,
        ]}
      >
        {attempt && <p>Run rollback for {attempt.job.providerName}/{attempt.job.clusterName}, attempt {attempt.jobId.slice(0, 8)}?</p>}
        {submitError && <Alert variant="danger" isInline title={submitError} />}
      </Modal>
  );
}
