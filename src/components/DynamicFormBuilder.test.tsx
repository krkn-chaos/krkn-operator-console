import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { DynamicFormBuilder } from './DynamicFormBuilder';
import type { ScenarioField, ScenarioFormValues } from '../types/api';

function makeGroupField(variable: string, shortDesc: string, desc: string): ScenarioField {
  return { name: variable, short_description: shortDesc, description: desc, variable, type: 'group', required: false, secret: false } as ScenarioField;
}

function makeEnumField(
  variable: string,
  shortDesc: string,
  opts: { group?: string; mutually_excludes?: string; allowed_values?: string; default?: string; required?: boolean } = {},
): ScenarioField {
  return {
    name: variable, short_description: shortDesc, description: `Desc for ${variable}`, variable,
    type: 'enum', separator: ',', allowed_values: opts.allowed_values ?? 'a,b',
    default: opts.default, required: opts.required ?? false, secret: false,
    group: opts.group, mutually_excludes: opts.mutually_excludes,
  } as ScenarioField;
}

function makeStringField(variable: string, shortDesc: string): ScenarioField {
  return { name: variable, short_description: shortDesc, description: `Desc for ${variable}`, variable, type: 'string', required: false, secret: false } as ScenarioField;
}

describe('DynamicFormBuilder', () => {
  describe('group rendering', () => {
    it('should render group headers with title and description', () => {
      const fields: ScenarioField[] = [
        makeGroupField('G1', 'My Group', 'Group description text'),
        makeEnumField('F1', 'Field 1', { group: 'G1' }),
      ];
      render(<DynamicFormBuilder fields={fields} values={{}} onChange={vi.fn()} />);
      expect(screen.getByText('My Group')).toBeInTheDocument();
      expect(screen.getByText('Group description text')).toBeInTheDocument();
    });

    it('should render grouped fields inside their group container', () => {
      const fields: ScenarioField[] = [
        makeGroupField('G1', 'Group A', 'Desc'),
        makeEnumField('F1', 'Field Inside Group', { group: 'G1' }),
      ];
      render(<DynamicFormBuilder fields={fields} values={{}} onChange={vi.fn()} />);
      expect(screen.getByText('Field Inside Group')).toBeInTheDocument();
    });

    it('should render ungrouped fields flat alongside groups', () => {
      const fields: ScenarioField[] = [
        makeStringField('UNGROUPED', 'Ungrouped Field'),
        makeGroupField('G1', 'Group A', 'Desc'),
        makeEnumField('F1', 'Grouped Field', { group: 'G1' }),
      ];
      render(<DynamicFormBuilder fields={fields} values={{}} onChange={vi.fn()} />);
      expect(screen.getByText('Ungrouped Field')).toBeInTheDocument();
      expect(screen.getByText('Grouped Field')).toBeInTheDocument();
    });
  });

  describe('group search', () => {
    it('should filter fields by search input', async () => {
      const user = userEvent.setup();
      const fields: ScenarioField[] = [
        makeGroupField('G1', 'Group', 'Desc'),
        makeEnumField('ALPHA', 'Alpha Field', { group: 'G1' }),
        makeEnumField('BETA', 'Beta Field', { group: 'G1' }),
        makeEnumField('GAMMA', 'Gamma Field', { group: 'G1' }),
      ];
      render(<DynamicFormBuilder fields={fields} values={{}} onChange={vi.fn()} />);

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
        makeGroupField('G1', 'Group', 'Desc'),
        makeEnumField('F1', 'Field 1', { group: 'G1' }),
      ];
      render(<DynamicFormBuilder fields={fields} values={{}} onChange={vi.fn()} />);

      const searchInput = screen.getByPlaceholderText('Filter fields...');
      await user.type(searchInput, 'zzzzz');

      expect(screen.getByText('No fields match your search.')).toBeInTheDocument();
    });
  });

  describe('mutually_excludes', () => {
    it('should disable excluded field when boolean enum is true', () => {
      const fields: ScenarioField[] = [
        makeEnumField('PROXY', 'Proxy', { allowed_values: 'true,false', mutually_excludes: 'SECRET' }),
        makeEnumField('SECRET', 'Secret', { mutually_excludes: 'PROXY' }),
      ];
      const values: ScenarioFormValues = { PROXY: 'true', SECRET: 'a' };
      render(<DynamicFormBuilder fields={fields} values={values} onChange={vi.fn()} />);

      const secretSelect = screen.getByRole('combobox', { name: /Secret/i });
      expect(secretSelect).toBeDisabled();
    });

    it('should not disable excluded field when boolean enum is false', () => {
      const fields: ScenarioField[] = [
        makeEnumField('PROXY', 'Proxy', { allowed_values: 'true,false', mutually_excludes: 'SECRET' }),
        makeEnumField('SECRET', 'Secret', { mutually_excludes: 'PROXY' }),
      ];
      const values: ScenarioFormValues = { PROXY: 'false', SECRET: 'a' };
      render(<DynamicFormBuilder fields={fields} values={values} onChange={vi.fn()} />);

      const secretSelect = screen.getByRole('combobox', { name: /Secret/i });
      expect(secretSelect).not.toBeDisabled();
    });

    it('should handle allowed_values with whitespace (e.g. "true, false")', () => {
      const fields: ScenarioField[] = [
        makeEnumField('PROXY', 'Proxy', { allowed_values: 'true, false', mutually_excludes: 'SECRET' }),
        makeEnumField('SECRET', 'Secret', { mutually_excludes: 'PROXY' }),
      ];
      const values: ScenarioFormValues = { PROXY: 'true', SECRET: 'a' };
      render(<DynamicFormBuilder fields={fields} values={values} onChange={vi.fn()} />);

      const secretSelect = screen.getByRole('combobox', { name: /Secret/i });
      expect(secretSelect).toBeDisabled();
    });

    it('should handle allowed_values with reversed order (e.g. "false,true")', () => {
      const fields: ScenarioField[] = [
        makeEnumField('PROXY', 'Proxy', { allowed_values: 'false,true', mutually_excludes: 'SECRET' }),
        makeEnumField('SECRET', 'Secret', { mutually_excludes: 'PROXY' }),
      ];
      const values: ScenarioFormValues = { PROXY: 'true', SECRET: 'a' };
      render(<DynamicFormBuilder fields={fields} values={values} onChange={vi.fn()} />);

      const secretSelect = screen.getByRole('combobox', { name: /Secret/i });
      expect(secretSelect).toBeDisabled();
    });

    it('should use default value for mutual exclusion when no explicit value', () => {
      const fields: ScenarioField[] = [
        makeEnumField('PROXY', 'Proxy', { allowed_values: 'true,false', default: 'true', mutually_excludes: 'SECRET' }),
        makeEnumField('SECRET', 'Secret', { mutually_excludes: 'PROXY' }),
      ];
      render(<DynamicFormBuilder fields={fields} values={{}} onChange={vi.fn()} />);

      const secretSelect = screen.getByRole('combobox', { name: /Secret/i });
      expect(secretSelect).toBeDisabled();
    });

    it('should reset excluded field value when exclusion activates', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const fields: ScenarioField[] = [
        makeEnumField('PROXY', 'Proxy', { allowed_values: 'true,false', default: 'false', mutually_excludes: 'SECRET' }),
        makeEnumField('SECRET', 'Secret', { allowed_values: 'app-mgr,workmgr', default: 'app-mgr', mutually_excludes: 'PROXY' }),
      ];
      const values: ScenarioFormValues = { PROXY: 'false', SECRET: 'workmgr' };
      render(<DynamicFormBuilder fields={fields} values={values} onChange={onChange} />);

      const proxyToggle = screen.getByRole('checkbox', { name: /Proxy/i });
      await user.click(proxyToggle);

      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(lastCall.PROXY).toBe('true');
      expect(lastCall.SECRET).toBe('app-mgr');
    });

    it('should render boolean enum as a Switch toggle', () => {
      const fields: ScenarioField[] = [
        makeEnumField('TOGGLE', 'My Toggle', { allowed_values: 'true,false', default: 'false' }),
      ];
      render(<DynamicFormBuilder fields={fields} values={{}} onChange={vi.fn()} />);

      expect(screen.getByRole('checkbox', { name: /My Toggle/i })).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });
  });

  describe('group fields excluded from form values', () => {
    it('should not include group fields in onChange initial values', () => {
      const onChange = vi.fn();
      const fields: ScenarioField[] = [
        makeGroupField('G1', 'Group', 'Desc'),
        makeEnumField('F1', 'Field 1', { group: 'G1', default: 'a' }),
      ];
      render(<DynamicFormBuilder fields={fields} values={{}} onChange={onChange} />);

      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(lastCall).not.toHaveProperty('G1');
      expect(lastCall.F1).toBe('a');
    });
  });
});
