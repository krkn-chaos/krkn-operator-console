import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { websocketHandlers } from '../websocketHandlers';

const server = setupServer(...websocketHandlers);

function connectToRuns() {
  return new WebSocket('ws://localhost/api/v2/ws/runs');
}

function waitForMessage(socket: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    socket.addEventListener('message', (event) => resolve(JSON.parse(event.data as string)), { once: true });
  });
}

describe('runs WebSocket mock handler', () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    vi.useRealTimers();
    server.resetHandlers();
  });
  afterAll(() => server.close());

  it.each([
    ['jobs', 'jobs', 'snapshot'],
    ['run', 'run', 'updated'],
    ['run-detail', 'run-detail', 'updated'],
  ])('sends initial and periodic messages for %s subscriptions', async (subscription, resource, event) => {
    expect(subscription).toBe(resource);
    vi.useFakeTimers();
    const socket = connectToRuns();
    await new Promise<void>((resolve) => socket.addEventListener('open', () => resolve(), { once: true }));

    socket.send(JSON.stringify({
      action: 'subscribe',
      resource,
      ids: resource === 'run-detail' ? ['requested-run'] : undefined,
    }));
    const initialMessage = waitForMessage(socket);
    await vi.advanceTimersByTimeAsync(500);
    await expect(initialMessage).resolves.toMatchObject({ resource, event });

    const periodicMessage = waitForMessage(socket);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(periodicMessage).resolves.toMatchObject({ resource, event });
    socket.close();
  });
});
