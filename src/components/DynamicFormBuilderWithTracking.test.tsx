import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { DynamicFormBuilderWithTracking } from './DynamicFormBuilderWithTracking';
import type { ScenarioField, ScenarioFormValues, TouchedFields } from '../types/api';

function makeGroupField(variable: string, shortDesc: string, desc: string): ScenarioField {
  return { name: variable, short_description: shortDesc, description: desc, variable, type: 'group', required: false, secret: false } as ScenarioField;
}

function makeStringField(
  variable: string,
  shortDesc: string,
  opts: { group?: string; required?: boolean } = {},
): ScenarioField {
  return {
    name: variable, short_description: shortDesc, description: `Desc for ${variable}`, variable,
    type: 'string', required: opts.required ?? false, secret: false, group: opts.group,
  } as ScenarioField;
}

describe('DynamicFormBuilderWithTracking', () => {
  const defaultTouched: TouchedFields = {};

  describe('group rendering', () => {
    it('should render group header with title and description', () => {
      const fields: ScenarioField[] = [
        makeGroupField('G1', 'Network Settings', 'Configure network parameters'),
        makeStringField('PROXY', 'Proxy URL', { group: 'G1' }),
      ];
      render(
        <DynamicFormBuilderWithTracking
          fields={fields}
          values={{}}
          touchedFields={defaultTouched}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByText('Network Settings')).toBeInTheDocument();
      expect(screen.getByText('Configure network parameters')).toBeInTheDocument();
    });

    it('should render grouped fields inside their group container', () => {
      const fields: ScenarioField[] = [
        makeGroupField('G1', 'Group A', 'Desc'),
        makeStringField('F1', 'Field Inside Group', { group: 'G1' }),
      ];
      render(
        <DynamicFormBuilderWithTracking
          fields={fields}
          values={{}}
          touchedFields={defaultTouched}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByText('Field Inside Group')).toBeInTheDocument();
    });

    it('should render ungrouped fields alongside groups', () => {
      const fields: ScenarioField[] = [
        makeStringField('SOLO', 'Ungrouped Field'),
        makeGroupField('G1', 'Group A', 'Desc'),
        makeStringField('F1', 'Grouped Field', { group: 'G1' }),
      ];
      render(
        <DynamicFormBuilderWithTracking
          fields={fields}
          values={{}}
          touchedFields={defaultTouched}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByText('Ungrouped Field')).toBeInTheDocument();
      expect(screen.getByText('Grouped Field')).toBeInTheDocument();
    });
  });

  describe('group search', () => {
    it('should filter fields by search input', async () => {
      const user = userEvent.setup();
      const fields: ScenarioField[] = [
        makeGroupField('G1', 'Settings', 'Desc'),
        makeStringField('ALPHA', 'Alpha Field', { group: 'G1' }),
        makeStringField('BETA', 'Beta Field', { group: 'G1' }),
        makeStringField('GAMMA', 'Gamma Field', { group: 'G1' }),
      ];
      render(
        <DynamicFormBuilderWithTracking
          fields={fields}
          values={{}}
          touchedFields={defaultTouched}
          onChange={vi.fn()}
        />,
      );

      expect(screen.getByText('Alpha Field')).toBeInTheDocument();
      expect(screen.getByText('Beta Field')).toBeInTheDocument();
      expect(screen.getByText('Gamma Field')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText('Filter fields...');
      await user.type(searchInput, 'beta');

      expect(screen.queryByText('Alpha Field')).not.toBeInTheDocument();
      expect(screen.getByText('Beta Field')).toBeInTheDocument();
      expect(screen.queryByText('Gamma Field')).not.toBeInTheDocument();
    });

    it('should show empty message when search matches nothing', async () => {
      const user = userEvent.setup();
      const fields: ScenarioField[] = [
        makeGroupField('G1', 'Settings', 'Desc'),
        makeStringField('F1', 'Field 1', { group: 'G1' }),
      ];
      render(
        <DynamicFormBuilderWithTracking
          fields={fields}
          values={{}}
          touchedFields={defaultTouched}
          onChange={vi.fn()}
        />,
      );

      const searchInput = screen.getByPlaceholderText('Filter fields...');
      await user.type(searchInput, 'zzzzz');

      expect(screen.getByText('No fields match your search.')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have aria-label on SearchInput within group', () => {
      const fields: ScenarioField[] = [
        makeGroupField('G1', 'Network Settings', 'Desc'),
        makeStringField('F1', 'Field 1', { group: 'G1' }),
      ];
      render(
        <DynamicFormBuilderWithTracking
          fields={fields}
          values={{}}
          touchedFields={defaultTouched}
          onChange={vi.fn()}
        />,
      );

      const searchInput = screen.getByLabelText(/Filter fields in Network Settings/i);
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe('touched field tracking', () => {
    it('should call onChange with updated touchedFields when a field is modified', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const fields: ScenarioField[] = [
        makeStringField('MY_VAR', 'My Variable'),
      ];
      render(
        <DynamicFormBuilderWithTracking
          fields={fields}
          values={{}}
          touchedFields={defaultTouched}
          onChange={onChange}
        />,
      );

      const input = screen.getByRole('textbox', { name: /My Variable/i });
      await user.type(input, 'x');

      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      const [, touched] = lastCall as [ScenarioFormValues, TouchedFields];
      expect(touched.MY_VAR).toBe(true);
    });
  });
});
