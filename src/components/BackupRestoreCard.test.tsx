import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BackupRestoreCard } from './BackupRestoreCard';

// Mock the notifications hook
vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

describe('BackupRestoreCard', () => {
  it('should render backup and restore buttons', () => {
    render(<BackupRestoreCard />);

    expect(screen.getByRole('button', { name: /create backup/i })).toBeInTheDocument();
    const restoreButtons = screen.getAllByRole('button', { name: /restore from backup/i });
    expect(restoreButtons.length).toBeGreaterThan(0);
  });

  it('should render card title and description', () => {
    render(<BackupRestoreCard />);

    expect(screen.getByText('Backup & Restore')).toBeInTheDocument();
    expect(screen.getByText(/Create backups of all configuration data/i)).toBeInTheDocument();
  });
});
