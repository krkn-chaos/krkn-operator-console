import { describe, expect, it } from 'vitest';
import { createRunsMessage } from '../websocketHandlers';

describe('runs WebSocket mock messages', () => {
  it('creates the jobs snapshot for the jobs subscription', () => {
    const message = createRunsMessage('jobs');

    expect(message).toMatchObject({
      resource: 'jobs',
      event: 'snapshot',
      data: { jobs: expect.any(Array) },
    });
  });

  it.each([
    ['run', 'network-chaos-run-03'],
    ['run-detail', 'requested-run'],
  ] as const)('creates a %s update for the requested run', (resource, runId) => {
    const message = createRunsMessage(resource, undefined, runId);

    expect(message).toMatchObject({
      resource,
      id: runId,
      event: 'updated',
      data: { scenarioRunName: resource === 'run-detail' ? runId : 'network-chaos-run-03' },
    });
  });

  it('ignores unsupported subscriptions', () => {
    expect(createRunsMessage('unsupported')).toBeNull();
  });
});
