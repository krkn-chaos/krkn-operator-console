import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError, BaseApiClient } from '../apiClient';

// Mock authService so authenticatedFetch can resolve getToken()
vi.mock('../../services/authService', () => ({
  authService: {
    getToken: vi.fn(() => 'fake-jwt-token'),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal Response-like object that satisfies what authenticatedFetch
 * and fetchJson inspect (status, statusText, ok, json, headers).
 */
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ApiError', () => {
  it('preserves message, status, and statusText', () => {
    const err = new ApiError('not found', 404, 'Not Found');

    expect(err.message).toBe('not found');
    expect(err.status).toBe(404);
    expect(err.statusText).toBe('Not Found');
  });

  it('sets name to "ApiError"', () => {
    const err = new ApiError('conflict', 409, 'Conflict');

    expect(err.name).toBe('ApiError');
  });

  it('is an instance of Error', () => {
    const err = new ApiError('server error', 500, 'Internal Server Error');

    expect(err).toBeInstanceOf(Error);
  });

  it('is an instance of ApiError', () => {
    const err = new ApiError('bad request', 400, 'Bad Request');

    expect(err).toBeInstanceOf(ApiError);
  });

  it('has a stack trace', () => {
    const err = new ApiError('oops', 500, 'Internal Server Error');

    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('ApiError');
  });

  it('can be caught with instanceof checks', () => {
    const err: Error = new ApiError('dup', 409, 'Conflict');

    let caughtStatus: number | undefined;
    try {
      throw err;
    } catch (e) {
      if (e instanceof ApiError) {
        caughtStatus = e.status;
      }
    }

    expect(caughtStatus).toBe(409);
  });
});

describe('BaseApiClient.fetchJson', () => {
  /** Subclass to expose the protected fetchJson method for testing */
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
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fakeResponse(200, payload),
    );

    const result = await client.callFetchJson<{ id: number; name: string }>('/items/1');

    expect(result).toEqual(payload);
  });

  it('throws ApiError on a non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fakeResponse(404, { message: 'Item not found' }, { statusText: 'Not Found' }),
    );

    await expect(client.callFetchJson('/items/999')).rejects.toThrow(ApiError);
  });

  it('throws ApiError with correct status and statusText', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fakeResponse(403, { message: 'forbidden' }, { statusText: 'Forbidden' }),
    );

    try {
      await client.callFetchJson('/secret');
      expect.fail('Expected ApiError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(403);
      expect(apiErr.statusText).toBe('Forbidden');
    }
  });

  it('parses error.message from the response body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fakeResponse(
        409,
        { message: 'A file with this name already exists' },
        { statusText: 'Conflict' },
      ),
    );

    try {
      await client.callFetchJson('/files');
      expect.fail('Expected ApiError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).message).toBe('A file with this name already exists');
      expect((err as ApiError).status).toBe(409);
    }
  });

  it('falls back to a default message when response body has no message field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fakeResponse(500, { error: 'some_code' }, { statusText: 'Internal Server Error' }),
    );

    try {
      await client.callFetchJson('/crash');
      expect.fail('Expected ApiError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.message).toBe('HTTP 500: Internal Server Error');
      expect(apiErr.status).toBe(500);
    }
  });

  it('falls back to a default message when response body is not valid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
      headers: new Headers(),
    } as unknown as Response);

    try {
      await client.callFetchJson('/proxy');
      expect.fail('Expected ApiError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.message).toBe('HTTP 502: Bad Gateway');
      expect(apiErr.status).toBe(502);
      expect(apiErr.statusText).toBe('Bad Gateway');
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

  it('handles 409 Conflict correctly for duplicate detection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      fakeResponse(
        409,
        { message: 'A workflow with this name already exists' },
        { statusText: 'Conflict' },
      ),
    );

    try {
      await client.callFetchJson('/workflows', { method: 'POST' });
      expect.fail('Expected ApiError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.statusText).toBe('Conflict');
      expect(apiErr.message).toBe('A workflow with this name already exists');
      // Verify the error can be distinguished from generic errors
      expect(apiErr).toBeInstanceOf(Error);
      expect(apiErr.name).toBe('ApiError');
    }
  });
});
