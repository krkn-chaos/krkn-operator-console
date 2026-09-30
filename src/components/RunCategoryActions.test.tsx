import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunCategoryStripe } from './RunCategoryActions';

const makeRect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  x: left,
  y: top,
  toJSON: () => ({}),
});

afterEach(() => {
  vi.clearAllTimers();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('RunCategoryStripe', () => {
  it('uses the sidebar marker width and visibly expands before showing its tooltip', async () => {
    render(
      <RunCategoryStripe categories={[{ name: 'resilience', color: '#0066cc', availableToAll: true }]} />,
    );

    const stripe = screen.getByRole('group', { name: 'Categories: resilience' });
    const visualStripe = screen.getByTestId('category-stripe-visual');
    expect(stripe.style.width).toBe('var(--pf-v5-global--BorderWidth--xl, 4px)');
    expect(visualStripe.style.width).toBe('var(--pf-v5-global--BorderWidth--xl, 4px)');
    expect(visualStripe.style.borderRadius).toBe('0px');

    fireEvent.mouseEnter(stripe);
    expect(stripe.style.width).toBe('var(--pf-v5-global--BorderWidth--xl, 4px)');
    expect(visualStripe.style.width).toBe('3.23mm');
    expect(visualStripe.style.transition).toBe('width 180ms ease-out');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    vi.spyOn(stripe, 'getBoundingClientRect').mockReturnValue({
      ...makeRect(10, 30, 12, 24),
    });
    vi.spyOn(visualStripe, 'getBoundingClientRect').mockReturnValue({
      ...makeRect(10, 32, 9, 20),
    });

    fireEvent.transitionEnd(visualStripe, { propertyName: 'width' });
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.style.left).toBe('29.6064px');
    expect(tooltip.style.top).toBe('42px');
    expect(tooltip.style.width).toBe('max-content');
    expect(tooltip.style.maxWidth).toBe('300px');
    expect(tooltip.parentElement).toBe(stripe);
  });

  it('shows the tooltip from the fallback timer when the width transition event is missing', () => {
    vi.useFakeTimers();
    render(<RunCategoryStripe categories={[{ name: 'resilience', color: '#0066cc', availableToAll: true }]} />);

    const visualStripe = screen.getByTestId('category-stripe-visual');
    fireEvent.mouseEnter(visualStripe);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(230));

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it.each(['mouse leave', 'blur'] as const)('cancels the fallback reveal on %s', (event) => {
    vi.useFakeTimers();
    render(<RunCategoryStripe categories={[{ name: 'resilience', color: '#0066cc', availableToAll: true }]} />);

    const stripe = screen.getByRole('group', { name: 'Categories: resilience' });
    const visualStripe = screen.getByTestId('category-stripe-visual');
    if (event === 'mouse leave') {
      fireEvent.mouseEnter(visualStripe);
      fireEvent.mouseLeave(visualStripe);
    } else {
      fireEvent.focus(stripe);
      fireEvent.blur(stripe);
    }

    act(() => vi.advanceTimersByTime(230));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps a visible tooltip open while the pointer crosses the gap into it', () => {
    vi.useFakeTimers();
    render(<RunCategoryStripe categories={[{ name: 'resilience', color: '#0066cc', availableToAll: true }]} />);

    const visualStripe = screen.getByTestId('category-stripe-visual');
    fireEvent.mouseEnter(visualStripe);
    fireEvent.transitionEnd(visualStripe, { propertyName: 'width' });
    const tooltip = screen.getByRole('tooltip');

    fireEvent.mouseLeave(visualStripe);
    act(() => vi.advanceTimersByTime(100));
    fireEvent.mouseEnter(tooltip);
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(tooltip);
    act(() => vi.advanceTimersByTime(250));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps long category names inside the viewport and points the arrow at the stripe', () => {
    vi.stubGlobal('innerWidth', 320);
    render(
      <RunCategoryStripe categories={[{
        name: 'a-very-long-category-name-without-natural-breaks-that-must-wrap',
        color: '#0066cc',
        availableToAll: true,
      }]} />,
    );

    const visualStripe = screen.getByTestId('category-stripe-visual');
    vi.spyOn(visualStripe, 'getBoundingClientRect').mockReturnValue(makeRect(200, 40, 12, 20));
    fireEvent.mouseEnter(visualStripe);
    fireEvent.transitionEnd(visualStripe, { propertyName: 'width' });

    const tooltip = screen.getByRole('tooltip');
    const left = Number.parseFloat(tooltip.style.left);
    const maxWidth = Number.parseFloat(tooltip.style.maxWidth);
    expect(tooltip).toHaveClass('pf-m-left');
    expect(left).toBeGreaterThanOrEqual(8);
    expect(left + maxWidth).toBeLessThanOrEqual(312);
    expect(tooltip).toHaveStyle({ overflowWrap: 'anywhere' });
    expect(tooltip.querySelector('.pf-v5-c-tooltip__arrow')).toHaveStyle({ right: '0px' });
  });

  it('repositions the tooltip arrow when the run row changes height during resize', () => {
    render(<RunCategoryStripe categories={[{ name: 'resilience', color: '#0066cc', availableToAll: true }]} />);

    const visualStripe = screen.getByTestId('category-stripe-visual');
    let visualRect = makeRect(10, 32, 9, 20);
    vi.spyOn(visualStripe, 'getBoundingClientRect').mockImplementation(() => visualRect);
    fireEvent.mouseEnter(visualStripe);
    fireEvent.transitionEnd(visualStripe, { propertyName: 'width' });
    expect(screen.getByRole('tooltip').style.top).toBe('42px');

    visualRect = makeRect(10, 60, 9, 24);
    fireEvent.resize(window);

    expect(screen.getByRole('tooltip').style.top).toBe('72px');
  });

  it('renders category colors as contiguous equal-height gradient stops', () => {
    render(
      <RunCategoryStripe
        categories={[
          { name: 'first', color: '#cc0066', availableToAll: true },
          { name: 'second', color: '#00aa66', availableToAll: true },
          { name: 'third', color: '#0066cc', availableToAll: true },
        ]}
      />,
    );

    const gradient = screen.getByTestId('category-stripe-visual').style.backgroundImage;
    expect(gradient).toContain('rgb(204, 0, 102) 0.0000%');
    expect(gradient).toContain('rgb(204, 0, 102) 33.3333%');
    expect(gradient).toContain('rgb(0, 170, 102) 33.3333%');
    expect(gradient).toContain('rgb(0, 170, 102) 66.6667%');
    expect(gradient).toContain('rgb(0, 102, 204) 66.6667%');
    expect(gradient).toContain('rgb(0, 102, 204) 100.0000%');
  });
});
