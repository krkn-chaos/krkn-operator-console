/**
 * ResiliencyScoreBox - Visual score indicator for GraphRuns
 *
 * Displays resiliency score as a colored square box with:
 * - Color based on score/baseline ratio (5-level gradient)
 * - Score value in white text
 * - Tooltip with detailed information
 * - N/A state for missing scores
 */

import React from 'react';
import { Tooltip } from '@patternfly/react-core';
import type { GraphClusterScore } from '../types/api';
import { getScoreColor } from '../utils/resiliency';

interface ResiliencyScoreBoxProps {
  /** Calculated score value (aggregate/average for multi-cluster) */
  score?: number;
  /** Baseline target value */
  baseline?: number;
  /** Score status (pass/fail/no-baseline) */
  status?: 'pass' | 'fail' | 'no-baseline';
  /** Whether score calculation is enabled */
  enabled?: boolean;
  /** Whether the run is still in progress */
  calculating?: boolean;
  /** Per-cluster score breakdown (multi-cluster support) */
  clusterScores?: GraphClusterScore[];
}

export const ResiliencyScoreBox: React.FC<ResiliencyScoreBoxProps> = ({
  score,
  baseline,
  status,
  enabled = true,
  calculating = false,
  clusterScores,
}) => {
  const isMultiCluster = (clusterScores?.length ?? 0) > 1;

  // Not enabled - return null (no box displayed)
  if (!enabled) {
    return null;
  }

  // Calculating state (run in progress)
  if (calculating || (enabled && score === undefined)) {
    return (
      <Tooltip content="Score calculation in progress...">
        <div
          style={{
            width: '60px',
            height: '60px',
            backgroundColor: '#6c757d', // Grigio
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>⋯</span>
        </div>
      </Tooltip>
    );
  }

  // Score calculated - at this point score must be defined
  if (score === undefined) {
    return <ResiliencyScoreNA />;
  }

  const backgroundColor = baseline
    ? getScoreColor(score, baseline)
    : '#17a2b8'; // Blu se no baseline

  const tooltipContent = isMultiCluster ? (
    <div style={{ maxWidth: '260px' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
        Overall Score: {score.toFixed(1)}{baseline ? ` / Baseline: ${baseline.toFixed(1)}` : ''} ({status || 'unknown'})
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '4px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '3px' }}>Per-Cluster:</div>
        {clusterScores!.map(cs => {
          const clusterColor = cs.baseline ? getScoreColor(cs.calculated, cs.baseline) : '#17a2b8';
          return (
            <div key={cs.clusterName} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{cs.clusterName}</span>
              <span style={{ fontWeight: 'bold', fontSize: '11px', color: clusterColor }}>{cs.calculated.toFixed(1)} ({cs.status})</span>
            </div>
          );
        })}
      </div>
    </div>
  ) : baseline
    ? `Score: ${score.toFixed(1)} / Baseline: ${baseline.toFixed(1)} (${status || 'unknown'})`
    : `Score: ${score.toFixed(1)} (no baseline)`;

  return (
    <Tooltip content={tooltipContent}>
      <div
        style={{
          width: '35px',
          height: '35px',
          backgroundColor,
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'transform 0.2s',
          fontWeight: 'bold',
          fontSize: isMultiCluster ? '10px' : '12px',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {score.toFixed(1)}
        {isMultiCluster && <span style={{ fontSize: '7px', opacity: 0.8, lineHeight: 1 }}>avg</span>}
      </div>
    </Tooltip>
  );
};

/**
 * ResiliencyScoreNA - N/A state for disabled or failed runs
 */
export const ResiliencyScoreNA: React.FC = () => {
  return (
    <Tooltip content="Resiliency score not available">
      <div
        style={{
          width: '35px',
          height: '35px',
          backgroundColor: '#495057', // Grigio scuro
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          fontWeight: 'bold',
          fontSize: '10px',
        }}
      >
        N/A
      </div>
    </Tooltip>
  );
};
