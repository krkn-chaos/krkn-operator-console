import { describe, it, expect } from 'vitest';
import type { ScenarioRunStatusResponse, ScenarioRunState } from '../../types/api';
import { TERMINAL_PHASES, hasChanges } from '../useScenarioRunsPoller';

/**
 * Replicates the timestamp mapping logic from useScenarioRunsPoller.ts (line 77):
 *
 *   const runAny = run as ScenarioRunStatusResponse & { creationTimestamp?: string };
 *   createdAt: runAny.creationTimestamp || run.creationTimestamp ||
 *              (run.clusterJobs && run.clusterJobs[0]?.startTime) || ''
 *
 * Since ScenarioRunStatusResponse already declares creationTimestamp?: string,
 * the cast is a no-op and both accesses resolve to the same property.
 * The effective priority chain is:
 *   1. creationTimestamp
 *   2. clusterJobs[0].startTime
 *   3. '' (empty string)
 */
function mapCreatedAt(run: ScenarioRunStatusResponse & { creationTimestamp?: string }): string {
  return run.creationTimestamp || (run.clusterJobs && run.clusterJobs[0]?.startTime) || '';
}

/** Minimal valid ScenarioRunStatusResponse with no timestamps. */
function makeRun(overrides: Partial<ScenarioRunStatusResponse> = {}): ScenarioRunStatusResponse {
  return {
    scenarioRunName: 'test-run-abc12345',
    phase: 'Running',
    totalTargets: 1,
    successfulJobs: 0,
    failedJobs: 0,
    runningJobs: 1,
    clusterJobs: [],
    ...overrides,
  };
}

describe('useScenarioRunsPoller timestamp mapping', () => {
  it('uses creationTimestamp when present', () => {
    const run = makeRun({ creationTimestamp: '2025-06-15T10:00:00Z' });
    expect(mapCreatedAt(run)).toBe('2025-06-15T10:00:00Z');
  });

  it('falls back to first clusterJob startTime when creationTimestamp is missing', () => {
    const run = makeRun({
      clusterJobs: [
        {
          providerName: 'krkn-operator',
          clusterName: 'cluster-1',
          jobId: 'job-001',
          podName: 'pod-001',
          phase: 'Running',
          startTime: '2025-06-15T11:30:00Z',
        },
      ],
    });
    expect(mapCreatedAt(run)).toBe('2025-06-15T11:30:00Z');
  });

  it('returns empty string when no timestamp is available', () => {
    const run = makeRun({ clusterJobs: [] });
    expect(mapCreatedAt(run)).toBe('');
  });

  it('prefers creationTimestamp over clusterJob startTime', () => {
    const run = makeRun({
      creationTimestamp: '2025-06-15T10:00:00Z',
      clusterJobs: [
        {
          providerName: 'krkn-operator',
          clusterName: 'cluster-1',
          jobId: 'job-001',
          podName: 'pod-001',
          phase: 'Running',
          startTime: '2025-06-15T11:30:00Z',
        },
      ],
    });
    expect(mapCreatedAt(run)).toBe('2025-06-15T10:00:00Z');
  });
});

function makeRunState(overrides: Partial<ScenarioRunState> = {}): ScenarioRunState {
  return {
    scenarioRunName: 'test-run-abc12345',
    scenarioName: 'test-scenario',
    phase: 'Running',
    totalTargets: 1,
    successfulJobs: 0,
    failedJobs: 0,
    runningJobs: 1,
    clusterJobs: [],
    createdAt: '2025-06-15T10:00:00Z',
    ...overrides,
  };
}

describe('TERMINAL_PHASES', () => {
  it('includes Succeeded, Failed, and PartiallyFailed', () => {
    expect(TERMINAL_PHASES).toContain('Succeeded');
    expect(TERMINAL_PHASES).toContain('Failed');
    expect(TERMINAL_PHASES).toContain('PartiallyFailed');
  });

  it('does not include active phases', () => {
    expect(TERMINAL_PHASES).not.toContain('Running');
    expect(TERMINAL_PHASES).not.toContain('Pending');
    expect(TERMINAL_PHASES).not.toContain('');
  });

  it.each([
    ['Running', 'Succeeded', true],
    ['Running', 'Failed', true],
    ['Running', 'PartiallyFailed', true],
    ['Pending', 'Succeeded', true],
    ['Succeeded', 'Failed', false],
    ['Failed', 'Succeeded', false],
    ['Running', 'Running', false],
    ['Running', 'Pending', false],
  ])('transition from %s to %s is terminal transition: %s', (from, to, expected) => {
    const result = !TERMINAL_PHASES.includes(from) && TERMINAL_PHASES.includes(to);
    expect(result).toBe(expected);
  });
});

describe('hasChanges', () => {
  it('returns false for identical states', () => {
    const run = makeRunState();
    expect(hasChanges(run, { ...run })).toBe(false);
  });

  it('detects phase change', () => {
    const prev = makeRunState({ phase: 'Running' });
    const next = makeRunState({ phase: 'Succeeded' });
    expect(hasChanges(prev, next)).toBe(true);
  });

  it('detects totalTargets change', () => {
    const prev = makeRunState({ totalTargets: 1 });
    const next = makeRunState({ totalTargets: 3 });
    expect(hasChanges(prev, next)).toBe(true);
  });

  it('detects runningJobs change', () => {
    const prev = makeRunState({ runningJobs: 1 });
    const next = makeRunState({ runningJobs: 0 });
    expect(hasChanges(prev, next)).toBe(true);
  });

  it('detects successfulJobs change', () => {
    const prev = makeRunState({ successfulJobs: 0 });
    const next = makeRunState({ successfulJobs: 1 });
    expect(hasChanges(prev, next)).toBe(true);
  });

  it('detects failedJobs change', () => {
    const prev = makeRunState({ failedJobs: 0 });
    const next = makeRunState({ failedJobs: 1 });
    expect(hasChanges(prev, next)).toBe(true);
  });

  it('detects customRunName change', () => {
    const prev = makeRunState({ customRunName: undefined });
    const next = makeRunState({ customRunName: 'new-name' });
    expect(hasChanges(prev, next)).toBe(true);
  });

  it('detects clusterJobs length change', () => {
    const prev = makeRunState({ clusterJobs: [] });
    const next = makeRunState({
      clusterJobs: [{
        providerName: 'krkn-operator',
        clusterName: 'c1',
        jobId: 'j1',
        podName: 'p1',
        phase: 'Running',
        startTime: '',
      }],
    });
    expect(hasChanges(prev, next)).toBe(true);
  });

  it('detects clusterJob phase change', () => {
    const job = {
      providerName: 'krkn-operator',
      clusterName: 'c1',
      jobId: 'j1',
      podName: 'p1',
      startTime: '',
    };
    const prev = makeRunState({ clusterJobs: [{ ...job, phase: 'Running' }] });
    const next = makeRunState({ clusterJobs: [{ ...job, phase: 'Succeeded' }] });
    expect(hasChanges(prev, next)).toBe(true);
  });

  it('detects missing clusterJob in next state', () => {
    const prev = makeRunState({
      clusterJobs: [{
        providerName: 'krkn-operator',
        clusterName: 'c1',
        jobId: 'j1',
        podName: 'p1',
        phase: 'Running',
        startTime: '',
      }],
    });
    const next = makeRunState({
      clusterJobs: [{
        providerName: 'krkn-operator',
        clusterName: 'c2',
        jobId: 'j2',
        podName: 'p2',
        phase: 'Running',
        startTime: '',
      }],
    });
    expect(hasChanges(prev, next)).toBe(true);
  });
});
