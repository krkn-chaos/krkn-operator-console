/**
 * ActiveRunsSummary Component
 *
 * Displays a summary banner of currently active scenario runs.
 * Shows total runs, total clusters, and a clickable icon to view details.
 * Updates automatically via polling hook.
 */

import { useState } from 'react';
import { Alert, Spinner } from '@patternfly/react-core';
import { SearchIcon } from '@patternfly/react-icons';
import type { ActiveRunsResponse } from '../types/api';
import { ActiveRunsModal } from './ActiveRunsModal';

interface ActiveRunsSummaryProps {
  activeRuns: ActiveRunsResponse | null;
  loading: boolean;
  error: string | null;
}

export function ActiveRunsSummary({ activeRuns, loading, error }: ActiveRunsSummaryProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Don't show anything if loading initially
  if (loading && !activeRuns) {
    return null;
  }

  // Don't show anything if there's an error
  if (error) {
    return null;
  }

  // Don't show if no active runs
  if (!activeRuns || activeRuns.totalActiveRuns === 0) {
    return null;
  }

  const isPlural = activeRuns.totalActiveRuns > 1;
  const thereIs = isPlural ? 'There are' : "There's";
  const scenarioText = isPlural ? 'scenarios' : 'scenario';

  const message = `${thereIs} ${activeRuns.totalActiveRuns} ${scenarioText} currently running`;

  return (
    <>
      <Alert
        variant="warning"
        isInline
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>{message}</span>
            {loading && <Spinner size="md" />}
            <SearchIcon
              style={{
                cursor: 'pointer',
                marginLeft: '0.5rem',
                fontSize: '1.2rem'
              }}
              onClick={() => setIsModalOpen(true)}
              aria-label="View details"
            />
          </div>
        }
        style={{ marginBottom: '1rem' }}
      />

      <ActiveRunsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        activeRuns={activeRuns}
      />
    </>
  );
}
