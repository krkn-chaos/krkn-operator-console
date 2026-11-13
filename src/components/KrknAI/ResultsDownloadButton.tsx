import { Alert, Button, Tooltip } from '@patternfly/react-core';
import { DownloadIcon } from '@patternfly/react-icons';
import { useKrknAIResultsDownload } from '../../hooks/useKrknAIResultsDownload';
import type { KrknAIRunPhase, KrknAIRunSummary } from '../../services/krknAiApi';

interface ResultsDownloadButtonProps {
  runName: string;
  runPhase: KrknAIRunPhase;
  summary?: KrknAIRunSummary | null;
}

export function ResultsDownloadButton({ runName, runPhase, summary }: ResultsDownloadButtonProps) {
  const { download, downloading, error, isActive, hasCommittedResults, partial, isDisabled } = useKrknAIResultsDownload({ runName, runPhase, summary });
  if (isActive) return null;
  const unavailableLabel = `No committed results for run ${runName}`;
  const actionLabel = hasCommittedResults
    ? `Download ${partial ? 'collected partial' : 'complete'} results for run ${runName}`
    : unavailableLabel;
  return (
    <div className="krkn-ai-results-download" onClick={(event) => event.stopPropagation()}>
      <Tooltip content={partial
        ? 'Download the collected partial snapshots committed before cancellation'
        : hasCommittedResults
          ? 'Download the committed run results as a ZIP archive'
          : 'No committed results are available to download'}>
        <Button
          variant="secondary"
          icon={<DownloadIcon />}
          aria-label={actionLabel}
          isLoading={downloading}
          isDisabled={isDisabled}
          onClick={() => void download()}
        >
          {downloading ? 'Preparing ZIP…' : partial ? 'Download collected partial results ZIP' : hasCommittedResults ? 'Download complete results ZIP' : 'No committed results'}
        </Button>
      </Tooltip>
      {error && <Alert variant="danger" title="Results download failed" isInline>{error}</Alert>}
    </div>
  );
}
