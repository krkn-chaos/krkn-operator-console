import { describe, expect, it } from 'vitest';
import { isValidFileType, normalizeFileType } from './fileType';

describe('normalizeFileType', () => {
  it.each([
    { input: 'alerts', expected: 'alerts' },
    { input: '  Metrics  ', expected: 'metrics' },
    { input: 'Kube Config', expected: 'kube-config' },
    { input: 'alerts/prod', expected: 'alerts-prod' },
    { input: '--alerts--', expected: 'alerts' },
    { input: 'a'.repeat(70), expected: 'a'.repeat(63) },
  ])('normalizes $input to $expected', ({ input, expected }) => {
    expect(normalizeFileType(input)).toBe(expected);
  });
});

describe('isValidFileType', () => {
  it.each([
    { input: '', expected: true, name: 'empty (untyped)' },
    { input: '   ', expected: true, name: 'blank (untyped)' },
    { input: 'alerts', expected: true, name: 'simple name' },
    { input: 'Kube Config', expected: true, name: 'normalizable text' },
    { input: '!!!', expected: false, name: 'no letters or numbers' },
    { input: ' -_- ', expected: false, name: 'punctuation only' },
  ])('$name is $expected', ({ input, expected }) => {
    expect(isValidFileType(input)).toBe(expected);
  });
});
