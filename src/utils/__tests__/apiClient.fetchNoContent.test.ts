import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseApiClient, isApiError } from '../apiClient';

// Mock authService so no token is injected and no localStorage access happens
vi.mock('../../services/authService', () => ({
  authService: {
    getToken: () => null,
  },
}));

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'Status Text',
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function emptyResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'Status Text',
    // Simulates a 204: any attempt to read the body fails
    json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
  } as unknown as Response;
}

describe('BaseApiClient.fetchNoContent', () => {
  const client = new BaseApiClient('/api/v1');

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should resolve void on 204 without parsing the body', async () => {
    vi.mocked(fetch).mockResolvedValue(emptyResponse(204));

    await expect(client['fetchNoContent']('/robots/x', { method: 'DELETE' })).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/robots/x',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('should resolve void on other 2xx statuses', async () => {
    vi.mocked(fetch).mockResolvedValue(emptyResponse(200));

    await expect(client['fetchNoContent']('/robots/x/token', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('should throw ApiError with server message from JSON error body', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(404, { message: 'Robot not found' }));

    const promise = client['fetchNoContent']('/robots/nope', { method: 'DELETE' });

    await expect(promise).rejects.toMatchObject({
      status: 404,
      statusText: 'Status Text',
      message: 'Robot not found',
    });
  });

  it('should produce an ApiError recognizable by isApiError', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(403, { message: 'Admin access required' }));

    try {
      await client['fetchNoContent']('/robots');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      if (isApiError(err)) {
        expect(err.status).toBe(403);
        expect(err.message).toBe('Admin access required');
      }
    }
  });

  it('should fall back to default message when error body is not JSON', async () => {
    const response = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    } as unknown as Response;
    vi.mocked(fetch).mockResolvedValue(response);

    await expect(client['fetchNoContent']('/robots')).rejects.toMatchObject({
      status: 500,
      message: 'HTTP 500: Internal Server Error',
    });
  });

  it('should fall back to default message when error body has no message field', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(409, { error: 'conflict' }));

    await expect(client['fetchNoContent']('/robots')).rejects.toMatchObject({
      status: 409,
      message: 'HTTP 409: Status Text',
    });
  });
});
