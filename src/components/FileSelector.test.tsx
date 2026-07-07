/**
 * FileSelector.test.tsx - Tests for FileSelector component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileSelector } from './FileSelector';
import { operatorApi } from '../services/operatorApi';
import type { FileReference, AvailableFilesResponse } from '../types/api';

// Mock operatorApi
vi.mock('../services/operatorApi');

const mockAvailableFiles: AvailableFilesResponse = {
  files: [
    {
      fileId: 'file-1',
      fileName: 'config.yaml',
      description: 'Main config file',
      fileType: 'config',
      availableToAll: true,
    },
    {
      fileId: 'file-2',
      fileName: 'secrets.env',
      description: 'Environment secrets',
      fileType: 'env',
      availableToAll: false,
      groups: ['admin'],
    },
  ],
};

describe('FileSelector', () => {
  const mockOnChange = vi.fn();
  const mockOnPendingChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(operatorApi.getAvailableFiles).mockResolvedValue(mockAvailableFiles);
  });

  it('renders without crashing', async () => {
    render(
      <FileSelector
        value={[]}
        onChange={mockOnChange}
        onPendingChange={mockOnPendingChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/select a file/i)).toBeInTheDocument();
    });
  });

  it('loads available files on mount', async () => {
    render(
      <FileSelector
        value={[]}
        onChange={mockOnChange}
        onPendingChange={mockOnPendingChange}
      />
    );

    await waitFor(() => {
      expect(operatorApi.getAvailableFiles).toHaveBeenCalledTimes(1);
    });
  });

  it('shows "No files available" when there are no files', async () => {
    (operatorApi.getAvailableFiles as vi.Mock).mockResolvedValue({ files: [] });

    render(
      <FileSelector
        value={[]}
        onChange={mockOnChange}
        onPendingChange={mockOnPendingChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/no files available/i)).toBeInTheDocument();
    });
  });

  it('displays selected files', () => {
    const selectedFiles: FileReference[] = [
      { fileId: 'file-1', mountPath: '/etc/config.yaml' },
    ];

    render(
      <FileSelector
        value={selectedFiles}
        onChange={mockOnChange}
        onPendingChange={mockOnPendingChange}
      />
    );

    expect(screen.getByText(/config\.yaml → \/etc\/config\.yaml/i)).toBeInTheDocument();
  });

  it('calls onPendingChange when file is selected', async () => {
    render(
      <FileSelector
        value={[]}
        onChange={mockOnChange}
        onPendingChange={mockOnPendingChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/select a file/i)).toBeInTheDocument();
    });

    // Open dropdown
    const dropdown = screen.getByText(/select a file/i);
    fireEvent.click(dropdown);

    // Select a file
    await waitFor(() => {
      const option = screen.getByText('config.yaml');
      fireEvent.click(option);
    });

    // Should notify pending change
    await waitFor(() => {
      expect(mockOnPendingChange).toHaveBeenCalledWith(true);
    });
  });

  it('validates mount path (must start with /)', async () => {
    render(
      <FileSelector
        value={[]}
        onChange={mockOnChange}
        onPendingChange={mockOnPendingChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/select a file/i)).toBeInTheDocument();
    });

    // Open dropdown and select file
    const dropdown = screen.getByText(/select a file/i);
    fireEvent.click(dropdown);

    await waitFor(() => {
      const option = screen.getByText('config.yaml');
      fireEvent.click(option);
    });

    // Type invalid path (no leading /)
    const pathInput = screen.getByPlaceholderText(/e\.g\., \/etc\/config/i);
    fireEvent.change(pathInput, { target: { value: 'etc/config.yaml' } });

    // Click Add
    const addButton = screen.getByRole('button', { name: /add/i });
    fireEvent.click(addButton);

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/mount path must start with/i)).toBeInTheDocument();
    });

    // onChange should NOT be called
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('adds file reference when valid', async () => {
    render(
      <FileSelector
        value={[]}
        onChange={mockOnChange}
        onPendingChange={mockOnPendingChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/select a file/i)).toBeInTheDocument();
    });

    // Select file
    const dropdown = screen.getByText(/select a file/i);
    fireEvent.click(dropdown);

    await waitFor(() => {
      const option = screen.getByText('config.yaml');
      fireEvent.click(option);
    });

    // Type valid path
    const pathInput = screen.getByPlaceholderText(/e\.g\., \/etc\/config/i);
    fireEvent.change(pathInput, { target: { value: '/etc/config.yaml' } });

    // Click Add
    const addButton = screen.getByRole('button', { name: /add/i });
    fireEvent.click(addButton);

    // Should call onChange with new file reference
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith([
        { fileId: 'file-1', mountPath: '/etc/config.yaml' },
      ]);
    });
  });

  it('removes file reference when remove button clicked', () => {
    const selectedFiles: FileReference[] = [
      { fileId: 'file-1', mountPath: '/etc/config.yaml' },
    ];

    render(
      <FileSelector
        value={selectedFiles}
        onChange={mockOnChange}
        onPendingChange={mockOnPendingChange}
      />
    );

    // Find and click remove button
    const removeButton = screen.getByLabelText(/remove file/i);
    fireEvent.click(removeButton);

    // Should call onChange with empty array
    expect(mockOnChange).toHaveBeenCalledWith([]);
  });

  it('filters out already selected files from dropdown', async () => {
    const selectedFiles: FileReference[] = [
      { fileId: 'file-1', mountPath: '/etc/config.yaml' },
    ];

    render(
      <FileSelector
        value={selectedFiles}
        onChange={mockOnChange}
        onPendingChange={mockOnPendingChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/select a file/i)).toBeInTheDocument();
    });

    // Open dropdown
    const dropdown = screen.getByText(/select a file/i);
    fireEvent.click(dropdown);

    // Should only show file-2 (file-1 already selected)
    await waitFor(() => {
      expect(screen.getByText('secrets.env')).toBeInTheDocument();
      expect(screen.queryByText('config.yaml')).not.toBeInTheDocument();
    });
  });

  it('clears pending state when file is added', async () => {
    render(
      <FileSelector
        value={[]}
        onChange={mockOnChange}
        onPendingChange={mockOnPendingChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/select a file/i)).toBeInTheDocument();
    });

    // Select file
    const dropdown = screen.getByText(/select a file/i);
    fireEvent.click(dropdown);

    await waitFor(() => {
      const option = screen.getByText('config.yaml');
      fireEvent.click(option);
    });

    // Type path
    const pathInput = screen.getByPlaceholderText(/e\.g\., \/etc\/config/i);
    fireEvent.change(pathInput, { target: { value: '/etc/config.yaml' } });

    // Pending should be true now
    expect(mockOnPendingChange).toHaveBeenCalledWith(true);

    // Click Add
    const addButton = screen.getByRole('button', { name: /add/i });
    fireEvent.click(addButton);

    // After add, pending should be false
    await waitFor(() => {
      expect(mockOnPendingChange).toHaveBeenCalledWith(false);
    });
  });

  it('shows loading state while fetching files', () => {
    (operatorApi.getAvailableFiles as vi.Mock).mockReturnValue(
      new Promise(() => {}) // Never resolves
    );

    render(
      <FileSelector
        value={[]}
        onChange={mockOnChange}
        onPendingChange={mockOnPendingChange}
      />
    );

    expect(screen.getByText(/loading files/i)).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    (operatorApi.getAvailableFiles as vi.Mock).mockRejectedValue(
      new Error('API Error')
    );

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(
      <FileSelector
        value={[]}
        onChange={mockOnChange}
        onPendingChange={mockOnPendingChange}
      />
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    // Should show "No files available" after error
    expect(screen.getByText(/no files available/i)).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
