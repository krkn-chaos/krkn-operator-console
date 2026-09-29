import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RunCategoryStripe } from './RunCategoryActions';

describe('RunCategoryStripe', () => {
  it('uses square sidebar-matched widths and waits for expansion before showing its tooltip', async () => {
    render(
      <RunCategoryStripe categories={[{ name: 'resilience', color: '#0066cc', availableToAll: true }]} />,
    );

    const stripe = screen.getByRole('img', { name: 'Categories: resilience' });
    expect(stripe.style.width).toBe('2.8mm');
    expect(stripe.style.borderRadius).toBe('0px');

    fireEvent.mouseEnter(stripe);
    expect(stripe.style.width).toBe('3.23mm');
    expect(stripe.style.transition).toBe('width 180ms ease-out');
    await screen.findByRole('tooltip');
  });
});
