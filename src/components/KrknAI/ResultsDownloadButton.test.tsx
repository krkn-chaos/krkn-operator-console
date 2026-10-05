import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { krknAiApi } from '../../services/krknAiApi';
import { ResultsDownloadButton } from './ResultsDownloadButton';

vi.mock('../../services/krknAiApi', () => ({
  krknAiApi: {
    downloadResults: vi.fn(),
  },
}));

describe('ResultsDownloadButton', () => {
  const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  const createObjectURL = vi.fn(() => 'blob:results-archive');
  const revokeObjectURL = vi.fn();
  const clickAnchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
  });

  afterEach(() => {
    if (originalCreateObjectURL) Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (originalRevokeObjectURL) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('downloads the ZIP using the run filename and revokes the temporary object URL', async () => {
    const archive = new Blob(['archive'], { type: 'application/zip' });
    vi.mocked(krknAiApi.downloadResults).mockResolvedValueOnce(archive);

    render(<ResultsDownloadButton runName="daily-run" />);
    fireEvent.click(screen.getByRole('button', { name: 'Download complete results for run daily-run' }));

    await waitFor(() => expect(clickAnchor).toHaveBeenCalledTimes(1));
    const anchor = clickAnchor.mock.contexts[0] as HTMLAnchorElement;
    expect(krknAiApi.downloadResults).toHaveBeenCalledWith('daily-run');
    expect(createObjectURL).toHaveBeenCalledWith(archive);
    expect(anchor.download).toBe('daily-run-results.zip');
    expect(anchor.href).toBe('blob:results-archive');
    expect(anchor.isConnected).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:results-archive');
  });

  it('prevents duplicate downloads while a request is in flight', async () => {
    let resolveDownload!: (blob: Blob) => void;
    vi.mocked(krknAiApi.downloadResults).mockReturnValueOnce(
      new Promise<Blob>((resolve) => { resolveDownload = resolve; }),
    );

    render(<ResultsDownloadButton runName="in-progress-run" />);
    const button = screen.getByRole('button', { name: 'Download complete results for run in-progress-run' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(krknAiApi.downloadResults).toHaveBeenCalledTimes(1);

    resolveDownload(new Blob(['archive']));
    await waitFor(() => expect(button).toBeEnabled());
    expect(clickAnchor).toHaveBeenCalledTimes(1);
  });

  it('shows the download failure to the user', async () => {
    vi.mocked(krknAiApi.downloadResults).mockRejectedValueOnce(new Error('Archive service unavailable'));

    render(<ResultsDownloadButton runName="failed-run" />);
    fireEvent.click(screen.getByRole('button', { name: 'Download complete results for run failed-run' }));

    expect(await screen.findByText('Archive service unavailable')).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
