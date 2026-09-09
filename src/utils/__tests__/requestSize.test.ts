import { describe, it, expect } from 'vitest';
import {
  MAX_REQUEST_BODY_BYTES,
  MAX_REQUEST_BODY_LABEL,
  getJsonBodySize,
  exceedsRequestBodyLimit,
} from '../requestSize';

describe('requestSize', () => {
  it('exposes the 10MB limit as binary megabytes', () => {
    expect(MAX_REQUEST_BODY_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_REQUEST_BODY_LABEL).toBe('10MB');
  });

  describe('getJsonBodySize', () => {
    it('measures the serialized JSON body length', () => {
      // JSON.stringify({ a: 'bc' }) === '{"a":"bc"}' -> 10 bytes
      expect(getJsonBodySize({ a: 'bc' })).toBe(10);
    });

    it('counts UTF-8 multi-byte characters by their byte length', () => {
      // '€' is 3 bytes in UTF-8; JSON.stringify('€') === '"€"' -> 5 bytes
      expect(getJsonBodySize('€')).toBe(5);
    });
  });

  describe('exceedsRequestBodyLimit', () => {
    it('returns false for payloads within the limit', () => {
      expect(exceedsRequestBodyLimit({ content: 'small' })).toBe(false);
    });

    it('returns false for a payload exactly at the limit', () => {
      // Build a string whose serialized body is exactly the limit.
      // JSON.stringify(str) adds 2 bytes for the surrounding quotes.
      const content = 'a'.repeat(MAX_REQUEST_BODY_BYTES - 2);
      expect(getJsonBodySize(content)).toBe(MAX_REQUEST_BODY_BYTES);
      expect(exceedsRequestBodyLimit(content)).toBe(false);
    });

    it('returns true for a payload one byte over the limit', () => {
      const content = 'a'.repeat(MAX_REQUEST_BODY_BYTES - 1);
      expect(getJsonBodySize(content)).toBe(MAX_REQUEST_BODY_BYTES + 1);
      expect(exceedsRequestBodyLimit(content)).toBe(true);
    });
  });
});
