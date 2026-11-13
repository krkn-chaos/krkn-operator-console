import { useState } from 'react';
import { krknAiApi } from '../services/krknAiApi';
import type { KrknAIRunPhase, KrknAIRunSummary } from '../services/krknAiApi';
import { isActiveAIRunPhase } from '../utils/krknAIPhases';

interface UseKrknAIResultsDownloadOptions {
  runName: string;
  runPhase: KrknAIRunPhase;
  summary?: KrknAIRunSummary | null;
}


export function useKrknAIResultsDownload({ runName, runPhase, summary }: UseKrknAIResultsDownloadOptions) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isActive = isActiveAIRunPhase(runPhase);
  const hasCommittedResults = summary?.resultsCompleteness != null
    ? summary.resultsCompleteness !== 'none'
    : ['succeeded', 'failed'].includes(summary?.artifactStatus ?? '');
  const partial = summary?.resultsCompleteness === 'partial';
  const isDisabled = downloading || isActive || !hasCommittedResults;
  const download = async () => {
    if (isDisabled) return;
    setDownloading(true);
    setError(null);
    try {
      const blob = await krknAiApi.downloadResults(runName);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${runName}-results.zip`;
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); URL.revokeObjectURL(url); }
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download results.');
    } finally {
      setDownloading(false);
    }
  };

  return { download, downloading, error, isActive, hasCommittedResults, partial, isDisabled };
}
