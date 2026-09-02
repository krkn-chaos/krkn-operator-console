import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { elasticsearchApi } from './elasticsearchApi';
import { authService } from './authService';
import { isApiError } from '../utils/apiClient';
import type { QueryTelemetryResponse } from '../types/api';

// Exercise the real queryTelemetry method (not a mocked stand-in) so that the
// endpoint, HTTP method, serialized request body, response parsing, and error
// handling are all covered. Only the network boundary (fetch) and the token
// source (authService) are mocked.
vi.mock('./authService', () => ({
  authService: {
    getToken: vi.fn(),
  },
}));

const mockResponse: QueryTelemetryResponse = {
  documents: [
    {
      run_uuid: 'abc1234-rest-of-uuid',
      scenario_type: 'pod_disruption_scenarios',
      start_timestamp: 1735689600,
      end_timestamp: 1735689900,
      namespace: 'openshift-kube-apiserver',
      status: true,
    },
  ],
  total: 1,
};

/** Builds a minimal Response-like object for the fetch mock. */
function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number; statusText?: string }): Response {
  const { ok = true, status = 200, statusText = 'OK' } = init ?? {};
  return {
    ok,
    status,
    statusText,
    json: async () => body,
  } as Response;
}

describe('elasticsearchApi.queryTelemetry', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    vi.mocked(authService.getToken).mockReturnValue('test-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('POSTs to the query endpoint with the serialized parameters and auth header', async () => {
    fetchMock.mockResolvedValue(jsonResponse(mockResponse));

    const result = await elasticsearchApi.queryTelemetry('prod-es', 50, '2025-01-01', '2025-01-02');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe('/api/v1/elasticsearch-query');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toEqual({
      configName: 'prod-es',
      size: 50,
      startDate: '2025-01-01',
      endDate: '2025-01-02',
    });

    const headers = new Headers(options.headers);
    expect(headers.get('Authorization')).toBe('Bearer test-token');
    expect(headers.get('Content-Type')).toBe('application/json');

    // Response body is parsed and returned as-is.
    expect(result).toEqual(mockResponse);
  });

  it('serializes omitted optional parameters as undefined (dropped by JSON.stringify)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(mockResponse));

    await elasticsearchApi.queryTelemetry('prod-es');

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    // size/startDate/endDate are undefined and therefore absent from the JSON body.
    expect(JSON.parse(options.body as string)).toEqual({ configName: 'prod-es' });
  });

  it('throws an ApiError carrying the server message on a non-ok response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: 'config not found' }, { ok: false, status: 404, statusText: 'Not Found' }),
    );

    await expect(elasticsearchApi.queryTelemetry('missing')).rejects.toMatchObject({
      message: 'config not found',
      status: 404,
      statusText: 'Not Found',
    });

    try {
      await elasticsearchApi.queryTelemetry('missing');
      expect.unreachable('queryTelemetry should have thrown');
    } catch (err) {
      expect(isApiError(err)).toBe(true);
    }
  });

  it('propagates network failures from fetch', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(elasticsearchApi.queryTelemetry('prod-es')).rejects.toThrow('network down');
  });
});
