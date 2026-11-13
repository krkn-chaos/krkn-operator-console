import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { websocketHandlers } from '../websocketHandlers';
import { resetPreviewAiState } from '../krknAiState';

const server = setupServer(...websocketHandlers);

describe('Krkn-AI preview log snapshots', () => {
  beforeAll(() => server.listen());
  beforeEach(() => resetPreviewAiState());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('delivers the requested tail before sending the normal close event', async () => {
    const socket = new WebSocket('ws://localhost/api/v2/ws/krkn-ai/runs/preview-ai-completed/logs?follow=false&tailLines=3');
    const events: string[] = [];
    socket.addEventListener('message', () => events.push('message'));
    let resolveClosed!: (code: number) => void;
    const closed = new Promise<number>(resolve => { resolveClosed = resolve; });
    socket.addEventListener('close', event => { events.push('close'); resolveClosed(event.code); }, { once: true });
    try {
      expect(await closed).toBe(1000);
      expect(events).toEqual(['message', 'message', 'message', 'close']);
    } finally {
      socket.close();
    }
  });

  it('serves retained logs for a cancelled child even when its detail artifact is missing', async () => {
    const socket = new WebSocket('ws://localhost/api/v2/ws/scenarios/run/preview-ai-child-preview-ai-cancelled-1-2/jobs/preview-ai-job-preview-ai-cancelled-1-2/logs?follow=false&tailLines=3');
    const lines: string[] = [];
    socket.addEventListener('message', event => lines.push(String(event.data)));
    let resolveClosed!: (code: number) => void;
    const closed = new Promise<number>(resolve => { resolveClosed = resolve; });
    socket.addEventListener('close', event => resolveClosed(event.code), { once: true });
    try {
      expect(await closed).toBe(1000);
      expect(lines.join('\n')).toContain('Scenario stopped by user request');
    } finally {
      socket.close();
    }
  });
});
