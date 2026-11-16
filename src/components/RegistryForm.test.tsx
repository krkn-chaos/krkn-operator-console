import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegistryForm } from './RegistryForm';

const mocks = vi.hoisted(() => ({
  registries: {
    getRegistry: vi.fn(),
    createRegistry: vi.fn(),
    updateRegistry: vi.fn(),
  },
  groups: { listGroups: vi.fn() },
  notifications: { showSuccess: vi.fn(), showError: vi.fn() },
}));

vi.mock('../services/registriesApi', () => ({ registriesApi: mocks.registries }));
vi.mock('../services/groupsApi', () => ({ groupsApi: mocks.groups }));
vi.mock('../hooks', () => ({ useNotifications: () => mocks.notifications }));

describe('RegistryForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.groups.listGroups.mockResolvedValue([]);
    mocks.registries.getRegistry.mockResolvedValue({
      name: 'private-preview',
      registryUrl: 'registry.example.test',
      scenarioRepository: 'krkn/scenarios',
      authType: 'token',
      description: 'Preview',
      skipTls: false,
      insecure: false,
      groups: [],
      availableToAll: true,
      aiOrchestratorTag: 'orchestrator-v1',
      aiResultUploaderTag: 'uploader-v2',
      workloadImageTags: {
        hog: 'hog-v1',
        tools: 'tools-v2',
        synFlood: 'syn-flood-v3',
        networkChaos: 'network-chaos-v4',
      },
    });
    mocks.registries.updateRegistry.mockResolvedValue({ name: 'private-preview', message: 'updated' });
    mocks.registries.createRegistry.mockResolvedValue({ name: 'new-registry', message: 'created' });
  });

  afterEach(() => cleanup());

  it('updates registry settings without changing saved image tag overrides', async () => {
    const user = userEvent.setup();
    render(<RegistryForm registryName="private-preview" onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const description = await screen.findByRole('textbox', { name: 'Description' });
    await user.clear(description);
    await user.type(description, 'Updated registry');
    expect(screen.queryByRole('textbox', { name: /tag$/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Registry' }));

    await waitFor(() => expect(mocks.registries.updateRegistry).toHaveBeenCalledTimes(1));
    expect(mocks.registries.updateRegistry).toHaveBeenCalledWith('private-preview', {
      registryUrl: 'registry.example.test',
      scenarioRepository: 'krkn/scenarios',
      authType: 'token',
      description: 'Updated registry',
      skipTls: false,
      insecure: false,
      groups: [],
      availableToAll: true,
    });
  });

  it('creates a registry using the standard image tags without additional settings', async () => {
    const user = userEvent.setup();
    render(<RegistryForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByRole('textbox', { name: 'Registry Name' });
    await user.type(screen.getByRole('textbox', { name: 'Registry Name' }), 'team-registry');
    await user.type(screen.getByRole('textbox', { name: 'Registry URL' }), 'registry.example.test');
    await user.type(screen.getByRole('textbox', { name: 'Scenario Repository' }), 'team/chaos');
    await user.type(screen.getByRole('textbox', { name: 'Username' }), 'preview-user');
    await user.type(screen.getByLabelText(/^Token/), 'preview-token');
    await user.click(screen.getByRole('checkbox', { name: 'Available to All Users' }));
    expect(screen.queryByRole('textbox', { name: /tag$/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create Registry' }));

    await waitFor(() => expect(mocks.registries.createRegistry).toHaveBeenCalledTimes(1));
    expect(mocks.registries.createRegistry).toHaveBeenCalledWith({
      name: 'team-registry',
      registryUrl: 'registry.example.test',
      scenarioRepository: 'team/chaos',
      authType: 'token',
      username: 'preview-user',
      password: 'preview-token',
      description: undefined,
      skipTls: false,
      insecure: false,
      groups: [],
      availableToAll: true,
    });
  });
});
