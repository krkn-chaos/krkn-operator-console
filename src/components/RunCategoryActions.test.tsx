import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RunCategoryStripe } from './RunCategoryActions';

describe('RunCategoryStripe', () => {
  it('uses the sidebar marker width and visibly expands before showing its tooltip', async () => {
    render(
      <RunCategoryStripe categories={[{ name: 'resilience', color: '#0066cc', availableToAll: true }]} />,
    );

    const stripe = screen.getByRole('group', { name: 'Categories: resilience' });
    const visualStripe = screen.getByTestId('category-stripe-visual');
    expect(stripe.style.width).toBe('3.23mm');
    expect(visualStripe.style.width).toBe('var(--pf-v5-global--BorderWidth--xl, 4px)');
    expect(visualStripe.style.borderRadius).toBe('0px');

    fireEvent.mouseEnter(stripe);
    expect(stripe.style.width).toBe('3.23mm');
    expect(visualStripe.style.width).toBe('3.23mm');
    expect(visualStripe.style.transition).toBe('width 180ms ease-out');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    vi.spyOn(stripe, 'getBoundingClientRect').mockReturnValue({
      left: 10, right: 22, top: 30, bottom: 54, width: 12, height: 24,
      x: 10, y: 30, toJSON: () => ({}),
    });
    vi.spyOn(visualStripe, 'getBoundingClientRect').mockReturnValue({
      left: 10, right: 19, top: 32, bottom: 52, width: 9, height: 20,
      x: 10, y: 32, toJSON: () => ({}),
    });

    fireEvent.transitionEnd(visualStripe, { propertyName: 'width' });
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.style.left).toBe('9px');
    expect(tooltip.style.top).toBe('12px');
    expect(tooltip.style.width).toBe('max-content');
    expect(tooltip.style.maxWidth).toBe('18.75rem');
    expect(tooltip.parentElement).toBe(stripe);
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
