import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../handlers';

const server = setupServer(...handlers);
const API = 'http://localhost:3000/api/v1';

describe('backup & restore mock handlers', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('POST /backup returns a gzip attachment', async () => {
    const res = await fetch(`${API}/backup`, { method: 'POST' });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/gzip');
    expect(res.headers.get('Content-Disposition')).toContain('krkn-backup-mock.tar.gz');

    const blob = await res.blob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('GET /backup/:jobId returns job status', async () => {
    const res = await fetch(`${API}/backup/job-42`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      jobId: 'job-42',
      status: 'completed',
      message: 'Backup completed successfully',
    });
    expect(body.backupPath).toContain('job-42');
  });

  it('POST /restore returns an in-progress job', async () => {
    const res = await fetch(`${API}/restore`, { method: 'POST' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('in_progress');
    expect(body.jobId).toMatch(/^restore-/);
    expect(body.message).toBe('Restore started successfully');
  });

  it('POST /restore/url returns an in-progress job', async () => {
    const res = await fetch(`${API}/restore/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 's3://bucket/backup.tar.gz' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('in_progress');
    expect(body.jobId).toMatch(/^restore-url-/);
    expect(body.message).toBe('Remote restore started successfully');
  });
});
