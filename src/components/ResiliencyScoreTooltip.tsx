/**
 * ResiliencyScoreTooltip Component
 *
 * Shared component for displaying resiliency scores with a tooltip showing
 * per-cluster breakdown. Handles three display states:
 * - Calculating: spinning icon with "Calculating..." label
 * - No Baseline: blue info label when no valid baseline is configured
 * - Normal: colored score label with tooltip showing overall + per-cluster scores
 *
 * @example
 * ```tsx
 * <ResiliencyScoreTooltip
 *   scores={item.resiliencyScores}
 *   baseline={item.resiliencyScoreBaseline}
 * />
 * ```
 */

import { Tooltip, Label } from '@patternfly/react-core';
import {
  SyncAltIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
} from '@patternfly/react-icons';
import type { GraphClusterScore } from '../types/api';
import { getScoreColor, formatScore, isScoreCalculating } from '../utils/resiliency';

/** Props for the ResiliencyScoreTooltip component */
export interface ResiliencyScoreTooltipProps {
  /** Per-cluster resiliency scores from the graph run */
  scores?: GraphClusterScore[];
  /** Explicit baseline from the run configuration (takes precedence over per-cluster baselines) */
  baseline?: number;
}

/** Info color used for no-baseline states */
const INFO_COLOR = '#17a2b8';

/**
 * Determine the PatternFly Label color and icon based on score/baseline ratio.
 * Used internally for the outer Label element.
 */
function getLabelDisplay(score: number, baseline: number): {
  color: 'green' | 'orange' | 'red';
  icon: React.ReactElement;
} {
  const ratio = score / baseline;
  if (ratio >= 0.95) return { color: 'green', icon: <CheckCircleIcon /> };
  if (ratio >= 0.8) return { color: 'orange', icon: <ExclamationTriangleIcon /> };
  return { color: 'red', icon: <ExclamationCircleIcon /> };
}

/**
 * Renders a per-cluster score breakdown list inside a tooltip.
 */
function PerClusterBreakdown({
  scores,
  effectiveBaseline,
  useInfoColor,
}: {
  scores: GraphClusterScore[];
  effectiveBaseline: number;
  useInfoColor: boolean;
}) {
  return (
    <div>
      <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}>Per-Cluster:</div>
      {scores.map(cs => {
        const clusterColor = useInfoColor
          ? INFO_COLOR
          : getScoreColor(cs.calculated, cs.baseline ?? effectiveBaseline);
        return (
          <div key={cs.clusterName} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
            <span style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
              {cs.clusterName}
            </span>
            <span style={{ fontWeight: 'bold', fontSize: '11px', color: clusterColor }}>
              {formatScore(cs.calculated)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renders the score header inside a tooltip (colored box + title + subtitle).
 */
function ScoreHeader({
  avgScore,
  isMulti,
  borderColor,
  boxColor,
  title,
  subtitle,
}: {
  avgScore: number;
  isMulti: boolean;
  borderColor: string;
  boxColor: string;
  title: string;
  subtitle: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      marginBottom: '8px', paddingBottom: '6px',
      borderBottom: `2px solid ${borderColor}`,
    }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '6px',
        backgroundColor: boxColor, color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 'bold', fontSize: '11px',
      }}>
        {formatScore(avgScore)}
      </div>
      <div>
        <div style={{ fontWeight: 'bold', fontSize: '13px' }}>
          {title}{isMulti ? ' (avg)' : ''}
        </div>
        <div style={{ fontSize: '11px' }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}

/**
 * ResiliencyScoreTooltip renders a PatternFly Label wrapped in a Tooltip
 * showing resiliency score details.
 *
 * Display modes:
 * 1. **N/A** - No scores available (grey label)
 * 2. **Calculating** - Scores being computed (grey label with spinning icon)
 * 3. **No Baseline** - No valid baseline configured or any cluster has 'no-baseline' status (blue label)
 * 4. **Normal** - Score with color based on ratio to baseline (green/orange/red label)
 */
export function ResiliencyScoreTooltip({ scores, baseline: explicitBaseline }: ResiliencyScoreTooltipProps) {
  // No scores available
  if (!scores || scores.length === 0) {
    return (
      <Tooltip content="Resiliency score not enabled for this run">
        <Label color="grey">N/A</Label>
      </Tooltip>
    );
  }

  // Still calculating
  if (isScoreCalculating(scores)) {
    return (
      <Tooltip content="Score calculation in progress...">
        <Label color="grey" icon={<SyncAltIcon className="pf-m-spin" />}>
          Calculating...
        </Label>
      </Tooltip>
    );
  }

  const avgScore = scores.reduce((sum, cs) => sum + cs.calculated, 0) / scores.length;
  const isMulti = scores.length > 1;

  // Determine effective baseline
  const baseline = explicitBaseline ?? scores[0]?.baseline;
  const hasNoBaseline =
    baseline == null ||
    baseline <= 0 ||
    scores.some(cs => cs.status === 'no-baseline');

  // No valid baseline - show neutral info display
  if (hasNoBaseline) {
    return (
      <Tooltip
        content={
          <div style={{ maxWidth: '260px' }}>
            <ScoreHeader
              avgScore={avgScore}
              isMulti={isMulti}
              borderColor={INFO_COLOR}
              boxColor={INFO_COLOR}
              title="Score"
              subtitle={<span style={{ color: INFO_COLOR }}>No Baseline</span>}
            />
            {isMulti && (
              <PerClusterBreakdown
                scores={scores}
                effectiveBaseline={0}
                useInfoColor
              />
            )}
          </div>
        }
      >
        <Label color="blue">
          {formatScore(avgScore)}{isMulti ? ' (avg)' : ''} - No Baseline
        </Label>
      </Tooltip>
    );
  }

  // Normal display with valid baseline
  const scoreColor = getScoreColor(avgScore, baseline);
  const labelDisplay = getLabelDisplay(avgScore, baseline);

  return (
    <Tooltip
      content={
        <div style={{ maxWidth: '260px' }}>
          <ScoreHeader
            avgScore={avgScore}
            isMulti={isMulti}
            borderColor={scoreColor}
            boxColor={scoreColor}
            title="Overall Score"
            subtitle={<>Baseline: {formatScore(baseline)}</>}
          />
          {isMulti && (
            <PerClusterBreakdown
              scores={scores}
              effectiveBaseline={baseline}
              useInfoColor={false}
            />
          )}
        </div>
      }
    >
      <Label color={labelDisplay.color} icon={labelDisplay.icon}>
        {formatScore(avgScore)}{isMulti ? ' (avg)' : ''}
      </Label>
    </Tooltip>
  );
}
