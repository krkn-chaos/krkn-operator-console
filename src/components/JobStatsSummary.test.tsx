import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { JobStatsSummary } from './JobStatsSummary';
import type { JobStatsSummary as JobStatsSummaryType } from '../types/api';

function makeStats(totalJobs: number, succeededJobs: number, failedJobs: number): JobStatsSummaryType {
  return { totalJobs, succeededJobs, failedJobs };
}

describe('JobStatsSummary', () => {
  it('renders all 4 stat cards with labels', () => {
    render(<JobStatsSummary stats={makeStats(0, 0, 0)} />);
    expect(screen.getByText('Total Jobs')).toBeInTheDocument();
    expect(screen.getByText('Succeeded')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Pass Rate')).toBeInTheDocument();
  });

  it('renders sub-text descriptions in card footers', () => {
    render(<JobStatsSummary stats={makeStats(0, 0, 0)} />);
    expect(screen.getByText('Total cluster jobs across all runs')).toBeInTheDocument();
    expect(screen.getByText('Exit code 0')).toBeInTheDocument();
    expect(screen.getByText('Non-zero or unknown exit')).toBeInTheDocument();
    expect(screen.getByText('Percentage of jobs that succeeded')).toBeInTheDocument();
  });

  it('shows all zeros and N/A when empty', () => {
    render(<JobStatsSummary stats={makeStats(0, 0, 0)} />);
    const zeros = screen.getAllByText('0');
    expect(zeros).toHaveLength(3);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('displays server-computed stats correctly', () => {
    render(<JobStatsSummary stats={makeStats(3, 2, 1)} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('66.7%')).toBeInTheDocument();
  });

  it('aggregates across many jobs', () => {
    render(<JobStatsSummary stats={makeStats(100, 75, 25)} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
  });

  it('shows 100% pass rate when all jobs succeeded', () => {
    render(<JobStatsSummary stats={makeStats(5, 5, 0)} />);
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('shows 0% pass rate when all jobs failed', () => {
    render(<JobStatsSummary stats={makeStats(3, 0, 3)} />);
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('handles running jobs in total (not counted as succeeded or failed)', () => {
    // totalJobs=5 but only 3 succeeded + 1 failed = 1 running
    render(<JobStatsSummary stats={makeStats(5, 3, 1)} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument();
  });
});
