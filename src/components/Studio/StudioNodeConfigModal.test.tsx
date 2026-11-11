import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StudioNodeConfigModal } from './StudioNodeConfigModal';
import type { StudioNode } from '../../types/api';

function makeNode(weight?: number): StudioNode {
  return {
    nodeId: 'node-one',
    status: 'configured',
    position: { x: 0, y: 0 },
    config: {
      registryType: 'public',
      registryConfig: {},
      scenarioName: 'pod-delete',
      scenarioImage: 'quay.io/example:pod-delete',
      scenarioFormValues: {},
      ...(weight === undefined ? {} : { resiliencyWeight: weight }),
    },
  };
}

describe('StudioNodeConfigModal resiliency weight', () => {
  it('renders a saved weight', () => {
    render(<StudioNodeConfigModal node={makeNode(3.5)} onClose={vi.fn()} />);

    expect(screen.getByText('Resiliency Weight:')).toBeInTheDocument();
    expect(screen.getByText('3.5')).toBeInTheDocument();
  });

  it('renders the default weight for a legacy node', () => {
    render(<StudioNodeConfigModal node={makeNode()} onClose={vi.fn()} />);

    expect(screen.getByText('Resiliency Weight:')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
