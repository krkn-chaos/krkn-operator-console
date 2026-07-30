import type { ClusterResiliencyScore, GraphClusterScore } from '../types/api';

/**
 * 5-level color gradient based on score/baseline ratio.
 * Shared across all resiliency score displays for consistency.
 */
export function getScoreColor(score: number, baseline: number): string {
  const ratio = score / baseline;
  if (ratio >= 1.0) return '#28a745';
  if (ratio >= 0.95) return '#5cb85c';
  if (ratio >= 0.9) return '#ffc107';
  if (ratio >= 0.8) return '#fd7e14';
  return '#dc3545';
}

export function getScoreLevel(score: number, baseline: number): { label: string; description: string } {
  const ratio = score / baseline;
  const pct = (ratio * 100).toFixed(1);
  if (ratio >= 1.0) return { label: 'Excellent', description: `${pct}% of baseline — meets or exceeds the target` };
  if (ratio >= 0.95) return { label: 'Good', description: `${pct}% of baseline — within 5% of target` };
  if (ratio >= 0.9) return { label: 'Warning', description: `${pct}% of baseline — 5-10% below target` };
  if (ratio >= 0.8) return { label: 'Poor', description: `${pct}% of baseline — 10-20% below target` };
  return { label: 'Critical', description: `${pct}% of baseline — more than 20% below target` };
}

export function formatScore(score: number): string {
  return score.toFixed(1);
}

/** Sentinel value: backend sends calculated = -1 while score is still being computed */
export const SCORE_CALCULATING = -1;

/** True if any cluster score is still being calculated (sentinel value -1) */
export function isScoreCalculating(scores: GraphClusterScore[]): boolean {
  return scores.some(cs => cs.calculated === SCORE_CALCULATING);
}

export function allClustersPassed(scores: GraphClusterScore[]): boolean {
  return scores.every(cs => cs.status === 'pass');
}

export function calculateNodeScoreAverage(scores: ClusterResiliencyScore[]): number {
  if (!scores || scores.length === 0) return 0;
  return scores.reduce((sum, cs) => sum + cs.score, 0) / scores.length;
}
