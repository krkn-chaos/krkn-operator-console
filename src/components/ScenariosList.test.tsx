import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScenariosList } from './ScenariosList';

// ScenariosList pulls its scenarios from AppContext. Inject a fixed set spanning
// three categories (Pod & Container / Network / Time) so we can assert the
// category filter narrows the visible list. Names are inlined in the factory
// because vi.mock is hoisted above any top-level fixture variable.
vi.mock('../context/AppContext', () => ({
  useAppContext: () => ({
    state: {
      scenarios: [
        { name: 'pod-scenarios' }, // -> Pod & Container
        { name: 'network-chaos' }, // -> Network
        { name: 'time-scenarios' }, // -> Time
      ],
    },
    dispatch: vi.fn(),
  }),
}));

vi.mock('../hooks', () => ({
  useNotifications: () => ({ showSuccess: vi.fn() }),
}));

describe('ScenariosList category filter', () => {
  it('shows every scenario when no category is selected', () => {
    render(<ScenariosList />);

    expect(screen.getByText('pod-scenarios')).toBeInTheDocument();
    expect(screen.getByText('network-chaos')).toBeInTheDocument();
    expect(screen.getByText('time-scenarios')).toBeInTheDocument();
  });

  it('narrows the list to the chosen category', () => {
    render(<ScenariosList />);

    // The category chips render as buttons; selecting "Network" must hide the
    // pod and time scenarios and keep only the network one.
    fireEvent.click(screen.getByRole('button', { name: 'Network' }));

    expect(screen.getByText('network-chaos')).toBeInTheDocument();
    expect(screen.queryByText('pod-scenarios')).not.toBeInTheDocument();
    expect(screen.queryByText('time-scenarios')).not.toBeInTheDocument();
  });
});
