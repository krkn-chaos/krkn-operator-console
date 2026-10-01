import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createEditableConfigDraft } from './configModel';
import type { EditableConfigDraft } from './configModel';
import { FitnessFunctionEditor } from './FitnessFunctionEditor';
import { HealthChecksEditor } from './HealthChecksEditor';

function Editors({ kind }: { kind: 'fitness' | 'health' }) {
  const [draft, setDraft] = useState(() => {
    const initial = createEditableConfigDraft('fitness_function:\n  query: up\n').draft;
    initial.fitnessItems = [
      { key: 10, id: '9', title: 'First metric', query: 'first_metric', type: 'point', weight: '1' },
      { key: 20, id: '9', title: 'Second metric', query: 'second_metric', type: 'range', weight: '2' },
    ];
    initial.healthChecks = [
      { key: 10, name: 'shop', url: 'https://shop.example/health', statusCode: '200', timeout: '4', interval: '2' },
      { key: 20, name: 'payments', url: 'https://payments.example/ready', statusCode: '200', timeout: '5', interval: '3' },
    ];
    return initial;
  });
  const onChange = (updates: Partial<EditableConfigDraft>) => setDraft(current => ({ ...current, ...updates }));
  return kind === 'fitness'
    ? <FitnessFunctionEditor draft={draft} errors={{}} onChange={onChange} />
    : <HealthChecksEditor draft={draft} errors={{}} onChange={onChange} />;
}

describe('wizard item removal confirmation', () => {
  it('cancels removal, then removes the selected stable-key fitness item even when IDs match', async () => {
    const user = userEvent.setup();
    render(<Editors kind="fitness" />);
    await user.click(screen.getByText(/Second metric/));
    const secondItem = screen.getByText(/Second metric/).closest('details')!;
    await user.click(within(secondItem).getByRole('button', { name: 'Remove fitness item 9' }));
    const dialog = screen.getByRole('dialog');
    expect(screen.getByDisplayValue('second_metric')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByDisplayValue('second_metric')).toBeInTheDocument();
    await user.click(within(secondItem).getByRole('button', { name: 'Remove fitness item 9' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    expect(screen.queryByDisplayValue('second_metric')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('first_metric')).toBeInTheDocument();
    await user.click(screen.getByText(/First metric/));
    expect(screen.getByRole('button', { name: 'Remove fitness item 9' })).toBeDisabled();
  });

  it('preserves the health check on cancellation and removes only the confirmed endpoint', async () => {
    const user = userEvent.setup();
    render(<Editors kind="health" />);
    await user.click(screen.getByText('payments', { selector: 'summary strong' }));
    await user.click(screen.getByRole('button', { name: 'Remove health check payments' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByDisplayValue('https://payments.example/ready')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove health check payments' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    expect(screen.queryByDisplayValue('https://payments.example/ready')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('https://shop.example/health')).toBeInTheDocument();
  });
});
