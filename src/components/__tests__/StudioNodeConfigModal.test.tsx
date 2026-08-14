import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StudioNodeConfigModal } from '../Studio/StudioNodeConfigModal';
import type { StudioNode } from '../../types/api';

const makeNode = (overrides?: Partial<StudioNode>): StudioNode => ({
  nodeId: 'test-node',
  status: 'configured',
  position: { x: 0, y: 0 },
  config: {
    registryType: 'public',
    registryConfig: {},
    scenarioName: 'pod-scenarios',
    scenarioImage: 'quay.io/krkn-chaos/krkn-hub:pod-scenarios',
    scenarioFormValues: {
      NAMESPACE: 'default',
      DURATION: '60',
      LABEL_SELECTOR: 'app=test',
    },
    globalFormValues: {
      ITERATIONS: '3',
      DAEMON_MODE: 'false',
      UNTOUCHED: 'should-not-show',
    },
    globalTouchedFields: {
      ITERATIONS: true,
      DAEMON_MODE: true,
      UNTOUCHED: false,
    },
    volumes: {
      '/data': 'my-pvc',
    },
  },
  ...overrides,
});

describe('StudioNodeConfigModal', () => {
  const onClose = vi.fn();

  it('renders nothing when node is null', () => {
    const { container } = render(<StudioNodeConfigModal node={null} onClose={onClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when node has no config', () => {
    const { container } = render(
      <StudioNodeConfigModal node={{ nodeId: 'x', status: 'unconfigured', position: { x: 0, y: 0 } }} onClose={onClose} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders scenario info', () => {
    render(<StudioNodeConfigModal node={makeNode()} onClose={onClose} />);

    expect(screen.getByText('pod-scenarios')).toBeInTheDocument();
    expect(screen.getByText('quay.io/krkn-chaos/krkn-hub:pod-scenarios')).toBeInTheDocument();
    expect(screen.getByText('public')).toBeInTheDocument();
  });

  it('renders scenario parameters', () => {
    render(<StudioNodeConfigModal node={makeNode()} onClose={onClose} />);

    expect(screen.getByText('NAMESPACE:')).toBeInTheDocument();
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('DURATION:')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('renders only touched global parameters', () => {
    render(<StudioNodeConfigModal node={makeNode()} onClose={onClose} />);

    expect(screen.getByText('ITERATIONS:')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('DAEMON_MODE:')).toBeInTheDocument();
    expect(screen.queryByText('UNTOUCHED:')).not.toBeInTheDocument();
  });

  it('renders volumes', () => {
    render(<StudioNodeConfigModal node={makeNode()} onClose={onClose} />);

    expect(screen.getByText('/data:')).toBeInTheDocument();
    expect(screen.getByText('my-pvc')).toBeInTheDocument();
  });

  it('masks sensitive values', () => {
    const node = makeNode();
    node.config!.scenarioFormValues = {
      DB_PASSWORD: 'supersecret',
      NORMAL_VAR: 'visible',
    };
    render(<StudioNodeConfigModal node={node} onClose={onClose} />);

    expect(screen.queryByText('supersecret')).not.toBeInTheDocument();
    expect(screen.getByText('********')).toBeInTheDocument();
    expect(screen.getByText('visible')).toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', () => {
    render(<StudioNodeConfigModal node={makeNode()} onClose={onClose} />);

    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });
});
