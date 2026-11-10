import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ClusterOptionInput } from './ClusterOptionInput';

describe('ClusterOptionInput', () => {
  it('uses a typeahead and keeps created values out of discovered options', async () => {
    const user = userEvent.setup();
    function Field() {
      const [value, setValue] = useState('');
      return <ClusterOptionInput
        id="NAMESPACE"
        label="Target namespace"
        value={value}
        optionState={{ options: ['default'], status: 'ready' }}
        onChange={setValue}
      />;
    }

    render(<Field />);
    const input = screen.getByRole('combobox', { name: 'Target namespace' });
    await user.type(input, 'custom-ns');
    expect(screen.getByText('Use "custom-ns"')).toBeInTheDocument();
    await user.click(screen.getByText('Use "custom-ns"'));
    expect(input).toHaveValue('custom-ns');

    await user.click(screen.getByRole('button', { name: 'Show Target namespace options' }));
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.queryByText('Use "custom-ns"')).not.toBeInTheDocument();
  });

  it('replaces a partially typed node name when selecting a suggested node', async () => {
    const user = userEvent.setup();
    function Field() {
      const [value, setValue] = useState('worker-1');
      return <ClusterOptionInput
        id="NODE_NAME"
        label="Node name"
        value={value}
        optionState={{ options: ['worker-2'], status: 'ready', selectionMode: 'comma' }}
        onChange={setValue}
      />;
    }

    render(<Field />);
    const input = screen.getByRole('combobox', { name: 'Node name' });
    await user.type(input, ',work');
    await user.click(screen.getByText('worker-2'));
    expect(input).toHaveValue('worker-1,worker-2');
  });

  it('selects the last discovered option with ArrowUp from an empty input', async () => {
    const user = userEvent.setup();
    function Field() {
      const [value, setValue] = useState('');
      return <ClusterOptionInput
        id="NAMESPACE"
        label="Target namespace"
        value={value}
        optionState={{ options: ['default', 'workloads'], status: 'ready' }}
        onChange={setValue}
      />;
    }

    render(<Field />);
    const input = screen.getByRole('combobox', { name: 'Target namespace' });
    await user.click(input);
    await user.keyboard('{ArrowUp}{Enter}');
    expect(input).toHaveValue('workloads');
  });

  it('keeps typed custom value when Enter is pressed without selecting a suggestion', async () => {
    const user = userEvent.setup();
    function Field() {
      const [value, setValue] = useState('');
      return <ClusterOptionInput
        id="NAMESPACE"
        label="Target namespace"
        value={value}
        optionState={{ options: ['workloads'], status: 'ready' }}
        onChange={setValue}
      />;
    }

    render(<Field />);
    const input = screen.getByRole('combobox', { name: 'Target namespace' });
    await user.type(input, 'work');
    await user.keyboard('{Enter}');
    expect(input).toHaveValue('work');
    expect(screen.queryByRole('option', { name: 'workloads' })).not.toBeInTheDocument();
  });

  it('lets closed input Enter reach parent form shortcut', () => {
    const onKeyDown = vi.fn();
    render(
      <div onKeyDown={onKeyDown}>
        <ClusterOptionInput
          id="NAMESPACE" label="Target namespace" value="default"
          optionState={{ options: ['default'], status: 'ready' }} onChange={() => {}}
        />
      </div>,
    );

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Target namespace' }), { key: 'Enter' });
    expect(onKeyDown).toHaveBeenCalledOnce();
  });

  it('requests fresh options after reopening a ready menu', async () => {
    const user = userEvent.setup();
    const onOptionsOpen = vi.fn();
    render(
      <ClusterOptionInput
        id="NAMESPACE" label="Target namespace" value="default"
        optionState={{ options: ['default'], status: 'ready' }}
        onChange={() => {}} onOptionsOpen={onOptionsOpen}
      />,
    );
    const toggle = screen.getByRole('button', { name: 'Show Target namespace options' });
    await user.click(toggle);
    await user.click(toggle);
    await user.click(toggle);
    expect(onOptionsOpen).toHaveBeenCalledTimes(2);
  });

  it('clears a selected value without opening its menu', async () => {
    const user = userEvent.setup();
    function Field() {
      const [value, setValue] = useState('app=demo');
      return <ClusterOptionInput
        id="POD_LABEL"
        label="Pod label"
        value={value}
        optionState={{ options: ['app=demo'], status: 'ready', clearable: true }}
        onChange={setValue}
      />;
    }

    render(<Field />);
    const input = screen.getByRole('combobox', { name: 'Pod label' });
    await user.click(screen.getByRole('button', { name: 'Clear Pod label' }));
    expect(input).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear Pod label' })).not.toBeInTheDocument();
    expect(screen.queryByText('app=demo')).not.toBeInTheDocument();
  });
});
