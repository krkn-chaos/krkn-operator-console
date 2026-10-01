import { describe, it, expect } from 'vitest';
import {
  getScoreColor,
  getScoreLevel,
  formatScore,
  allClustersPassed,
  calculateNodeScoreAverage,
  isScoreCalculating,
  toGraphClusterScores,
  SCORE_CALCULATING,
  aggregateResiliencyScores,
} from '../resiliency';
import type { ClusterResiliencyScore, GraphClusterScore } from '../../types/api';

describe('getScoreColor', () => {
  it('returns dark green for ratio >= 100%', () => {
    expect(getScoreColor(80, 80)).toBe('#28a745');
    expect(getScoreColor(90, 80)).toBe('#28a745');
  });

  it('returns light green for ratio 95-100%', () => {
    expect(getScoreColor(77, 80)).toBe('#5cb85c');
    expect(getScoreColor(79.9, 80)).toBe('#5cb85c');
  });

  it('returns yellow for ratio 90-95%', () => {
    expect(getScoreColor(73, 80)).toBe('#ffc107');
    expect(getScoreColor(75.9, 80)).toBe('#ffc107');
  });

  it('returns orange for ratio 80-90%', () => {
    expect(getScoreColor(65, 80)).toBe('#fd7e14');
    expect(getScoreColor(71.9, 80)).toBe('#fd7e14');
  });

  it('returns red for ratio < 80%', () => {
    expect(getScoreColor(50, 80)).toBe('#dc3545');
    expect(getScoreColor(63.9, 80)).toBe('#dc3545');
  });

  it('returns info blue when baseline is 0', () => {
    expect(getScoreColor(50, 0)).toBe('#17a2b8');
    expect(getScoreColor(100, 0)).toBe('#17a2b8');
  });

  it('returns info blue when baseline is negative', () => {
    expect(getScoreColor(50, -10)).toBe('#17a2b8');
  });
});

describe('getScoreLevel', () => {
  it('returns Excellent for ratio >= 100%', () => {
    expect(getScoreLevel(90, 80).label).toBe('Excellent');
  });

  it('returns Good for ratio 95-100%', () => {
    expect(getScoreLevel(77, 80).label).toBe('Good');
  });

  it('returns Warning for ratio 90-95%', () => {
    expect(getScoreLevel(73, 80).label).toBe('Warning');
  });

  it('returns Poor for ratio 80-90%', () => {
    expect(getScoreLevel(68, 80).label).toBe('Poor');
  });

  it('returns Critical for ratio < 80%', () => {
    expect(getScoreLevel(50, 80).label).toBe('Critical');
  });

  it('includes percentage in description', () => {
    const level = getScoreLevel(90, 80);
    expect(level.description).toContain('112.5%');
  });

  it('returns No Baseline when baseline is 0', () => {
    const level = getScoreLevel(85, 0);
    expect(level.label).toBe('No Baseline');
    expect(level.description).toBe('No baseline configured');
  });

  it('returns No Baseline when baseline is negative', () => {
    const level = getScoreLevel(85, -5);
    expect(level.label).toBe('No Baseline');
    expect(level.description).toBe('No baseline configured');
  });
});

describe('formatScore', () => {
  it('formats to 1 decimal place', () => {
    expect(formatScore(85)).toBe('85.0');
    expect(formatScore(85.123)).toBe('85.1');
    expect(formatScore(85.999)).toBe('86.0');
  });
});

describe('allClustersPassed', () => {
  it('returns true when all clusters pass', () => {
    const scores: GraphClusterScore[] = [
      { clusterName: 'a', calculated: 90, status: 'pass' },
      { clusterName: 'b', calculated: 85, status: 'pass' },
    ];
    expect(allClustersPassed(scores)).toBe(true);
  });

  it('returns false when any cluster fails', () => {
    const scores: GraphClusterScore[] = [
      { clusterName: 'a', calculated: 90, status: 'pass' },
      { clusterName: 'b', calculated: 70, status: 'fail' },
    ];
    expect(allClustersPassed(scores)).toBe(false);
  });

  it('returns false with no-baseline status', () => {
    const scores: GraphClusterScore[] = [
      { clusterName: 'a', calculated: 90, status: 'no-baseline' },
    ];
    expect(allClustersPassed(scores)).toBe(false);
  });

  it('returns true for empty array', () => {
    expect(allClustersPassed([])).toBe(true);
  });
});

describe('calculateNodeScoreAverage', () => {
  it('calculates average of scores', () => {
    const scores: ClusterResiliencyScore[] = [
      { clusterName: 'a', score: 90 },
      { clusterName: 'b', score: 70 },
    ];
    expect(calculateNodeScoreAverage(scores)).toBe(80);
  });

  it('returns single score for one cluster', () => {
    const scores: ClusterResiliencyScore[] = [
      { clusterName: 'a', score: 85 },
    ];
    expect(calculateNodeScoreAverage(scores)).toBe(85);
  });

  it('returns 0 for empty array', () => {
    expect(calculateNodeScoreAverage([])).toBe(0);
  });
});

describe('SCORE_CALCULATING', () => {
  it('is -1', () => {
    expect(SCORE_CALCULATING).toBe(-1);
  });
});

describe('toGraphClusterScores', () => {
  it('converts ClusterResiliencyScore[] to GraphClusterScore[]', () => {
    const scores: ClusterResiliencyScore[] = [
      { clusterName: 'cluster-a', score: 92.3 },
      { clusterName: 'cluster-b', score: 78.1 },
    ];
    const result = toGraphClusterScores(scores);
    expect(result).toEqual([
      { clusterName: 'cluster-a', calculated: 92.3, status: 'no-baseline' },
      { clusterName: 'cluster-b', calculated: 78.1, status: 'no-baseline' },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(toGraphClusterScores([])).toEqual([]);
  });

  it('sets status to no-baseline for all entries', () => {
    const scores: ClusterResiliencyScore[] = [
      { clusterName: 'c1', score: 100 },
    ];
    const result = toGraphClusterScores(scores);
    expect(result[0].status).toBe('no-baseline');
  });
});

describe('isScoreCalculating', () => {
  it('returns true when any score has calculated === -1', () => {
    const scores: GraphClusterScore[] = [
      { clusterName: 'a', calculated: 90, status: 'pass' },
      { clusterName: 'b', calculated: -1, status: 'pass' },
    ];
    expect(isScoreCalculating(scores)).toBe(true);
  });

  it('returns true when all scores have calculated === -1', () => {
    const scores: GraphClusterScore[] = [
      { clusterName: 'a', calculated: -1, status: 'pass' },
      { clusterName: 'b', calculated: -1, status: 'pass' },
    ];
    expect(isScoreCalculating(scores)).toBe(true);
  });

  it('returns false when all scores are computed', () => {
    const scores: GraphClusterScore[] = [
      { clusterName: 'a', calculated: 90, status: 'pass' },
      { clusterName: 'b', calculated: 85, status: 'pass' },
    ];
    expect(isScoreCalculating(scores)).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(isScoreCalculating([])).toBe(false);
  });
});

describe('aggregateResiliencyScores', () => {
  it('returns pass when all clusters pass', () => {
    const scores: GraphClusterScore[] = [
      { clusterName: 'a', calculated: 90, baseline: 80, status: 'pass' },
      { clusterName: 'b', calculated: 80, baseline: 80, status: 'pass' },
    ];
    const result = aggregateResiliencyScores(scores);
    expect(result.status).toBe('pass');
    expect(result.calculated).toBe(85);
    expect(result.baseline).toBe(80);
  });

  it('returns fail when any cluster fails', () => {
    const scores: GraphClusterScore[] = [
      { clusterName: 'a', calculated: 90, baseline: 80, status: 'pass' },
      { clusterName: 'b', calculated: 50, baseline: 80, status: 'fail' },
    ];
    const result = aggregateResiliencyScores(scores);
    expect(result.status).toBe('fail');
  });

  it('returns no-baseline when any cluster has no-baseline status', () => {
    const scores: GraphClusterScore[] = [
      { clusterName: 'a', calculated: 90, baseline: 80, status: 'pass' },
      { clusterName: 'b', calculated: 85, status: 'no-baseline' },
    ];
    const result = aggregateResiliencyScores(scores);
    expect(result.status).toBe('no-baseline');
  });

  it('returns no-baseline when baseline is missing from all clusters', () => {
    const scores: GraphClusterScore[] = [
      { clusterName: 'a', calculated: 90, status: 'pass' },
    ];
    const result = aggregateResiliencyScores(scores);
    expect(result.status).toBe('no-baseline');
  });

  it('returns no-baseline when baseline is zero', () => {
    const scores: GraphClusterScore[] = [
      { clusterName: 'a', calculated: 90, baseline: 0, status: 'pass' },
    ];
    const result = aggregateResiliencyScores(scores);
    expect(result.status).toBe('no-baseline');
  });

  it('returns no-baseline when baseline is negative', () => {
    const scores: GraphClusterScore[] = [
      { clusterName: 'a', calculated: 90, baseline: -5, status: 'pass' },
    ];
    const result = aggregateResiliencyScores(scores);
    expect(result.status).toBe('no-baseline');
  });

  it('fail takes precedence over no-baseline', () => {
    const scores: GraphClusterScore[] = [
      { clusterName: 'a', calculated: 50, baseline: 80, status: 'fail' },
      { clusterName: 'b', calculated: 85, status: 'no-baseline' },
    ];
    const result = aggregateResiliencyScores(scores);
    expect(result.status).toBe('fail');
  });

  it('uses explicitBaseline over per-cluster baseline', () => {
    const scores: GraphClusterScore[] = [
      { clusterName: 'a', calculated: 90, baseline: 80, status: 'pass' },
    ];
    const result = aggregateResiliencyScores(scores, 70);
    expect(result.baseline).toBe(70);
  });

  it('falls back to first cluster baseline when no explicit baseline', () => {
    const scores: GraphClusterScore[] = [
      { clusterName: 'a', calculated: 90, baseline: 75, status: 'pass' },
      { clusterName: 'b', calculated: 80, baseline: 80, status: 'pass' },
    ];
    const result = aggregateResiliencyScores(scores);
    expect(result.baseline).toBe(75);
  });

  it('builds a per-cluster message', () => {
    const scores: GraphClusterScore[] = [
      { clusterName: 'cluster-1', calculated: 90, baseline: 80, status: 'pass' },
      { clusterName: 'cluster-2', calculated: 70, baseline: 80, status: 'fail' },
    ];
    const result = aggregateResiliencyScores(scores);
    expect(result.message).toBe('cluster-1: 90, cluster-2: 70');
  });

  it('computes correct average across clusters', () => {
    const scores: GraphClusterScore[] = [
      { clusterName: 'a', calculated: 100, baseline: 80, status: 'pass' },
      { clusterName: 'b', calculated: 80, baseline: 80, status: 'pass' },
      { clusterName: 'c', calculated: 60, baseline: 80, status: 'fail' },
    ];
    const result = aggregateResiliencyScores(scores);
    expect(result.calculated).toBe(80);
  });
});
