import { ROLLBACK_STATES, type RollbackAvailability } from '../types/api';

const rollbackStates: ReadonlySet<string> = new Set(ROLLBACK_STATES);

/** Validate the operator's rollback response before it controls UI actions. */
export function parseRollbackAvailability(value: unknown, expectedJobId: string): RollbackAvailability {
  if (value === null || typeof value !== 'object') {
    throw new Error('Invalid rollback availability response');
  }
  const response = value as Record<string, unknown>;
  if (response.jobId !== expectedJobId || !expectedJobId ||
      typeof response.state !== 'string' || !rollbackStates.has(response.state) ||
      typeof response.canExecute !== 'boolean' ||
      (response.canExecute && response.state !== 'available' && response.state !== 'failed') ||
      (response.rollbackRunName !== undefined && typeof response.rollbackRunName !== 'string') ||
      (response.message !== undefined && typeof response.message !== 'string')) {
    throw new Error('Invalid rollback availability response');
  }
  return response as unknown as RollbackAvailability;
}
