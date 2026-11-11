import { describe, it, expect } from 'vitest';
import {
  getFieldPreviewDisplayValue,
  getInjectedFieldPlaceholder,
  isServerInjectedField,
  MASKED_VALUE_DISPLAY,
} from '../fieldUtils';

describe('fieldUtils', () => {
  describe('isServerInjectedField', () => {
    it('returns true for cloud env vars when a credential is applied', () => {
      expect(isServerInjectedField('IBMC_URL', { appliedCloudCredName: 'ibm1' })).toBe(true);
      expect(isServerInjectedField('IBMC_APIKEY', { appliedCloudCredName: 'ibm1' })).toBe(true);
    });

    it('returns true for ES_PASSWORD when an ES config is applied', () => {
      expect(isServerInjectedField('ES_PASSWORD', { appliedEsConfigName: 'prod-es' })).toBe(true);
    });

    it('returns false when no credential or config is applied', () => {
      expect(isServerInjectedField('IBMC_APIKEY', {})).toBe(false);
    });
  });

  describe('getFieldPreviewDisplayValue', () => {
    const ibmcUrl = {
      variable: 'IBMC_URL',
      secret: false,
      default: '',
      type: 'string' as const,
    };
    const ibmcApiKey = {
      variable: 'IBMC_APIKEY',
      secret: true,
      default: '',
      type: 'string' as const,
    };

    it('masks empty cloud-injected fields instead of showing (empty)', () => {
      expect(getFieldPreviewDisplayValue(ibmcUrl, '', { appliedCloudCredName: 'ibm1' })).toBe(
        MASKED_VALUE_DISPLAY
      );
      expect(getFieldPreviewDisplayValue(ibmcApiKey, undefined, { appliedCloudCredName: 'ibm1' })).toBe(
        MASKED_VALUE_DISPLAY
      );
    });

    it('shows (empty) when no credential is applied', () => {
      expect(getFieldPreviewDisplayValue(ibmcUrl, '', {})).toBe('(empty)');
    });

    it('masks ES_PASSWORD when ES config is applied', () => {
      expect(
        getFieldPreviewDisplayValue(
          { variable: 'ES_PASSWORD', secret: true, default: '', type: 'string' },
          '',
          { appliedEsConfigName: 'prod-es' }
        )
      ).toBe(MASKED_VALUE_DISPLAY);
    });
  });

  describe('getInjectedFieldPlaceholder', () => {
    it('returns masked placeholder for externally disabled fields', () => {
      expect(
        getInjectedFieldPlaceholder('IBMC_URL', true, ['IBMC_URL', 'IBMC_APIKEY'])
      ).toBe(MASKED_VALUE_DISPLAY);
    });

    it('returns undefined when field is not externally disabled', () => {
      expect(getInjectedFieldPlaceholder('IBMC_URL', true, [])).toBeUndefined();
      expect(getInjectedFieldPlaceholder('IBMC_URL', false, ['IBMC_URL'])).toBeUndefined();
    });
  });
});
