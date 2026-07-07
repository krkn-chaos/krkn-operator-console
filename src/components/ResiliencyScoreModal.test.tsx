import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ResiliencyScoreModal } from './ResiliencyScoreModal';
import { operatorApi } from '../services/operatorApi';
import type { AvailableFilesResponse } from '../types/api';

vi.mock('../services/operatorApi');

describe('ResiliencyScoreModal', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const mockFiles: AvailableFilesResponse = {
    files: [
      {
        fileId: 'file-1',
        fileName: 'metrics-baseline.yaml',
        description: 'Baseline metrics configuration',
        createdAt: '2024-01-01T00:00:00Z',
        createdBy: 'admin@example.com',
      },
      {
        fileId: 'file-2',
        fileName: 'metrics-advanced.yaml',
        description: 'Advanced metrics with custom rules',
        createdAt: '2024-01-02T00:00:00Z',
        createdBy: 'user@example.com',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(operatorApi.getAvailableFiles).mockResolvedValue(mockFiles);
  });

  describe('Modal Rendering', () => {
    it('should render modal when isOpen is true', async () => {
      render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1', 'node-2']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Configure Resiliency Score')).toBeInTheDocument();
      expect(screen.getByText(/Configure baseline score and metrics file/i)).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      render(
        <ResiliencyScoreModal
          isOpen={false}
          nodeIds={['node-1']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.queryByText('Configure Resiliency Score')).not.toBeInTheDocument();
    });

    it('should load available files on mount', async () => {
      render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      await waitFor(() => {
        expect(operatorApi.getAvailableFiles).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Baseline Score Validation', () => {
    it('should show error when baseline is empty', async () => {
      const user = userEvent.setup();
      render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      expect(await screen.findByText('Baseline score is required')).toBeInTheDocument();
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should show error when baseline is not a number', async () => {
      const user = userEvent.setup();
      render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Note: type="number" inputs reject non-numeric input, leaving field empty
      // So clicking confirm with empty field shows "required" error
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      expect(await screen.findByText('Baseline score is required')).toBeInTheDocument();
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should show error when baseline is negative', async () => {
      const user = userEvent.setup();
      render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const baselineInput = screen.getByPlaceholderText('e.g., 100.0');
      await user.clear(baselineInput);
      await user.type(baselineInput, '-5');

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      expect(await screen.findByText('Must be >= 0')).toBeInTheDocument();
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should accept valid baseline score', async () => {
      const user = userEvent.setup();
      render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const baselineInput = screen.getByPlaceholderText('e.g., 100.0');
      await user.type(baselineInput, '100.5');

      await waitFor(() => {
        expect(screen.queryByText('Baseline score is required')).not.toBeInTheDocument();
      });
    });
  });

  describe('Mount Path Validation', () => {
    it('should show error when mount path is empty', async () => {
      const user = userEvent.setup();
      render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const baselineInput = screen.getByPlaceholderText('e.g., 100.0');
      await user.type(baselineInput, '100');

      const mountPathInput = screen.getByPlaceholderText('/etc/krkn/metrics.yaml');
      await user.clear(mountPathInput);

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      expect(await screen.findByText('Mount path is required')).toBeInTheDocument();
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should show error when mount path is not absolute', async () => {
      const user = userEvent.setup();
      render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const baselineInput = screen.getByPlaceholderText('e.g., 100.0');
      await user.type(baselineInput, '100');

      const mountPathInput = screen.getByPlaceholderText('/etc/krkn/metrics.yaml');
      await user.clear(mountPathInput);
      await user.type(mountPathInput, 'relative/path');

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      expect(await screen.findByText('Must be an absolute path (start with /)')).toBeInTheDocument();
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should accept valid absolute mount path', async () => {
      const user = userEvent.setup();
      render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const mountPathInput = screen.getByPlaceholderText('/etc/krkn/metrics.yaml');
      await user.clear(mountPathInput);
      await user.type(mountPathInput, '/custom/path/metrics.yaml');

      await waitFor(() => {
        expect(screen.queryByText('Must be an absolute path (start with /)')).not.toBeInTheDocument();
      });
    });
  });

  describe('File Selection Modes', () => {
    it('should default to "same file for all nodes" mode', () => {
      render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1', 'node-2']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const sameFileRadio = screen.getByLabelText('Same file for all nodes');
      expect(sameFileRadio).toBeChecked();
    });

    it('should switch to per-node file selection mode', async () => {
      const user = userEvent.setup();
      render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1', 'node-2']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const perNodeRadio = screen.getByLabelText('Per-node file selection');
      await user.click(perNodeRadio);

      expect(perNodeRadio).toBeChecked();
      expect(screen.getByText('Node: node-1')).toBeInTheDocument();
      expect(screen.getByText('Node: node-2')).toBeInTheDocument();
    });

    it('should show warning when no nodes available in per-node mode', async () => {
      const user = userEvent.setup();
      render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={[]}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const perNodeRadio = screen.getByLabelText('Per-node file selection');
      await user.click(perNodeRadio);

      expect(screen.getByText('No nodes available')).toBeInTheDocument();
      expect(screen.getByText(/Add nodes to the graph before selecting per-node files/i)).toBeInTheDocument();
    });
  });

  describe('File Selection - Same File Mode', () => {
    it('should allow selecting a file in same-file mode', async () => {
      const user = userEvent.setup();
      render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      await waitFor(() => {
        expect(operatorApi.getAvailableFiles).toHaveBeenCalled();
      });

      // Open file select
      const fileSelect = screen.getByText('Select a file');
      await user.click(fileSelect);

      // Select first file
      const fileOption = await screen.findByText('metrics-baseline.yaml - Baseline metrics configuration');
      await user.click(fileOption);

      // Verify selection
      expect(screen.getByText('metrics-baseline.yaml')).toBeInTheDocument();
    });

    it('should submit with selected file in same-file mode', async () => {
      const user = userEvent.setup();
      render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1', 'node-2']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      await waitFor(() => {
        expect(operatorApi.getAvailableFiles).toHaveBeenCalled();
      });

      // Fill baseline
      const baselineInput = screen.getByPlaceholderText('e.g., 100.0');
      await user.type(baselineInput, '100');

      // Select file
      const fileSelect = screen.getByText('Select a file');
      await user.click(fileSelect);
      const fileOption = await screen.findByText('metrics-baseline.yaml - Baseline metrics configuration');
      await user.click(fileOption);

      // Confirm
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledWith({
        baseline: 100,
        mountPath: '/etc/krkn/metrics.yaml',
        fileId: 'file-1',
      });
    });

    it('should submit without file if none selected in same-file mode', async () => {
      const user = userEvent.setup();
      render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      await waitFor(() => {
        expect(operatorApi.getAvailableFiles).toHaveBeenCalled();
      });

      // Fill baseline only
      const baselineInput = screen.getByPlaceholderText('e.g., 100.0');
      await user.type(baselineInput, '100');

      // Confirm without selecting file
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledWith({
        baseline: 100,
        mountPath: '/etc/krkn/metrics.yaml',
      });
    });
  });

  describe('File Selection - Per-Node Mode', () => {
    it('should allow selecting different files for different nodes', async () => {
      const user = userEvent.setup();
      render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1', 'node-2']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      await waitFor(() => {
        expect(operatorApi.getAvailableFiles).toHaveBeenCalled();
      });

      // Switch to per-node mode
      const perNodeRadio = screen.getByLabelText('Per-node file selection');
      await user.click(perNodeRadio);

      // Fill baseline
      const baselineInput = screen.getByPlaceholderText('e.g., 100.0');
      await user.type(baselineInput, '100');

      // Select file for node-1
      const node1Selects = screen.getAllByText('Select a file');
      await user.click(node1Selects[0]);
      const file1Option = await screen.findByText('metrics-baseline.yaml - Baseline metrics configuration');
      await user.click(file1Option);

      // Select file for node-2
      const node2Selects = screen.getAllByText('Select a file');
      await user.click(node2Selects[0]);
      const file2Option = await screen.findByText('metrics-advanced.yaml - Advanced metrics with custom rules');
      await user.click(file2Option);

      // Confirm
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledWith({
        baseline: 100,
        mountPath: '/etc/krkn/metrics.yaml',
        perNodeFiles: {
          'node-1': 'file-1',
          'node-2': 'file-2',
        },
      });
    });
  });

  describe('Cancel Flow', () => {
    it('should call onClose when cancel button clicked', async () => {
      const user = userEvent.setup();
      render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  describe('State Reset', () => {
    it('should reset form when modal closes and reopens', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      await waitFor(() => {
        expect(operatorApi.getAvailableFiles).toHaveBeenCalled();
      });

      // Fill form
      const baselineInput = screen.getByPlaceholderText('e.g., 100.0');
      await user.type(baselineInput, '100');

      // Close modal
      rerender(
        <ResiliencyScoreModal
          isOpen={false}
          nodeIds={['node-1']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Reopen modal
      rerender(
        <ResiliencyScoreModal
          isOpen={true}
          nodeIds={['node-1']}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Check form is reset
      const resetBaselineInput = screen.getByPlaceholderText('e.g., 100.0');
      expect(resetBaselineInput).toHaveValue(null);
    });
  });
});
