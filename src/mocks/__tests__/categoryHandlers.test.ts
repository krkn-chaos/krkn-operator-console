import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../handlers';

const server = setupServer(...handlers);

describe('category association mock handlers', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('handles category association and disassociation requests', async () => {
    const associationUrl = 'http://localhost:3000/api/v2/categories/cluster-reliability/entities/graph-runs/chaos-workflow-daily';
    const associated = await fetch(associationUrl, { method: 'PUT' });
    expect(associated.status).toBe(200);
    expect(await associated.json()).toEqual({
      category: 'cluster-reliability',
      entityType: 'graph-runs',
      entityName: 'chaos-workflow-daily',
      associated: true,
    });

    const removed = await fetch(associationUrl, { method: 'DELETE' });
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({
      category: 'cluster-reliability',
      entityType: 'graph-runs',
      entityName: 'chaos-workflow-daily',
      associated: false,
    });
  });
});
