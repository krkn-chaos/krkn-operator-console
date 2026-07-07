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

interface ResiliencyScoreBoxProps {
  /** Calculated score value */
  score?: number;
  /** Baseline target value */
  baseline?: number;
  /** Score status (pass/fail/no-baseline) */
  status?: 'pass' | 'fail' | 'no-baseline';
  /** Whether score calculation is enabled */
  enabled?: boolean;
  /** Whether the run is still in progress */
  calculating?: boolean;
}

export const ResiliencyScoreBox: React.FC<ResiliencyScoreBoxProps> = ({
  score,
  baseline,
  status,
  enabled = true,
  calculating = false,
}) => {
  /**
   * Formula Opzione 2: 5-level color gradient based on score/baseline ratio
   *
   * >= 100%: Dark green (excellent)
   * 95-100%: Light green (good)
   * 90-95%: Yellow (warning)
   * 80-90%: Orange (poor)
   * < 80%: Red (critical)
   */
  const getScoreColor = (score: number, baseline: number): string => {
    const ratio = score / baseline;

    if (ratio >= 1.0) return '#28a745'; // 🟢 Verde scuro - excellent
    if (ratio >= 0.95) return '#5cb85c'; // 🟢 Verde chiaro - good (95-100%)
    if (ratio >= 0.9) return '#ffc107'; // 🟡 Giallo - warning (90-95%)
    if (ratio >= 0.8) return '#fd7e14'; // 🟠 Arancione - poor (80-90%)
    return '#dc3545'; // 🔴 Rosso - critical (< 80%)
  };

  // Not enabled - return null (no box displayed)
  if (!enabled) {
    return null;
  }

  // Calculating state (run in progress)
  if (calculating || (enabled && !score)) {
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
  if (!score) {
    return <ResiliencyScoreNA />;
  }

  const backgroundColor = baseline
    ? getScoreColor(score, baseline)
    : '#17a2b8'; // Blu se no baseline

  const tooltipContent = baseline
    ? `Score: ${score.toFixed(1)} / Baseline: ${baseline.toFixed(1)} (${status || 'unknown'})`
    : `Score: ${score.toFixed(1)} (no baseline)`;

  return (
    <Tooltip content={tooltipContent}>
      <div
        style={{
          width: '30px',
          height: '30px',
          backgroundColor,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'transform 0.2s',
          fontWeight: 'bold',
          fontSize: '11px',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {score.toFixed(1)}
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
          width: '30px',
          height: '30px',
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
