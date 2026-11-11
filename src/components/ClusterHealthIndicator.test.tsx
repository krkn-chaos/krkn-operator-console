import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ClusterHealthIndicator } from './ClusterHealthIndicator';
import type { ClusterHealthStatus } from '../types/api';

describe('ClusterHealthIndicator', () => {
  it.each([
    { status: 'healthy' as const, colorClass: 'pf-m-green', description: 'ACM reports this cluster as healthy.' },
    { status: 'unhealthy' as const, colorClass: 'pf-m-red', description: 'Chaos scenarios may fail because this cluster is in an inconsistent state. Ask your administrator to investigate its status.' },
    { status: 'unknown' as const, colorClass: undefined, description: 'Health could not be determined because the availability status is missing or inconclusive.' },
  ])('shows $status with its color and tooltip', async ({ status, colorClass, description }) => {
    render(<ClusterHealthIndicator status={status} />);

    const label = screen.getByLabelText(`Cluster status: ${status}`);
    if (colorClass) {
      expect(label).toHaveClass(colorClass);
    } else {
      expect(label).toHaveClass('pf-v5-c-label');
      expect(label).not.toHaveClass('pf-m-red');
      expect(label).not.toHaveClass('pf-m-green');
    }

    await userEvent.hover(label);
    expect(await screen.findByText(description)).toBeInTheDocument();
  });

  it('renders an unrecognized API status as unknown instead of crashing', async () => {
    render(<ClusterHealthIndicator status={'degraded' as unknown as ClusterHealthStatus} />);

    const label = screen.getByLabelText('Cluster status: unknown');
    expect(label).toHaveClass('pf-v5-c-label');
    expect(label).not.toHaveClass('pf-m-red');
    expect(label).not.toHaveClass('pf-m-green');
    await userEvent.hover(label);
    expect(await screen.findByText('Health could not be determined because the availability status is missing or inconclusive.')).toBeInTheDocument();
  });

  it('renders nothing when health status is omitted', () => {
    const { container } = render(<ClusterHealthIndicator />);
    expect(container).toBeEmptyDOMElement();
  });
});
