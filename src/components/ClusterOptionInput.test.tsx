import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ClusterOptionInput } from './ClusterOptionInput';
import { getClusterOptionSource } from '../utils/clusterParameterOptions';
import nodeScenario from '../../misc/scenario_detail.json';

describe('ClusterOptionInput', () => {
  it('keeps two discovered NODE_NAME values from node scenario metadata', async () => {
    const user = userEvent.setup();
    const nodeNameField = nodeScenario.fields.find((entry) => entry.variable === 'NODE_NAME');
    expect(nodeNameField).toBeDefined();
    const source = getClusterOptionSource(nodeScenario.name, { ...nodeNameField!, type: 'string' }, {});
    expect(source).not.toBeNull();
    function Field() {
      const [value, setValue] = useState('');
      return <ClusterOptionInput
        id={nodeNameField!.variable}
        label={nodeNameField!.short_description}
        value={value}
        optionState={{ options: ['worker-1', 'worker-2'], status: 'ready', selectionMode: source?.selectionMode }}
        onChange={setValue}
      />;
    }

    render(<Field />);
    const input = screen.getByRole('combobox', { name: nodeNameField!.short_description });
    await user.click(screen.getByRole('button', { name: `Show ${nodeNameField!.short_description} options` }));
    await user.click(screen.getByText('worker-1'));
    await user.click(screen.getByRole('button', { name: `Show ${nodeNameField!.short_description} options` }));
    await user.click(screen.getByText('worker-2'));
    expect(input).toHaveValue('worker-1,worker-2');
  });

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

  it('serializes selected node names as a list after one or multiple selections', async () => {
    const user = userEvent.setup();
    function Field() {
      const [value, setValue] = useState('');
      return <ClusterOptionInput
        id="NODE_NAMES"
        label="Node names"
        value={value}
        optionState={{ options: ['worker-1', 'worker-2'], status: 'ready', selectionMode: 'list' }}
        onChange={setValue}
      />;
    }

    render(<Field />);
    const input = screen.getByRole('combobox', { name: 'Node names' });
    await user.click(screen.getByRole('button', { name: 'Show Node names options' }));
    await user.click(screen.getByText('worker-1'));
    expect(input).toHaveValue('["worker-1"]');

    await user.click(screen.getByRole('button', { name: 'Show Node names options' }));
    await user.click(screen.getByText('worker-2'));
    expect(input).toHaveValue('["worker-1","worker-2"]');
  });

  it('keeps custom node names available while selecting list values', async () => {
    const user = userEvent.setup();
    function Field() {
      const [value, setValue] = useState('');
      return <ClusterOptionInput
        id="NODE_NAMES" label="Node names" value={value}
        optionState={{ options: ['worker-2'], status: 'ready', selectionMode: 'list' }}
        onChange={setValue}
      />;
    }

    render(<Field />);
    const input = screen.getByRole('combobox', { name: 'Node names' });
    await user.type(input, 'custom-node');
    await user.click(screen.getByText('Use "custom-node"'));
    expect(input).toHaveValue('["custom-node"]');
    await user.click(screen.getByRole('button', { name: 'Show Node names options' }));
    await user.click(screen.getByText('worker-2'));
    expect(input).toHaveValue('["custom-node","worker-2"]');
  });

  it('replaces partial search after an existing node list', async () => {
    const user = userEvent.setup();
    function Field() {
      const [value, setValue] = useState('["worker-1"]');
      return <ClusterOptionInput
        id="NODE_NAMES" label="Node names" value={value}
        optionState={{ options: ['worker-2'], status: 'ready', selectionMode: 'list' }}
        onChange={setValue}
      />;
    }

    render(<Field />);
    const input = screen.getByRole('combobox', { name: 'Node names' });
    await user.type(input, ',work');
    await user.click(screen.getByText('worker-2'));
    expect(input).toHaveValue('["worker-1","worker-2"]');
  });

  it('keeps manually entered YAML list members when adding a suggestion', async () => {
    const user = userEvent.setup();
    function Field() {
      const [value, setValue] = useState('[worker-1]');
      return <ClusterOptionInput
        id="NODE_NAMES" label="Node names" value={value}
        optionState={{ options: ['worker-2'], status: 'ready', selectionMode: 'list' }}
        onChange={setValue}
      />;
    }

    render(<Field />);
    const input = screen.getByRole('combobox', { name: 'Node names' });
    await user.click(screen.getByRole('button', { name: 'Show Node names options' }));
    await user.click(screen.getByText('worker-2'));
    expect(input).toHaveValue('["worker-1","worker-2"]');
  });

  it('adds discovered time-scenario object to custom list', async () => {
    const user = userEvent.setup();
    function Field() {
      const [value, setValue] = useState('[custom-pod]');
      return <ClusterOptionInput
        id="OBJECT_NAME" label="Object name" value={value}
        optionState={{ options: ['discovered-pod'], status: 'ready', selectionMode: 'list' }}
        onChange={setValue}
      />;
    }

    render(<Field />);
    const input = screen.getByRole('combobox', { name: 'Object name' });
    await user.click(screen.getByRole('button', { name: 'Show Object name options' }));
    await user.click(screen.getByText('discovered-pod'));
    expect(input).toHaveValue('["custom-pod","discovered-pod"]');
  });

  it('wraps a single discovered time-scenario object in a list', async () => {
    const user = userEvent.setup();
    function Field() {
      const [value, setValue] = useState('');
      return <ClusterOptionInput
        id="OBJECT_NAME" label="Object name" value={value}
        optionState={{ options: ['discovered-pod'], status: 'ready', selectionMode: 'list' }}
        onChange={setValue}
      />;
    }

    render(<Field />);
    const input = screen.getByRole('combobox', { name: 'Object name' });
    await user.click(screen.getByRole('button', { name: 'Show Object name options' }));
    await user.click(screen.getByText('discovered-pod'));
    expect(input).toHaveValue('["discovered-pod"]');
  });

  it('replaces a partial POD_NAMES token after closing and reopening options', async () => {
    const user = userEvent.setup();
    function Field() {
      const [value, setValue] = useState('pod-1');
      return <ClusterOptionInput
        id="POD_NAMES" label="Pod names" value={value}
        optionState={{ options: ['pod-2'], status: 'ready', selectionMode: 'comma' }}
        onChange={setValue}
      />;
    }

    render(<Field />);
    const input = screen.getByRole('combobox', { name: 'Pod names' });
    await user.type(input, ',pod');
    await user.click(screen.getByRole('button', { name: 'Show Pod names options' }));
    await user.click(screen.getByRole('button', { name: 'Show Pod names options' }));
    await user.click(screen.getByText('pod-2'));
    expect(input).toHaveValue('pod-1,pod-2');
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

  it('reuses ready options on open and refreshes only on request', async () => {
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
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(onOptionsOpen).not.toHaveBeenCalled();
    await user.click(toggle);
    await user.click(toggle);
    expect(onOptionsOpen).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Refresh Target namespace options' }));
    expect(onOptionsOpen).toHaveBeenCalledOnce();
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
