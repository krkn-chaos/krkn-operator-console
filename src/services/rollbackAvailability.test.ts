import { describe, expect, it } from 'vitest';
import { parseRollbackAvailability } from './rollbackAvailability';

const attempt = '4f322276-81e4-4d70-9f94-9951ded10e75';

describe('parseRollbackAvailability', () => {
  it('accepts executable and non-executable responses', () => {
    expect(parseRollbackAvailability({ jobId: attempt, state: 'available', canExecute: true }, attempt).state).toBe('available');
    expect(parseRollbackAvailability({ jobId: attempt, state: 'running', canExecute: false }, attempt).state).toBe('running');
  });

  it.each([
    { jobId: attempt, state: 'unknown', canExecute: false },
    { jobId: 'another-attempt', state: 'available', canExecute: true },
    { jobId: attempt, state: 'available' },
    { jobId: attempt, state: 'running', canExecute: true },
    { jobId: attempt, state: 'available', canExecute: true, message: 3 },
  ])('rejects a response outside the rollback contract', (response) => {
    expect(() => parseRollbackAvailability(response, attempt)).toThrow('Invalid rollback availability response');
  });
});
