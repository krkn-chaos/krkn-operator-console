import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ScenariosListStep } from './ScenariosListStep';

describe('ScenariosListStep', () => {
  it('shows retry UI when scenario fetch fails', async () => {
    const onRetry = vi.fn();
    render(
      <ScenariosListStep
        scenarios={[]}
        selectedScenario={null}
        onSelectScenario={vi.fn()}
        error="Failed to load scenarios"
        onRetry={onRetry}
      />
    );

    expect(screen.getByText('Failed to Load Scenarios')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('lists node-scenarios when scenarios are available', () => {
    render(
      <ScenariosListStep
        scenarios={[{ name: 'node-scenarios', digest: 'sha256:abc', size: 1 }]}
        selectedScenario={null}
        onSelectScenario={vi.fn()}
      />
    );

    expect(screen.getByText('node-scenarios')).toBeInTheDocument();
  });
});
