import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from './authService';
import { componentsApi } from './componentsApi';

vi.mock('./authService', () => ({
  authService: { getToken: vi.fn() },
}));

describe('componentsApi.listComponents', () => {
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

  it('requests the authenticated endpoint with the abort signal and unwraps components', async () => {
    const components = {
      'krkn-operator': {
        version: 'v1.1.0-rc4',
        components: [{ component: 'rest-api', description: 'REST API' }],
      },
    };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ components }),
    } as Response);
    const controller = new AbortController();

    await expect(componentsApi.listComponents(controller.signal)).resolves.toEqual(components);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/components');
    expect(options.signal).toBe(controller.signal);
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer test-token');
  });
});
