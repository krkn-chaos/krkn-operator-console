import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TargetsList } from './TargetsList';
import { targetsApi } from '../services/targetsApi';
import { operatorApi } from '../services/operatorApi';
import type { TargetResponse } from '../types/api';

vi.mock('../services/targetsApi', () => ({
  targetsApi: {
    listTargets: vi.fn(),
  },
}));

vi.mock('../services/operatorApi', () => ({
  operatorApi: {
    deleteTargetRequest: vi.fn(),
  },
}));

vi.mock('../hooks', () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

const mockUseClusterDiscovery = vi.fn();
vi.mock('../hooks/useClusterDiscovery', () => ({
  useClusterDiscovery: () => mockUseClusterDiscovery(),
}));

const configuredTarget: TargetResponse = {
  uuid: 'target-1',
  clusterName: 'ibm',
  clusterAPIURL: 'https://api.ibm.example:6443',
  secretType: 'kubeconfig',
  ready: true,
  createdAt: '2026-01-04T08:41:40Z',
};

const mockStartDiscovery = vi.fn();

function mockDiscovery(overrides: Record<string, unknown> = {}) {
  mockUseClusterDiscovery.mockReturnValue({
    clusters: null,
    discoveryUuid: 'discovery-uuid',
    isLoading: false,
    isPolling: false,
    error: null,
    startDiscovery: mockStartDiscovery,
    retry: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  });
}

async function renderWithTargets(targets: TargetResponse[] = [configuredTarget]) {
  vi.mocked(targetsApi.listTargets).mockResolvedValue(targets);
  const view = render(<TargetsList />);
  // Wait for the target list request to settle.
  await screen.findByText(targets[0]?.clusterName ?? 'No Targets Configured');
  return view;
}

/** The PatternFly label rendered inside the status cell for a given availability text. */
function getAvailabilityBadge(text: string): Element | null {
  return screen.getByLabelText(`Target availability: ${text}`).querySelector('.pf-v5-c-label');
}

describe('TargetsList cluster status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(operatorApi.deleteTargetRequest).mockResolvedValue(undefined);
    mockDiscovery();
  });

  it('starts a live discovery on mount so status matches the cluster picker', async () => {
    await renderWithTargets();

    expect(mockStartDiscovery).toHaveBeenCalled();
  });

  it('does not report a registered but unreachable cluster as available (issue #182)', async () => {
    mockDiscovery({
      clusters: [
        {
          uuid: 'discovered-1',
          clusterName: 'ibm',
          clusterAPIURL: 'https://api.ibm.example:6443',
          secretType: 'kubeconfig',
          ready: true,
          online: false,
          checkedAt: '2026-11-19T10:00:00Z',
        },
      ],
    });

    await renderWithTargets();

    expect(screen.getByLabelText('Target availability: Unavailable')).toBeInTheDocument();
    expect(getAvailabilityBadge('Unavailable')).toHaveClass('pf-m-red');
    expect(screen.queryByLabelText('Target availability: Available')).not.toBeInTheDocument();
    expect(screen.queryByText('Ready')).not.toBeInTheDocument();
  });

  it('reports a reachable cluster as available and shows its ACM health', async () => {
    mockDiscovery({
      clusters: [
        {
          uuid: 'discovered-1',
          clusterName: 'ibm',
          clusterAPIURL: 'https://api.ibm.example:6443',
          secretType: 'kubeconfig',
          ready: true,
          online: true,
          clusterStatus: 'healthy',
        },
      ],
    });

    await renderWithTargets();

    expect(screen.getByLabelText('Target availability: Available')).toBeInTheDocument();
    expect(getAvailabilityBadge('Available')).toHaveClass('pf-m-green');
    expect(screen.getByLabelText('Cluster status: healthy')).toBeInTheDocument();
  });

  it('explains why an unreachable cluster is unavailable', async () => {
    mockDiscovery({
      clusters: [
        {
          uuid: 'discovered-1',
          clusterName: 'ibm',
          clusterAPIURL: 'https://api.ibm.example:6443',
          secretType: 'kubeconfig',
          ready: true,
          online: false,
          checkedAt: '2026-11-19T10:00:00Z',
        },
      ],
    });

    await renderWithTargets();
    await userEvent.hover(screen.getByLabelText('Target availability: Unavailable'));

    expect(
      await screen.findByText(/Scenarios cannot run on this cluster because its API server was unreachable/)
    ).toBeInTheDocument();
  });

  it('reports targets that discovery did not return as not available', async () => {
    mockDiscovery({
      clusters: [
        {
          uuid: 'discovered-1',
          clusterName: 'other',
          clusterAPIURL: 'https://api.other.example:6443',
          secretType: 'kubeconfig',
          ready: true,
          online: true,
        },
      ],
    });

    await renderWithTargets();

    expect(screen.getByLabelText('Target availability: Not available')).toBeInTheDocument();
  });

  it('shows a checking state while discovery is still running', async () => {
    mockDiscovery({ clusters: null, isLoading: true });

    await renderWithTargets();

    expect(screen.getByLabelText('Target availability: Checking…')).toBeInTheDocument();
  });

  it('warns and reports unknown availability when discovery fails', async () => {
    mockDiscovery({ clusters: null, error: 'Discovery timeout - please try again' });

    await renderWithTargets();

    expect(screen.getByText('Live cluster status unavailable')).toBeInTheDocument();
    expect(screen.getByLabelText('Target availability: Unknown')).toBeInTheDocument();
  });

  it('re-runs discovery when refreshing', async () => {
    await renderWithTargets();
    mockStartDiscovery.mockClear();

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => expect(mockStartDiscovery).toHaveBeenCalledTimes(1));
  });

  it('releases the discovery request on unmount', async () => {
    const { unmount } = await renderWithTargets();

    unmount();

    expect(operatorApi.deleteTargetRequest).toHaveBeenCalledWith('discovery-uuid');
  });
});
