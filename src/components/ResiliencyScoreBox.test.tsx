import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResiliencyScoreBox, ResiliencyScoreNA } from './ResiliencyScoreBox';

describe('ResiliencyScoreBox', () => {
  it('renders nothing when not enabled', () => {
    const { container } = render(
      <ResiliencyScoreBox enabled={false} score={85} baseline={80} status="pass" />
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows calculating state when enabled but no score and calculating=true', () => {
    render(<ResiliencyScoreBox enabled calculating />);
    expect(screen.getByText('⋯')).toBeInTheDocument();
  });

  it('shows calculating state when enabled and score is undefined', () => {
    render(<ResiliencyScoreBox enabled />);
    expect(screen.getByText('⋯')).toBeInTheDocument();
  });

  it('renders score value when score is provided', () => {
    render(<ResiliencyScoreBox score={90} baseline={80} status="pass" enabled />);
    expect(screen.getByText('90.0')).toBeInTheDocument();
  });

  it('uses dark green for ratio >= 100%', () => {
    render(<ResiliencyScoreBox score={90} baseline={80} status="pass" enabled />);
    const scoreEl = screen.getByText('90.0');
    // 90/80 = 1.125 -> dark green #28a745
    expect(scoreEl.closest('div[style]')!.getAttribute('style')).toContain('background-color: rgb(40, 167, 69)');
  });

  it('uses light green for ratio 95-100%', () => {
    render(<ResiliencyScoreBox score={77} baseline={80} status="fail" enabled />);
    const scoreEl = screen.getByText('77.0');
    // 77/80 = 0.9625 -> light green #5cb85c
    expect(scoreEl.closest('div[style]')!.getAttribute('style')).toContain('background-color: rgb(92, 184, 92)');
  });

  it('uses yellow for ratio 90-95%', () => {
    render(<ResiliencyScoreBox score={73} baseline={80} status="fail" enabled />);
    const scoreEl = screen.getByText('73.0');
    // 73/80 = 0.9125 -> yellow #ffc107
    expect(scoreEl.closest('div[style]')!.getAttribute('style')).toContain('background-color: rgb(255, 193, 7)');
  });

  it('uses orange for ratio 80-90%', () => {
    render(<ResiliencyScoreBox score={68} baseline={80} status="fail" enabled />);
    const scoreEl = screen.getByText('68.0');
    // 68/80 = 0.85 -> orange #fd7e14
    expect(scoreEl.closest('div[style]')!.getAttribute('style')).toContain('background-color: rgb(253, 126, 20)');
  });

  it('uses red for ratio < 80%', () => {
    render(<ResiliencyScoreBox score={50} baseline={80} status="fail" enabled />);
    const scoreEl = screen.getByText('50.0');
    // 50/80 = 0.625 -> red #dc3545
    expect(scoreEl.closest('div[style]')!.getAttribute('style')).toContain('background-color: rgb(220, 53, 69)');
  });

  it('uses blue when no baseline provided', () => {
    render(<ResiliencyScoreBox score={85} status="no-baseline" enabled />);
    const scoreEl = screen.getByText('85.0');
    // No baseline -> blue #17a2b8
    expect(scoreEl.closest('div[style]')!.getAttribute('style')).toContain('background-color: rgb(23, 162, 184)');
  });
});

describe('ResiliencyScoreNA', () => {
  it('renders N/A text', () => {
    render(<ResiliencyScoreNA />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('has dark grey background', () => {
    render(<ResiliencyScoreNA />);
    const naEl = screen.getByText('N/A');
    expect(naEl.getAttribute('style')).toContain('background-color: rgb(73, 80, 87)');
  });
});
