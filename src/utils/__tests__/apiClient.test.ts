import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isApiError, BaseApiClient } from '../apiClient';
import type { ApiError } from '../apiClient';

vi.mock('../../services/authService', () => ({
  authService: {
    getToken: vi.fn(() => 'fake-jwt-token'),
  },
}));

function fakeResponse(
  status: number,
  body: unknown,
  { ok, statusText }: { ok?: boolean; statusText?: string } = {},
): Response {
  const resolved = ok ?? (status >= 200 && status < 300);
  return {
    ok: resolved,
    status,
    statusText: statusText ?? (resolved ? 'OK' : 'Error'),
    json: () => Promise.resolve(body),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Response;
}

describe('isApiError', () => {
  it('returns true for Error with numeric status', () => {
    const err = Object.assign(new Error('conflict'), { status: 409, statusText: 'Conflict' });
    expect(isApiError(err)).toBe(true);
  });

  it('returns false for plain Error without status', () => {
    expect(isApiError(new Error('plain'))).toBe(false);
  });

  it('returns false for non-Error objects', () => {
    expect(isApiError({ status: 409, statusText: 'Conflict' })).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError('string')).toBe(false);
    expect(isApiError(undefined)).toBe(false);
  });

  it('returns false for Error with non-numeric status', () => {
    const err = Object.assign(new Error('msg'), { status: 'not-a-number' });
    expect(isApiError(err)).toBe(false);
  });
});

describe('BaseApiClient.fetchJson', () => {
  class TestApiClient extends BaseApiClient {
    constructor(baseUrl: string) {
      super(baseUrl);
    }
    public callFetchJson<T>(url: string, options?: RequestInit): Promise<T> {
      return this.fetchJson<T>(url, options);
    }
  }

  let client: TestApiClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new TestApiClient('https://api.example.com');
  });

  it('returns parsed JSON on a successful response', async () => {
    const payload = { id: 1, name: 'test' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeResponse(200, payload));

    const result = await client.callFetchJson<{ id: number; name: string }>('/items/1');
    expect(result).toEqual(payload);
  });

  it('throws an error detected by isApiError on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fakeResponse(404, { message: 'Item not found' }, { statusText: 'Not Found' }),
    );

    try {
      await client.callFetchJson('/items/999');
      expect.fail('Expected error');
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      expect((err as ApiError).status).toBe(404);
      expect((err as ApiError).message).toBe('Item not found');
    }
  });

  it('preserves status and statusText', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fakeResponse(403, { message: 'forbidden' }, { statusText: 'Forbidden' }),
    );

    try {
      await client.callFetchJson('/secret');
      expect.fail('Expected error');
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(403);
      expect(apiErr.statusText).toBe('Forbidden');
    }
  });

  it('parses error.message from the response body on 409', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fakeResponse(409, { message: 'A file with this name already exists' }, { statusText: 'Conflict' }),
    );

    try {
      await client.callFetchJson('/files');
      expect.fail('Expected error');
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      expect((err as ApiError).message).toBe('A file with this name already exists');
      expect((err as ApiError).status).toBe(409);
    }
  });

  it('falls back to default message when response has no message field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fakeResponse(500, { error: 'some_code' }, { statusText: 'Internal Server Error' }),
    );

    try {
      await client.callFetchJson('/crash');
      expect.fail('Expected error');
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      expect((err as ApiError).message).toBe('HTTP 500: Internal Server Error');
    }
  });

  it('falls back to default message when response body is not valid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
      headers: new Headers(),
    } as unknown as Response);

    try {
      await client.callFetchJson('/proxy');
      expect.fail('Expected error');
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      const apiErr = err as ApiError;
      expect(apiErr.message).toBe('HTTP 502: Bad Gateway');
      expect(apiErr.status).toBe(502);
    }
  });

  it('prepends baseUrl to the request URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fakeResponse(200, { ok: true }),
    );

    await client.callFetchJson('/v1/resources');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/v1/resources',
      expect.any(Object),
    );
  });

  it('handles 409 Conflict correctly for duplicate workflow detection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fakeResponse(409, { message: 'A workflow with this name already exists' }, { statusText: 'Conflict' }),
    );

    try {
      await client.callFetchJson('/workflows', { method: 'POST' });
      expect.fail('Expected error');
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.message).toBe('A workflow with this name already exists');
    }
  });
});
