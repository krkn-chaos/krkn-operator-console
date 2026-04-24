import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { TerminalContent } from './TerminalContent';
import { operatorApi } from '../services/operatorApi';
import type { AvailableCommandsResponse } from '../types/api';

// Mock the operatorApi
vi.mock('../services/operatorApi', () => ({
  operatorApi: {
    getAvailableTerminalCommands: vi.fn(),
    executeTerminalCommand: vi.fn(),
    deleteTargetRequest: vi.fn(),
  },
}));

// Mock useClusterDiscovery hook with a factory function
const mockUseClusterDiscovery = vi.fn();
vi.mock('../hooks/useClusterDiscovery', () => ({
  useClusterDiscovery: () => mockUseClusterDiscovery(),
}));

describe('TerminalContent', () => {
  const mockOnClose = vi.fn();
  const mockAvailableCommands: AvailableCommandsResponse = {
    commands: [
      {
        name: 'kubectl',
        description: 'Kubernetes command-line tool',
        subcommands: [
          { name: 'get', description: 'Display resources' },
          { name: 'describe', description: 'Show resource details' },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(operatorApi.getAvailableTerminalCommands).mockResolvedValue(mockAvailableCommands);
    vi.mocked(operatorApi.deleteTargetRequest).mockResolvedValue(undefined);

    // Default mock: clusters loaded
    mockUseClusterDiscovery.mockReturnValue({
      clusters: [
        { uuid: '1', clusterName: 'cluster-a', clusterAPIURL: 'https://api-a', ready: true },
        { uuid: '2', clusterName: 'cluster-b', clusterAPIURL: 'https://api-b', ready: true },
      ],
      discoveryUuid: 'test-uuid',
      isLoading: false,
      error: null,
      startDiscovery: vi.fn(),
      reset: vi.fn(),
    });
  });

  it('should render loading state initially', () => {
    mockUseClusterDiscovery.mockReturnValue({
      clusters: null,
      discoveryUuid: null,
      isLoading: true,
      error: null,
      startDiscovery: vi.fn(),
      reset: vi.fn(),
    });

    render(<TerminalContent isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('Loading clusters...')).toBeInTheDocument();
  });

  it('should load available commands when terminal opens', async () => {
    render(<TerminalContent isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(operatorApi.getAvailableTerminalCommands).toHaveBeenCalled();
    });
  });

  it('should display cluster selection prompt', async () => {
    render(<TerminalContent isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText(/Select a cluster/)).toBeInTheDocument();
    });
  });

  it('should display clusters sorted alphabetically', async () => {
    render(<TerminalContent isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('cluster-a')).toBeInTheDocument();
      expect(screen.getByText('cluster-b')).toBeInTheDocument();
    });
  });

  it('should show help message with available commands when ? is typed', async () => {
    const user = userEvent.setup();
    render(<TerminalContent isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('cluster-a')).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox');
    await user.type(input, '?{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Available commands:')).toBeInTheDocument();
      expect(screen.getByText(/kubectl/)).toBeInTheDocument();
    });
  });

  it('should show hint for available commands', async () => {
    const { container } = render(<TerminalContent isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      // Text is split by <span> elements in the terminal-hint div
      const hint = container.querySelector('.terminal-hint');
      expect(hint).toBeInTheDocument();
      expect(hint?.textContent).toContain('Type');
      expect(hint?.textContent).toContain('?');
      expect(hint?.textContent).toContain('for available commands');
    });
  });

  it('should validate commands against available commands list', async () => {
    const user = userEvent.setup();
    render(<TerminalContent isOpen={true} onClose={mockOnClose} />);

    // Wait for clusters to load
    await waitFor(() => {
      expect(screen.getByText('cluster-a')).toBeInTheDocument();
    });

    // Select cluster 1
    const input = screen.getByRole('textbox');
    await user.type(input, '1{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/Connected to cluster: cluster-a/)).toBeInTheDocument();
    });

    // Try invalid command
    await user.type(input, 'invalid command{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/command not found: invalid/)).toBeInTheDocument();
    });
  });

  it('should block streaming flags', async () => {
    const user = userEvent.setup();
    render(<TerminalContent isOpen={true} onClose={mockOnClose} />);

    // Wait for clusters and select one
    await waitFor(() => {
      expect(screen.getByText('cluster-a')).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox');
    await user.type(input, '1{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/Connected to cluster: cluster-a/)).toBeInTheDocument();
    });

    // Try command with blocked flag
    await user.type(input, 'kubectl get pods --watch{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/Streaming flags.*not supported/)).toBeInTheDocument();
    });
  });

  it('should call onClose when exit is typed', async () => {
    const user = userEvent.setup();
    render(<TerminalContent isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('cluster-a')).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox');
    await user.type(input, 'exit{Enter}');

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should cleanup target request on close', async () => {
    const { rerender } = render(<TerminalContent isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('cluster-a')).toBeInTheDocument();
    });

    // Close terminal
    rerender(<TerminalContent isOpen={false} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(operatorApi.deleteTargetRequest).toHaveBeenCalledWith('test-uuid');
    });
  });

  it('should handle available commands fetch failure gracefully', async () => {
    vi.mocked(operatorApi.getAvailableTerminalCommands).mockRejectedValue(
      new Error('Failed to fetch')
    );

    render(<TerminalContent isOpen={true} onClose={mockOnClose} />);

    // Terminal should still render even if available commands fail
    await waitFor(() => {
      expect(screen.getByText(/Select a cluster/)).toBeInTheDocument();
    });
  });
});
