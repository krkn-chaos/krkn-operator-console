import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StudioNode } from './StudioNode';
import type { StudioNode as StudioNodeType } from '../../types/api';

vi.mock('reactflow', () => ({
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
}));

function makeNode(weight?: number): StudioNodeType {
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

describe('StudioNode resiliency weight', () => {
  const renderNode = (node: StudioNodeType) => {
    const props = {
      id: node.nodeId,
      type: 'default',
      data: { node },
      selected: false,
      zIndex: 0,
      isConnectable: true,
      xPos: 0,
      yPos: 0,
      dragging: false,
    } as Parameters<typeof StudioNode>[0];

    return render(<StudioNode {...props} />);
  };

  it('renders a saved weight', () => {
    renderNode(makeNode(2.5));

    expect(screen.getByText('Weight: 2.5')).toBeInTheDocument();
  });

  it('renders the default weight for a legacy node', () => {
    renderNode(makeNode());

    expect(screen.getByText('Weight: 1')).toBeInTheDocument();
  });
});
