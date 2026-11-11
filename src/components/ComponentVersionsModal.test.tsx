import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { componentsApi } from '../services/componentsApi';
import { ComponentVersionsModal } from './ComponentVersionsModal';

vi.mock('../services/componentsApi', () => ({
  componentsApi: { listComponents: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('ComponentVersionsModal', () => {
  it('loads versions when opened and closes with the modal control', async () => {
    const onClose = vi.fn();
    vi.mocked(componentsApi.listComponents).mockResolvedValue({
      'krkn-operator': {
        version: 'v1.1.0-rc4',
        components: [{ component: 'rest-api', description: 'REST API' }],
      },
    });

    const { rerender } = render(<ComponentVersionsModal isOpen={false} onClose={onClose} />);
    expect(componentsApi.listComponents).not.toHaveBeenCalled();

    rerender(<ComponentVersionsModal isOpen onClose={onClose} />);
    expect(await screen.findByText('v1.1.0-rc4')).toBeInTheDocument();
    expect(screen.getByText('rest-api')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
