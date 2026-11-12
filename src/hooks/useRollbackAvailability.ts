import { useEffect, useState } from 'react';
import { operatorApi } from '../services/operatorApi';
import type { RollbackAvailability } from '../types/api';

/** Polls retained-file availability for the selected run attempts. */
export function useRollbackAvailability(runName: string, attemptIds: string[], enabled: boolean) {
  const [availability, setAvailability] = useState<Record<string, RollbackAvailability>>({});
  const attemptKey = [...new Set(attemptIds.filter(Boolean))].join('\0');

  useEffect(() => {
    setAvailability({});
    if (!enabled || !runName || !attemptKey) return;

    let active = true;
    let timer: number | undefined;
    const ids = attemptKey.split('\0');
    const inspect = async () => {
      const results = await Promise.all(ids.map(async (jobId) => {
        try {
          return await operatorApi.getRollbackAvailability(runName, jobId);
        } catch (cause) {
          return {
            jobId,
            state: 'error' as const,
            canExecute: false,
            message: cause instanceof Error ? cause.message : 'Rollback inspection failed',
          };
        }
      }));
      if (!active) return;
      setAvailability(Object.fromEntries(results.map((result) => [result.jobId, result])));
      timer = window.setTimeout(() => { void inspect(); }, 5000);
    };
    void inspect();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [attemptKey, enabled, runName]);

  return { availability, setAvailability };
}
