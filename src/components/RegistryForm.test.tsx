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

describe('RegistryForm image tag metadata', () => {
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

  it('round-trips runtime and workload tag overrides and sends explicit clears', async () => {
    const user = userEvent.setup();
    render(<RegistryForm registryName="private-preview" onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const orchestrator = await screen.findByRole('textbox', { name: 'krkn-ai operator tag' });
    const uploader = screen.getByRole('textbox', { name: 'krkn-ai service tag' });
    const hog = screen.getByRole('textbox', { name: 'hog workload tag' });
    const tools = screen.getByRole('textbox', { name: 'tools workload tag' });
    const synFlood = screen.getByRole('textbox', { name: 'synFlood workload tag' });
    const networkChaos = screen.getByRole('textbox', { name: 'networkChaos workload tag' });
    expect(orchestrator).toHaveValue('orchestrator-v1');
    expect(uploader).toHaveValue('uploader-v2');
    expect(hog).toHaveValue('hog-v1');
    expect(tools).toHaveValue('tools-v2');
    expect(synFlood).toHaveValue('syn-flood-v3');
    expect(networkChaos).toHaveValue('network-chaos-v4');

    await user.click(screen.getByRole('button', { name: 'Update Registry' }));
    await waitFor(() => expect(mocks.registries.updateRegistry).toHaveBeenCalledTimes(1));
    expect(mocks.registries.updateRegistry).toHaveBeenLastCalledWith('private-preview', expect.objectContaining({
      aiOrchestratorTag: 'orchestrator-v1',
      aiResultUploaderTag: 'uploader-v2',
      workloadImageTags: {
        hog: 'hog-v1',
        tools: 'tools-v2',
        synFlood: 'syn-flood-v3',
        networkChaos: 'network-chaos-v4',
      },
    }));

    for (const input of [orchestrator, uploader, hog, tools, synFlood, networkChaos]) await user.clear(input);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Update Registry' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Update Registry' }));
    await waitFor(() => expect(mocks.registries.updateRegistry).toHaveBeenCalledTimes(2));
    expect(mocks.registries.updateRegistry).toHaveBeenLastCalledWith('private-preview', expect.objectContaining({
      aiOrchestratorTag: '',
      aiResultUploaderTag: '',
      workloadImageTags: {},
    }));
  });

  it.each(['custom', 'untouched', 'blank'] as const)('creates a registry with %s optional image tags', async (mode) => {
    const user = userEvent.setup();
    const paste = async (input: HTMLElement, value: string) => {
      await user.clear(input);
      await user.click(input);
      await user.paste(value);
    };
    render(<RegistryForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByRole('textbox', { name: 'Registry Name' });
    const operatorTag = screen.getByRole('textbox', { name: 'krkn-ai operator tag' });
    const serviceTag = screen.getByRole('textbox', { name: 'krkn-ai service tag' });
    expect(operatorTag).toHaveValue('');
    expect(serviceTag).toHaveValue('');
    expect(operatorTag).toHaveAttribute('placeholder', 'krkn-ai-operator');
    expect(serviceTag).toHaveAttribute('placeholder', 'krkn-ai-service');
    expect(operatorTag).not.toBeRequired();
    expect(serviceTag).not.toBeRequired();
    await paste(screen.getByRole('textbox', { name: 'Registry Name' }), 'team-registry');
    await paste(screen.getByRole('textbox', { name: 'Registry URL' }), 'registry.example.test');
    await paste(screen.getByRole('textbox', { name: 'Scenario Repository' }), 'team/chaos');
    await user.click(screen.getByRole('radio', { name: 'Username & Token' }));
    await paste(screen.getByRole('textbox', { name: 'Username' }), 'preview-user');
    await paste(screen.getByLabelText(/^Token/), 'preview-token');
    if (mode === 'custom') {
      await paste(operatorTag, 'orchestrator-test');
      await paste(serviceTag, 'uploader-test');
      await paste(screen.getByRole('textbox', { name: 'hog workload tag' }), 'hog-test');
    } else if (mode === 'blank') {
      await paste(operatorTag, 'temporary-operator');
      await paste(serviceTag, 'temporary-service');
      await user.clear(operatorTag);
      await user.clear(serviceTag);
    }
    await user.click(screen.getByRole('button', { name: 'Create Registry' }));

    await waitFor(() => expect(mocks.registries.createRegistry).toHaveBeenCalledTimes(1));
    expect(mocks.registries.createRegistry).toHaveBeenCalledWith(expect.objectContaining({
      aiOrchestratorTag: mode === 'custom' ? 'orchestrator-test' : undefined,
      aiResultUploaderTag: mode === 'custom' ? 'uploader-test' : undefined,
      workloadImageTags: mode === 'custom' ? { hog: 'hog-test' } : undefined,
    }));
  });

  it.each([undefined, ''])('shows placeholders for unconfigured saved AI tags: %s', async (tag) => {
    mocks.registries.getRegistry.mockResolvedValueOnce({
      name: 'private-preview', registryUrl: 'registry.example.test',
      scenarioRepository: 'krkn/scenarios', authType: 'token', groups: [],
      skipTls: false, insecure: false, availableToAll: true,
      aiOrchestratorTag: tag, aiResultUploaderTag: tag,
    });
    render(<RegistryForm registryName="private-preview" onSubmit={vi.fn()} onCancel={vi.fn()} />);
    const operatorTag = await screen.findByRole('textbox', { name: 'krkn-ai operator tag' });
    const serviceTag = screen.getByRole('textbox', { name: 'krkn-ai service tag' });
    expect(operatorTag).toHaveValue('');
    expect(serviceTag).toHaveValue('');
    expect(operatorTag).toHaveAttribute('placeholder', 'krkn-ai-operator');
    expect(serviceTag).toHaveAttribute('placeholder', 'krkn-ai-service');
  });
});
