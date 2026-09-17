import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudCredentialsCard, filterCloudCredentials } from './CloudCredentialsCard';
import { cloudCredentialsApi } from '../services/cloudCredentialsApi';
import { operatorApi } from '../services/operatorApi';
import { useNotifications } from '../hooks';
import type { CloudCredential } from '../types/api';

vi.mock('../services/cloudCredentialsApi');
vi.mock('../services/operatorApi');
vi.mock('../hooks', () => ({
  useNotifications: vi.fn(),
}));

const mockCredentials: CloudCredential[] = [
  {
    name: 'aws-dummy',
    provider: 'aws',
    description: 'aws test key',
    availableToAll: true,
    createdAt: '2026-08-20T15:16:00Z',
    createdBy: 'admin@local.dev',
  },
  {
    name: 'azure-dummy',
    provider: 'azure',
    description: 'azure-test',
    availableToAll: false,
    groups: ['chaos-team'],
    createdAt: '2026-08-20T15:20:00Z',
    createdBy: 'admin@local.dev',
  },
];

describe('CloudCredentialsCard', () => {
  const mockShowSuccess = vi.fn();
  const mockShowError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useNotifications).mockReturnValue({
      showNotification: vi.fn(),
      showSuccess: mockShowSuccess,
      showError: mockShowError,
      showInfo: vi.fn(),
      showWarning: vi.fn(),
      hideNotification: vi.fn(),
    });

    vi.mocked(operatorApi.getGroups).mockResolvedValue({ groups: [] });
    vi.mocked(cloudCredentialsApi.listCredentials).mockResolvedValue(mockCredentials);
  });

  describe('rendering', () => {
    it('renders each credential in a compact list with provider, access, and actions', async () => {
      render(<CloudCredentialsCard />);

      expect(await screen.findByText('aws-dummy')).toBeInTheDocument();
      expect(screen.getByText('azure-dummy')).toBeInTheDocument();
      expect(screen.getAllByText('AWS').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Azure').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('aws test key')).toBeInTheDocument();
      expect(screen.getAllByText('All Users').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('chaos-team')).toBeInTheDocument();
      expect(screen.getByRole('grid', { name: 'Cloud credentials' })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2);
    });

    it('shows an empty state when there are no credentials', async () => {
      vi.mocked(cloudCredentialsApi.listCredentials).mockResolvedValue([]);

      render(<CloudCredentialsCard />);

      expect(await screen.findByText('No Cloud Credentials')).toBeInTheDocument();
      expect(
        screen.getByText('Add cloud provider credentials to enable node, zone, and power outage scenarios.')
      ).toBeInTheDocument();
    });
  });

  describe('filtering', () => {
    it('filters credentials by provider', async () => {
      const user = userEvent.setup();
      render(<CloudCredentialsCard />);

      await screen.findByText('aws-dummy');
      await user.selectOptions(screen.getByLabelText('Filter by cloud provider'), 'azure');

      expect(screen.queryByText('aws-dummy')).not.toBeInTheDocument();
      expect(screen.getByText('azure-dummy')).toBeInTheDocument();
    });

    it('filters credentials by name search', async () => {
      const user = userEvent.setup();
      render(<CloudCredentialsCard />);

      await screen.findByText('aws-dummy');
      await user.type(screen.getByLabelText('Filter cloud credentials by name'), 'azure-dummy');

      expect(screen.queryByText('aws-dummy')).not.toBeInTheDocument();
      expect(screen.getByText('azure-dummy')).toBeInTheDocument();
    });

    it('shows empty state when filters match nothing', async () => {
      const user = userEvent.setup();
      render(<CloudCredentialsCard />);

      await user.type(await screen.findByLabelText('Filter cloud credentials by name'), 'does-not-exist');
      expect(await screen.findByText('No Matching Credentials')).toBeInTheDocument();
    });
  });

  describe('filterCloudCredentials helper', () => {
    it('sorts and filters credentials by provider', () => {
      const result = filterCloudCredentials(mockCredentials, {
        search: '',
        provider: 'aws',
        access: 'all',
        sortDirection: 'asc',
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('aws-dummy');
    });

    it('filters credentials by public access', () => {
      const result = filterCloudCredentials(mockCredentials, {
        search: '',
        provider: 'all',
        access: 'public',
        sortDirection: 'asc',
      });
      expect(result.map((c) => c.name)).toEqual(['aws-dummy']);
    });
  });

  describe('user interactions', () => {
    it('opens the edit modal for the selected credential', async () => {
      const user = userEvent.setup();
      render(<CloudCredentialsCard />);

      const editButtons = await screen.findAllByRole('button', { name: 'Edit' });
      await user.click(editButtons[0]);

      expect(await screen.findByText('Edit Cloud Credential: aws-dummy')).toBeInTheDocument();
    });

    it('opens the delete confirmation for the selected credential', async () => {
      const user = userEvent.setup();
      render(<CloudCredentialsCard />);

      const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' });
      await user.click(deleteButtons[1]);

      expect(await screen.findByText('Delete Cloud Credential')).toBeInTheDocument();
      expect(screen.getByText('azure-dummy', { selector: 'strong' })).toBeInTheDocument();
    });

    it('keeps GCP selected in create modal after editing description', async () => {
      const user = userEvent.setup();
      render(<CloudCredentialsCard />);

      await user.click(await screen.findByRole('button', { name: 'Add Credential' }));
      const providerSelect = await screen.findByLabelText('Provider');
      await user.selectOptions(providerSelect, 'gcp');
      expect(providerSelect).toHaveValue('gcp');
      expect(await screen.findByLabelText(/Service Account JSON/i)).toBeInTheDocument();

      await user.type(screen.getByLabelText('Description'), 'test gcp cred');
      expect(providerSelect).toHaveValue('gcp');
      expect(screen.getByLabelText(/Service Account JSON/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Access Key ID/i)).not.toBeInTheDocument();
    });
  });
});
