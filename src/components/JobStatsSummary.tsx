import { useMemo } from 'react';
import {
  Card,
  CardBody,
  CardFooter,
  CardTitle,
} from '@patternfly/react-core';
import {
  CubesIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  TachometerAltIcon,
} from '@patternfly/react-icons';
import type { UnifiedRunItem } from './JobsList';

interface JobStatsSummaryProps {
  unifiedRuns: UnifiedRunItem[];
}

interface JobCounts {
  total: number;
  succeeded: number;
  failed: number;
}

function collectJobCounts(items: UnifiedRunItem[]): JobCounts {
  let total = 0;
  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    if (item.type === 'scenario') {
      const jobs = item.run.clusterJobs ?? [];
      total += jobs.length;
      succeeded += jobs.filter(j => j.phase === 'Succeeded').length;
      failed += jobs.filter(j => j.phase === 'Failed').length;
    } else {
      const summary = item.summary ?? { totalNodes: 0, completedNodes: 0, failedNodes: 0 };
      total += summary.totalNodes;
      succeeded += summary.completedNodes;
      failed += summary.failedNodes;
    }
  }

  return { total, succeeded, failed };
}

const statCards = [
  {
    label: 'Total Jobs',
    icon: CubesIcon,
    color: 'var(--pf-v5-global--primary-color--100)',
    subText: 'Total cluster jobs across all runs',
    getValue: (stats: { total: number; succeeded: number; failed: number; passRate: string }) => stats.total,
  },
  {
    label: 'Succeeded',
    icon: CheckCircleIcon,
    color: 'var(--pf-v5-global--success-color--100)',
    subText: "Exit code 0",
    getValue: (stats: { total: number; succeeded: number; failed: number; passRate: string }) => stats.succeeded,
  },
  {
    label: 'Failed',
    icon: ExclamationCircleIcon,
    color: 'var(--pf-v5-global--danger-color--100)',
    subText: "Non-zero or unknown exit",
    getValue: (stats: { total: number; succeeded: number; failed: number; passRate: string }) => stats.failed,
  },
  {
    label: 'Pass Rate',
    icon: TachometerAltIcon,
    color: 'var(--pf-v5-global--primary-color--100)',
    subText: 'Percentage of jobs that succeeded',
    getValue: (stats: { total: number; succeeded: number; failed: number; passRate: string }) => stats.passRate,
  },
] as const;

export function JobStatsSummary({ unifiedRuns }: JobStatsSummaryProps) {
  const stats = useMemo(() => {
    const { total, succeeded, failed } = collectJobCounts(unifiedRuns);
    const passRate = total > 0 ? ((succeeded / total) * 100).toFixed(1) + '%' : 'N/A';
    return { total, succeeded, failed, passRate };
  }, [unifiedRuns]);

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {statCards.map(card => {
          const Icon = card.icon;
          const value = card.getValue(stats);
          return (
            <Card isCompact isFlat key={card.label} style={{ flex: '1 1 0', minWidth: '140px',}}>
              <CardTitle>
                 <Icon style={{ fontSize: '1.5rem', color: card.color, marginRight: '0.5rem' }} />
                {card.label}</CardTitle>
              <CardBody>
               
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{value}</div>
              </CardBody>
              <CardFooter>{card.subText}</CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
