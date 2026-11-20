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

  describe('filtering and pagination', () => {
    it('filters files by access', async () => {
      const user = userEvent.setup();
      const files = [
        makeFile({ fileId: 'yaml-public', fileName: 'public.yaml', availableToAll: true }),
        makeFile({ fileId: 'json-private', fileName: 'private.json', availableToAll: false }),
        makeFile({ fileId: 'yaml-private', fileName: 'private.yaml', availableToAll: false }),
      ];

      render(
        <FilesTable
          {...defaultProps}
          files={files}
          isAdmin={true}
          userGroups={[]}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Filter by access' }));
      await user.click(screen.getByRole('checkbox', { name: 'Public' }));

      expect(screen.getByText('public.yaml')).toBeInTheDocument();
      expect(screen.queryByText('private.json')).not.toBeInTheDocument();
      expect(screen.queryByText('private.yaml')).not.toBeInTheDocument();
    });

    it('filters files by group name', async () => {
      const user = userEvent.setup();
      const files = [
        makeFile({ fileId: 'team-a-file', fileName: 'team-a.yaml', groups: ['team-a'], availableToAll: false }),
        makeFile({ fileId: 'team-b-file', fileName: 'team-b.yaml', groups: ['team-b'], availableToAll: false }),
      ];

      render(
        <FilesTable
          {...defaultProps}
          files={files}
          isAdmin={true}
          userGroups={[]}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Filter by access' }));
      await user.click(screen.getByRole('checkbox', { name: 'team-a' }));

      expect(screen.getByText('team-a.yaml')).toBeInTheDocument();
      expect(screen.queryByText('team-b.yaml')).not.toBeInTheDocument();
    });

    it('shows pagination when more than 25 files are available', () => {
      const files = Array.from({ length: 26 }, (_, index) =>
        makeFile({ fileId: `file-${index + 1}`, fileName: `file-${index + 1}.yaml`, availableToAll: true }),
      );

      render(
        <FilesTable
          {...defaultProps}
          files={files}
          isAdmin={true}
          userGroups={[]}
        />,
      );

      expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
      expect(screen.getByText('file-1.yaml')).toBeInTheDocument();
      expect(screen.queryByText('file-26.yaml')).not.toBeInTheDocument();
    });
  });
});

describe('FilesTable categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const files: FileInfo[] = [
    makeFile({ fileId: 'alerts-1', fileName: 'alerts.yaml', description: 'Custom alert rules', availableToAll: true, categories: ['alerts'] }),
    makeFile({ fileId: 'metrics-1', fileName: 'metrics.yaml', availableToAll: true, categories: ['cluster-reliability'] }),
    makeFile({ fileId: 'plain-1', fileName: 'plain.yaml', availableToAll: true }),
  ];

  const categoryDefinitions = [
    { name: 'alerts', color: '#d40078', availableToAll: true },
    { name: 'cluster-reliability', color: '#ff9900', availableToAll: true },
  ];

  function renderTable() {
    render(
      <FilesTable {...defaultProps} files={files} categories={categoryDefinitions} isAdmin={true} userGroups={[]} />,
    );
  }

  it('marks rows with the category color stripe', () => {
    renderTable();

    expect(screen.getByRole('group', { name: 'Categories: alerts' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Categories: cluster-reliability' })).toBeInTheDocument();
    // The file without categories gets no marker.
    const stripes = screen.getAllByTestId('category-stripe-visual');
    expect(stripes).toHaveLength(2);
    // jsdom normalizes the configured hex color to rgb().
    expect(stripes[0].style.backgroundImage).toContain('rgb(212, 0, 120)');
  });

  it('renders the file description as its own column', () => {
    renderTable();

    expect(screen.getByRole('columnheader', { name: 'Description' })).toBeInTheDocument();
    expect(screen.getByText('Custom alert rules')).toBeInTheDocument();
  });

  it('does not render a separate category column; the stripe carries the categories', () => {
    renderTable();

    expect(screen.queryByRole('columnheader', { name: 'Categories' })).not.toBeInTheDocument();
  });

  it('filters files by category', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole('button', { name: 'Filter by category' }));
    await user.click(screen.getByRole('checkbox', { name: 'alerts' }));

    expect(screen.getByText('alerts.yaml')).toBeInTheDocument();
    expect(screen.queryByText('metrics.yaml')).not.toBeInTheDocument();
    expect(screen.queryByText('plain.yaml')).not.toBeInTheDocument();
  });

  it('matches category names in the search box', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.type(screen.getByPlaceholderText('Search files...'), 'cluster-reliability');

    expect(screen.getByText('metrics.yaml')).toBeInTheDocument();
    expect(screen.queryByText('alerts.yaml')).not.toBeInTheDocument();
  });

  it('hides the category filter when the operator does not support categories', () => {
    render(
      <FilesTable
        {...defaultProps}
        files={files}
        categories={categoryDefinitions}
        categoriesSupported={false}
        isAdmin={true}
        userGroups={[]}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Filter by category' })).not.toBeInTheDocument();
  });

  it('drops category names that have no visible definition', async () => {
    const user = userEvent.setup();
    render(
      <FilesTable
        {...defaultProps}
        files={[
          makeFile({
            fileId: 'mixed-1',
            fileName: 'mixed.yaml',
            availableToAll: true,
            categories: ['alerts', 'group-only'],
          }),
        ]}
        categories={[{ name: 'alerts', color: '#d40078', availableToAll: true }]}
        isAdmin={true}
        userGroups={[]}
      />,
    );

    expect(screen.getByRole('group', { name: 'Categories: alerts' })).toBeInTheDocument();
    expect(screen.queryByText('group-only')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /group-only/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filter by category' }));
    expect(screen.queryByRole('checkbox', { name: 'group-only' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'alerts' })).toBeInTheDocument();
  });

  it('does not match hidden category names in search', async () => {
    const user = userEvent.setup();
    render(
      <FilesTable
        {...defaultProps}
        files={[
          makeFile({
            fileId: 'mixed-1',
            fileName: 'mixed.yaml',
            availableToAll: true,
            categories: ['alerts', 'group-only'],
          }),
        ]}
        categories={[{ name: 'alerts', color: '#d40078', availableToAll: true }]}
        isAdmin={true}
        userGroups={[]}
      />,
    );

    await user.type(screen.getByPlaceholderText('Search files...'), 'group-only');

    expect(screen.queryByText('mixed.yaml')).not.toBeInTheDocument();
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });
});
