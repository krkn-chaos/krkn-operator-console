import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { componentsApi } from '../services/componentsApi';
import { ComponentVersionsAccess } from './ComponentVersionsAccess';

vi.mock('../services/componentsApi', () => ({
  componentsApi: { listComponents: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('ComponentVersionsAccess', () => {
  it('opens versions from the top bar and reloads them when reopened', async () => {
    vi.mocked(componentsApi.listComponents).mockResolvedValue({
      'krkn-operator-acm': {
        version: 'v1.1.0-rc4',
        components: [{ component: 'acm-target-provider', description: 'ACM target discovery' }],
      },
    });
    const user = userEvent.setup();
    render(<ComponentVersionsAccess />);

    const trigger = screen.getByRole('button', { name: 'Component Versions' });
    expect(componentsApi.listComponents).not.toHaveBeenCalled();
    await user.click(trigger);
    expect(await screen.findByText('v1.1.0-rc4')).toBeInTheDocument();
    expect(screen.getByText('acm-target-provider')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Close'));
    expect(screen.queryByText('v1.1.0-rc4')).not.toBeInTheDocument();
    await user.click(trigger);
    expect(await screen.findByText('v1.1.0-rc4')).toBeInTheDocument();
    expect(componentsApi.listComponents).toHaveBeenCalledTimes(2);
  });
});
