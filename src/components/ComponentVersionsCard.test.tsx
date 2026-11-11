import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { componentsApi } from '../services/componentsApi';
import { ComponentVersionsCard } from './ComponentVersionsCard';

vi.mock('../services/componentsApi', () => ({
  componentsApi: { listComponents: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('ComponentVersionsCard', () => {
  it('shows the exact published tag and component descriptions', async () => {
    vi.mocked(componentsApi.listComponents).mockResolvedValue({
      'krkn-operator-acm': {
        version: 'v1.1.0-rc4',
        components: [{ component: 'acm-target-provider', description: 'ACM target discovery' }],
      },
    });
    render(<ComponentVersionsCard />);
    expect(screen.getByLabelText('Loading component versions')).toBeInTheDocument();
    expect(await screen.findByText('v1.1.0-rc4')).toBeInTheDocument();
    expect(screen.getByText('acm-target-provider')).toBeInTheDocument();
    expect(screen.getByText('ACM target discovery')).toBeInTheDocument();
    expect(screen.getByText('krkn-operator-console')).toBeInTheDocument();
    expect(screen.getByText('0.0.0')).toBeInTheDocument();
    expect(screen.getByText('web-console')).toBeInTheDocument();
  });

  it('shows a retry action after a load failure', async () => {
    vi.mocked(componentsApi.listComponents)
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce({});
    render(<ComponentVersionsCard />);
    expect(await screen.findByText('Unable to load component versions')).toBeInTheDocument();
    expect(screen.getByText('krkn-operator-console')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('No operator versions available')).toBeInTheDocument());
  });

  it('uses the bundled console manifest if the API also reports a console entry', async () => {
    vi.mocked(componentsApi.listComponents).mockResolvedValue({
      'krkn-operator-console': {
        version: 'stale-server-version',
        components: [{ component: 'old-console', description: 'Stale data' }],
      },
    });
    render(<ComponentVersionsCard />);
    expect(await screen.findByText('No operator versions available')).toBeInTheDocument();
    expect(screen.getByText('krkn-operator-console')).toBeInTheDocument();
    expect(screen.getByText('0.0.0')).toBeInTheDocument();
    expect(screen.queryByText('stale-server-version')).not.toBeInTheDocument();
    expect(screen.queryByText('old-console')).not.toBeInTheDocument();
  });
});
