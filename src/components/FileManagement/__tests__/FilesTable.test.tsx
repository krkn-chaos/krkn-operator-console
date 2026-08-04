import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { FilesTable } from '../FilesTable';
import type { FileInfo } from '../../../types/api';

/**
 * Helper to build a FileInfo object with sensible defaults.
 */
function makeFile(overrides: Partial<FileInfo> & Pick<FileInfo, 'fileId' | 'fileName'>): FileInfo {
  return {
    availableToAll: false,
    ...overrides,
  };
}

const defaultProps = {
  fileTypes: [{ name: 'yaml', color: '#3498db' }],
  onCreateClick: vi.fn(),
  onEditClick: vi.fn(),
  onDeleteClick: vi.fn(),
  onRefresh: vi.fn(),
};

describe('FilesTable permission-based edit/delete buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Admin user -- edit/delete buttons enabled for ALL files
  // --------------------------------------------------------------------------
  describe('admin user', () => {
    const files: FileInfo[] = [
      makeFile({ fileId: 'pub-1', fileName: 'public.yaml', availableToAll: true }),
      makeFile({ fileId: 'own-1', fileName: 'own-group.yaml', groups: ['team-a'] }),
      makeFile({ fileId: 'other-1', fileName: 'other-group.yaml', groups: ['team-b'] }),
    ];

    it('enables edit and delete buttons for all files', () => {
      render(
        <FilesTable
          {...defaultProps}
          files={files}
          isAdmin={true}
          userGroups={['team-a']}
        />,
      );

      const editButtons = screen.getAllByLabelText('Edit file');
      const deleteButtons = screen.getAllByLabelText('Delete file');

      expect(editButtons).toHaveLength(3);
      expect(deleteButtons).toHaveLength(3);

      editButtons.forEach((btn) => expect(btn).toBeEnabled());
      deleteButtons.forEach((btn) => expect(btn).toBeEnabled());
    });
  });

  // --------------------------------------------------------------------------
  // 2. Regular user + public file -- edit/delete enabled
  // --------------------------------------------------------------------------
  describe('regular user with public file', () => {
    const files: FileInfo[] = [
      makeFile({ fileId: 'pub-1', fileName: 'public.yaml', availableToAll: true }),
    ];

    it('enables edit and delete buttons', () => {
      render(
        <FilesTable
          {...defaultProps}
          files={files}
          isAdmin={false}
          userGroups={['team-a']}
        />,
      );

      const editBtn = screen.getByLabelText('Edit file');
      const deleteBtn = screen.getByLabelText('Delete file');

      expect(editBtn).toBeEnabled();
      expect(deleteBtn).toBeEnabled();
    });
  });

  // --------------------------------------------------------------------------
  // 3. Regular user + own group file -- edit/delete enabled
  // --------------------------------------------------------------------------
  describe('regular user with own group file', () => {
    const files: FileInfo[] = [
      makeFile({ fileId: 'own-1', fileName: 'own-group.yaml', groups: ['team-a'] }),
    ];

    it('enables edit and delete buttons', () => {
      render(
        <FilesTable
          {...defaultProps}
          files={files}
          isAdmin={false}
          userGroups={['team-a']}
        />,
      );

      const editBtn = screen.getByLabelText('Edit file');
      const deleteBtn = screen.getByLabelText('Delete file');

      expect(editBtn).toBeEnabled();
      expect(deleteBtn).toBeEnabled();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Regular user + other group file -- edit/delete DISABLED
  // --------------------------------------------------------------------------
  describe('regular user with other group file', () => {
    const files: FileInfo[] = [
      makeFile({ fileId: 'other-1', fileName: 'other-group.yaml', groups: ['team-b'] }),
    ];

    it('disables edit and delete buttons', () => {
      render(
        <FilesTable
          {...defaultProps}
          files={files}
          isAdmin={false}
          userGroups={['team-a']}
        />,
      );

      const editBtn = screen.getByLabelText('Edit file');
      const deleteBtn = screen.getByLabelText('Delete file');

      expect(editBtn).toBeDisabled();
      expect(deleteBtn).toBeDisabled();
    });
  });

  // --------------------------------------------------------------------------
  // 5. Disabled button does not call onClick handler when clicked
  // --------------------------------------------------------------------------
  describe('disabled buttons do not fire callbacks', () => {
    const files: FileInfo[] = [
      makeFile({ fileId: 'other-1', fileName: 'other-group.yaml', groups: ['team-b'] }),
    ];

    it('does not call onEditClick or onDeleteClick when buttons are disabled', async () => {
      const user = userEvent.setup();
      const onEditClick = vi.fn();
      const onDeleteClick = vi.fn();

      render(
        <FilesTable
          {...defaultProps}
          files={files}
          isAdmin={false}
          userGroups={['team-a']}
          onEditClick={onEditClick}
          onDeleteClick={onDeleteClick}
        />,
      );

      const editBtn = screen.getByLabelText('Edit file');
      const deleteBtn = screen.getByLabelText('Delete file');

      // Attempt to click disabled buttons
      await user.click(editBtn);
      await user.click(deleteBtn);

      expect(onEditClick).not.toHaveBeenCalled();
      expect(onDeleteClick).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 6. Regular user + file with no groups and not public -- buttons disabled
  // --------------------------------------------------------------------------
  describe('regular user with file that has no groups and is not public', () => {
    const files: FileInfo[] = [
      makeFile({ fileId: 'orphan-1', fileName: 'orphan.yaml', availableToAll: false, groups: [] }),
    ];

    it('disables edit and delete buttons', () => {
      render(
        <FilesTable
          {...defaultProps}
          files={files}
          isAdmin={false}
          userGroups={['team-a']}
        />,
      );

      const editBtn = screen.getByLabelText('Edit file');
      const deleteBtn = screen.getByLabelText('Delete file');

      expect(editBtn).toBeDisabled();
      expect(deleteBtn).toBeDisabled();
    });
  });

  // --------------------------------------------------------------------------
  // Non-admin user with empty userGroups (groups not loaded) — backend enforces
  // --------------------------------------------------------------------------
  describe('non-admin user with empty userGroups defaults to enabled', () => {
    const files: FileInfo[] = [
      makeFile({ fileId: 'priv-1', fileName: 'private.yaml', availableToAll: false, groups: ['team-b'] }),
    ];

    it('enables edit and delete buttons when userGroups is empty', () => {
      render(
        <FilesTable
          {...defaultProps}
          files={files}
          isAdmin={false}
          userGroups={[]}
        />,
      );

      const editBtn = screen.getByLabelText('Edit file');
      const deleteBtn = screen.getByLabelText('Delete file');

      expect(editBtn).toBeEnabled();
      expect(deleteBtn).toBeEnabled();
    });
  });

  // --------------------------------------------------------------------------
  // Additional edge case: file with no groups property at all (undefined)
  // --------------------------------------------------------------------------
  describe('regular user with file where groups is undefined', () => {
    const files: FileInfo[] = [
      makeFile({ fileId: 'no-groups-1', fileName: 'no-groups.yaml', availableToAll: false }),
    ];

    it('disables edit and delete buttons', () => {
      render(
        <FilesTable
          {...defaultProps}
          files={files}
          isAdmin={false}
          userGroups={['team-a']}
        />,
      );

      const editBtn = screen.getByLabelText('Edit file');
      const deleteBtn = screen.getByLabelText('Delete file');

      expect(editBtn).toBeDisabled();
      expect(deleteBtn).toBeDisabled();
    });
  });
});
