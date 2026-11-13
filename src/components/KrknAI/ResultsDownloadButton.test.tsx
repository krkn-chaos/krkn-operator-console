import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { krknAiApi } from '../../services/krknAiApi';
import type { KrknAIRunSummary } from '../../services/krknAiApi';
import { ResultsDownloadButton } from './ResultsDownloadButton';

vi.mock('../../services/krknAiApi', () => ({
  krknAiApi: {
    downloadResults: vi.fn(),
  },
}));

const completeSummary: KrknAIRunSummary = {
  name: 'test-run',
  phase: 'Succeeded',
  createdAt: '',
  cluster: '',
  orchestratorPodName: '',
  failureReason: '',
  artifactStatus: 'succeeded',
  currentGeneration: null,
  completedGenerations: 0,
  completedScenarios: 0,
  configuredGenerations: 1,
  populationSize: 1,
  bestFitness: null,
  averageFitness: null,
  baselineFitness: null,
  fitnessProgression: [],
  resultsFinalized: true,
  resultsCompleteness: 'complete',
};

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

    render(<ResultsDownloadButton runName="daily-run" runPhase="Succeeded" summary={completeSummary} />);
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
  it.each(['Pending', 'Provisioning', 'Running', 'Cancelling'] as const)(
    'hides results downloads while a run is %s and reveals them after completion',
    (runPhase) => {
      const { rerender } = render(<ResultsDownloadButton
        runName="active-run"
        runPhase={runPhase}
        summary={{ ...completeSummary, artifactStatus: 'in_progress', resultsCompleteness: 'partial' }}
      />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      rerender(<ResultsDownloadButton runName="active-run" runPhase="Succeeded" summary={completeSummary} />);
      expect(screen.getByRole('button', { name: 'Download complete results for run active-run' })).toBeEnabled();
    },
  );


  it('prevents duplicate downloads while a request is in flight', async () => {
    let resolveDownload!: (blob: Blob) => void;
    vi.mocked(krknAiApi.downloadResults).mockReturnValueOnce(
      new Promise<Blob>((resolve) => { resolveDownload = resolve; }),
    );

    render(<ResultsDownloadButton runName="duplicate-run" runPhase="Succeeded" summary={completeSummary} />);
    const button = screen.getByRole('button', { name: 'Download complete results for run duplicate-run' });
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

    render(<ResultsDownloadButton runName="failed-run" runPhase="Failed" summary={{ ...completeSummary, phase: 'Failed', artifactStatus: 'failed' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download complete results for run failed-run' }));

    expect(await screen.findByText('Archive service unavailable')).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('downloads committed partial snapshots after cancellation', async () => {
    vi.mocked(krknAiApi.downloadResults).mockResolvedValueOnce(new Blob(['partial']));
    const partialSummary = {
      ...completeSummary,
      phase: 'Cancelled',
      artifactStatus: 'cancelled' as const,
      resultsFinalized: false,
      resultsCompleteness: 'partial' as const,
    };

    render(<ResultsDownloadButton runName="cancelled-run" runPhase="Cancelled" summary={partialSummary} />);
    const button = screen.getByRole('button', { name: 'Download collected partial results for run cancelled-run' });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    await waitFor(() => expect(krknAiApi.downloadResults).toHaveBeenCalledWith('cancelled-run'));
  });

  it('keeps downloads disabled when the run has no committed artifacts', () => {
    render(<ResultsDownloadButton
      runName="empty-cancelled-run"
      runPhase="Cancelled"
      summary={{ ...completeSummary, phase: 'Cancelled', artifactStatus: 'cancelled', resultsCompleteness: 'none' }}
    />);

    const button = screen.getByRole('button', { name: 'No committed results for run empty-cancelled-run' });
    expect(button).toBeDisabled();
    expect(screen.getByText('No committed results')).toBeInTheDocument();
    expect(krknAiApi.downloadResults).not.toHaveBeenCalled();
  });
});
