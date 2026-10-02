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

describe('wizard table editing and removal', () => {
  it('cancels removal, then removes the selected fitness row even when IDs match', async () => {
    const user = userEvent.setup();
    render(<Editors kind="fitness" />);
    const secondRow = screen.getByText('second_metric').closest('tr')!;
    await user.click(within(secondRow).getByRole('button', { name: 'Remove fitness item 9' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('second_metric')).toBeInTheDocument();
    await user.click(within(secondRow).getByRole('button', { name: 'Remove fitness item 9' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    expect(screen.queryByText('second_metric')).not.toBeInTheDocument();
    expect(screen.getByText('first_metric')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove fitness item 9' })).toBeDisabled();
  });

  it('keeps fitness add/edit changes private until Save and discards cancelled edits', async () => {
    const user = userEvent.setup();
    render(<Editors kind="fitness" />);
    await user.click(screen.getByRole('button', { name: 'Add fitness item' }));
    let dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByRole('textbox', { name: /query/ }), 'new_metric');
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('new_metric')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add fitness item' }));
    dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('textbox', { name: /query/ })).toHaveValue('');
    await user.type(dialog.getByRole('textbox', { name: /query/ }), 'new_metric');
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('new_metric')).toBeInTheDocument();
    const firstRow = screen.getByText('first_metric').closest('tr')!;
    await user.click(within(firstRow).getByRole('button', { name: 'Edit fitness item 9' }));
    dialog = within(screen.getByRole('dialog'));
    const query = dialog.getByRole('textbox', { name: /query/ });
    expect(query).toHaveValue('first_metric');
    await user.clear(query);
    await user.type(query, 'edited_metric');
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('first_metric')).toBeInTheDocument();
    expect(screen.queryByText('edited_metric')).not.toBeInTheDocument();
    await user.click(within(firstRow).getByRole('button', { name: 'Edit fitness item 9' }));
    dialog = within(screen.getByRole('dialog'));
    await user.clear(dialog.getByRole('textbox', { name: /query/ }));
    await user.type(dialog.getByRole('textbox', { name: /query/ }), 'edited_metric');
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('edited_metric')).toBeInTheDocument();
    expect(screen.queryByText('first_metric')).not.toBeInTheDocument();
    expect(screen.getByText('second_metric')).toBeInTheDocument();
  });

  it('preserves the health row on cancellation and removes only the confirmed endpoint', async () => {
    const user = userEvent.setup();
    render(<Editors kind="health" />);
    await user.click(screen.getByRole('button', { name: 'Remove health check payments' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('https://payments.example/ready')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove health check payments' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    expect(screen.queryByText('https://payments.example/ready')).not.toBeInTheDocument();
    expect(screen.getByText('https://shop.example/health')).toBeInTheDocument();
  });

  it('discards cancelled health edits and saves the chosen endpoint without changing other rows', async () => {
    const user = userEvent.setup();
    render(<Editors kind="health" />);
    await user.click(screen.getByRole('button', { name: 'Edit health check payments' }));
    let dialog = within(screen.getByRole('dialog'));
    const url = dialog.getByRole('textbox', { name: /URL/ });
    expect(url).toHaveValue('https://payments.example/ready');
    await user.clear(url);
    await user.type(url, 'https://payments.example/new');
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('https://payments.example/ready')).toBeInTheDocument();
    expect(screen.queryByText('https://payments.example/new')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit health check payments' }));
    dialog = within(screen.getByRole('dialog'));
    await user.clear(dialog.getByRole('textbox', { name: /URL/ }));
    await user.type(dialog.getByRole('textbox', { name: /URL/ }), 'https://payments.example/new');
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('https://payments.example/new')).toBeInTheDocument();
    expect(screen.getByText('https://shop.example/health')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add health check' }));
    dialog = within(screen.getByRole('dialog'));
    await user.clear(dialog.getByRole('textbox', { name: /name/ }));
    await user.type(dialog.getByRole('textbox', { name: /name/ }), 'catalog');
    await user.type(dialog.getByRole('textbox', { name: /URL/ }), 'https://catalog.example/health');
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('https://catalog.example/health')).toBeInTheDocument();
  });
});
