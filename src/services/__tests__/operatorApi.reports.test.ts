import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { operatorApi } from '../operatorApi';

const mockFetch = vi.fn();

describe('OperatorApi - report endpoints', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gets report status with an encoded run name', async () => {
    const status = { generated: true, htmlAvailable: true, pdfAvailable: true };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => status,
    });

    await expect(operatorApi.getReportStatus('run/with spaces')).resolves.toEqual(status);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/scenarios/run/run%2Fwith%20spaces/reports/status',
      expect.objectContaining({ headers: expect.anything() }),
    );
  });

  it.each([
    ['html', 'downloadReportHTML', '/api/v1/scenarios/run/run-1/reports/summary.html'],
    ['pdf', 'downloadReportPDF', '/api/v1/scenarios/run/run-1/reports/summary.pdf'],
  ] as const)('downloads the %s report', async (_, method, expectedPath) => {
    const blob = new Blob(['report']);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => blob,
    });

    await expect(operatorApi[method]('run-1')).resolves.toBe(blob);
    expect(mockFetch).toHaveBeenCalledWith(expectedPath, expect.objectContaining({ headers: expect.anything() }));
  });

  it('surfaces report download HTTP errors', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, statusText: 'Not Found' });

    await expect(operatorApi.downloadReportPDF('run-1')).rejects.toThrow('Failed to download PDF report: Not Found');
  });
});
