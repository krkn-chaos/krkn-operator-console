import { useState } from 'react';
import { Alert, Button, Tooltip } from '@patternfly/react-core';
import { DownloadIcon } from '@patternfly/react-icons';
import { krknAiApi } from '../../services/krknAiApi';

export function ResultsDownloadButton({ runName, compact = false }: { runName: string; compact?: boolean }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const download = async () => {
    if (downloading) return;
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
  return (
    <div className="krkn-ai-results-download" onClick={(event) => event.stopPropagation()}>
      <Tooltip content="Download all committed run results as a ZIP archive">
        <Button
          variant={compact ? 'control' : 'secondary'}
          icon={<DownloadIcon />}
          aria-label={`Download complete results for run ${runName}`}
          isLoading={downloading}
          isDisabled={downloading}
          onClick={() => void download()}
        >
          {!compact && (downloading ? 'Preparing ZIP…' : 'Download results ZIP')}
        </Button>
      </Tooltip>
      {error && <Alert variant="danger" title="Results download failed" isInline>{error}</Alert>}
    </div>
  );
}
