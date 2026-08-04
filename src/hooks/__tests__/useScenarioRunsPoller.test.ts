import { describe, it, expect } from 'vitest';
import type { ScenarioRunStatusResponse } from '../../types/api';

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
