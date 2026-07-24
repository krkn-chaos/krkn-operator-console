import { describe, it, expect } from 'vitest';
import { parseCustomSchema } from '../schemaParser';

describe('parseCustomSchema', () => {
  it('should parse group type fields', () => {
    const schema = JSON.stringify([
      { name: 'G1', short_description: 'Group 1', description: 'A group', variable: 'G1', type: 'group', required: 'false', secret: 'false' },
    ]);
    const fields = parseCustomSchema(schema);
    expect(fields).toHaveLength(1);
    expect(fields[0].type).toBe('group');
    expect(fields[0].short_description).toBe('Group 1');
  });

  it('should preserve group and mutually_excludes on fields', () => {
    const schema = JSON.stringify([
      { name: 'G1', short_description: 'Group', description: 'Grp', variable: 'G1', type: 'group', required: false, secret: false },
      { name: 'F1', short_description: 'Field 1', description: 'Desc', variable: 'F1', type: 'enum', default: 'a', separator: ',', allowed_values: 'a,b', group: 'G1', mutually_excludes: 'F2', required: true, secret: false },
    ]);
    const fields = parseCustomSchema(schema);
    expect(fields[1].group).toBe('G1');
    expect(fields[1].mutually_excludes).toBe('F2');
  });

  it('should normalize string "false" to boolean false for required', () => {
    const schema = JSON.stringify([
      { name: 'F1', description: 'Desc', variable: 'F1', type: 'string', required: 'false', secret: 'false' },
    ]);
    const fields = parseCustomSchema(schema);
    expect(fields[0].required).toBe(false);
  });

  it('should normalize string "true" to boolean true for required', () => {
    const schema = JSON.stringify([
      { name: 'F1', description: 'Desc', variable: 'F1', type: 'string', required: 'true', secret: 'false' },
    ]);
    const fields = parseCustomSchema(schema);
    expect(fields[0].required).toBe(true);
  });

  it('should normalize string "false" to boolean false for secret', () => {
    const schema = JSON.stringify([
      { name: 'F1', description: 'Desc', variable: 'F1', type: 'string', required: false, secret: 'false' },
    ]);
    const fields = parseCustomSchema(schema);
    expect(fields[0].secret).toBe(false);
  });

  it('should normalize string "true" to boolean true for secret', () => {
    const schema = JSON.stringify([
      { name: 'F1', description: 'Desc', variable: 'F1', type: 'string', required: false, secret: 'true' },
    ]);
    const fields = parseCustomSchema(schema);
    expect(fields[0].secret).toBe(true);
  });

  it('should preserve boolean true/false without corruption', () => {
    const schema = JSON.stringify([
      { name: 'F1', description: 'Desc', variable: 'F1', type: 'string', required: true, secret: false },
    ]);
    const fields = parseCustomSchema(schema);
    expect(fields[0].required).toBe(true);
    expect(fields[0].secret).toBe(false);
  });

  it('should parse schemas without group/mutually_excludes (backward compat)', () => {
    const schema = JSON.stringify([
      { name: 'F1', short_description: 'Field 1', description: 'Desc', variable: 'F1', type: 'string', required: true },
    ]);
    const fields = parseCustomSchema(schema);
    expect(fields).toHaveLength(1);
    expect(fields[0].group).toBeUndefined();
    expect(fields[0].mutually_excludes).toBeUndefined();
  });
});
