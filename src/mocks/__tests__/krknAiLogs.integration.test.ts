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
    const closed = new Promise<number>(resolve => socket.addEventListener('close', event => { events.push('close'); resolve(event.code); }, { once: true }));
    try {
      expect(await closed).toBe(1000);
      expect(events).toEqual(['message', 'message', 'message', 'close']);
    } finally {
      socket.close();
    }
  });
});
