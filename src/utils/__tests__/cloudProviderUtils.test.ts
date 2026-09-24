import { describe, it, expect } from 'vitest';
import {
  filterFieldsByCloudType,
  filterScenarioFieldsByCloudType,
  resolveEffectiveCloudType,
} from '../cloudProviderUtils';

const cloudFields = [
  { variable: 'CLOUD_TYPE', type: 'enum', short_description: 'Cloud Type' },
  { variable: 'AWS_ACCESS_KEY_ID', type: 'string', short_description: 'AWS Access Key Id[*AWS only*]' },
  { variable: 'IBMC_URL', type: 'string', short_description: 'IBM Cloud URL [*IBM Cloud only*]' },
  { variable: 'IBMC_POWER_URL', type: 'string', short_description: 'IBM Cloud Power URL [*IBM Power Cloud only*]' },
  { variable: 'IBMC_APIKEY', type: 'string', short_description: 'IBM Cloud API key [*IBM Cloud only*]' },
  { variable: 'DISABLE_SSL_VERIFICATION', type: 'enum', short_description: 'Disable SSL Verification [*IBM Cloud only*]' },
  { variable: 'BMC_ADDR', type: 'string', short_description: 'Bare Metal Cloud Username [*Bare Metal only*]' },
  { variable: 'DISKS', type: 'string', short_description: 'Disk List [*Bare Metal only*]' },
  { variable: 'TIMEOUT', type: 'number', short_description: 'Timeout' },
];

describe('cloudProviderUtils', () => {
  describe('resolveEffectiveCloudType', () => {
    const cloudTypeField = {
      type: 'enum',
      default: 'aws',
      allowed_values: 'aws,azure,gcp,vmware,ibmcloud,ibmcloudpower,bm',
      separator: ',',
    };

    it('prefers credential cloud type over form value', () => {
      expect(
        resolveEffectiveCloudType(cloudTypeField, {
          credentialCloudType: 'ibmcloud',
          formCloudType: 'aws',
        })
      ).toBe('ibmcloud');
    });

    it('uses form CLOUD_TYPE when no credential is applied', () => {
      expect(
        resolveEffectiveCloudType(cloudTypeField, {
          formCloudType: 'ibmcloud',
        })
      ).toBe('ibmcloud');
    });

    it('falls back to scenario default when form value is empty', () => {
      expect(resolveEffectiveCloudType(cloudTypeField, {})).toBe('aws');
    });
  });

  describe('filterFieldsByCloudType', () => {
    it('shows only AWS fields when cloud type is aws', () => {
      const visible = filterFieldsByCloudType(cloudFields, 'aws').map((f) => f.variable);
      expect(visible).toContain('CLOUD_TYPE');
      expect(visible).toContain('AWS_ACCESS_KEY_ID');
      expect(visible).not.toContain('IBMC_URL');
      expect(visible).not.toContain('BMC_ADDR');
      expect(visible).toContain('TIMEOUT');
    });

    it('shows only IBM Cloud fields (not IBM Power) when cloud type is ibmcloud', () => {
      const visible = filterFieldsByCloudType(cloudFields, 'ibmcloud').map((f) => f.variable);
      expect(visible).toContain('IBMC_URL');
      expect(visible).toContain('IBMC_APIKEY');
      expect(visible).toContain('DISABLE_SSL_VERIFICATION');
      expect(visible).not.toContain('IBMC_POWER_URL');
      expect(visible).not.toContain('AWS_ACCESS_KEY_ID');
      expect(visible).not.toContain('BMC_ADDR');
    });

    it('hides CLOUD_TYPE when a saved credential is applied', () => {
      const visible = filterFieldsByCloudType(cloudFields, 'ibmcloud', {
        hideCloudTypeWhenCredentialApplied: true,
        appliedCloudCredName: 'ibm-dummy',
      }).map((f) => f.variable);
      expect(visible).not.toContain('CLOUD_TYPE');
      expect(visible).toContain('IBMC_URL');
    });

    it('shows IBM Power fields when cloud type is ibmcloudpower', () => {
      const visible = filterFieldsByCloudType(cloudFields, 'ibmcloudpower').map((f) => f.variable);
      expect(visible).toContain('IBMC_POWER_URL');
      expect(visible).toContain('IBMC_APIKEY');
    });

    it('shows OpenStack OS_ fields when cloud type is openstack', () => {
      const fields = [
        ...cloudFields,
        { variable: 'OS_AUTH_URL', type: 'string', short_description: 'Auth URL [*OpenStack only*]' },
        { variable: 'OS_PASSWORD', type: 'string', short_description: 'Password [*OpenStack only*]' },
      ];
      const visible = filterFieldsByCloudType(fields, 'openstack').map((f) => f.variable);
      expect(visible).toContain('OS_AUTH_URL');
      expect(visible).toContain('OS_PASSWORD');
      expect(visible).not.toContain('AWS_ACCESS_KEY_ID');
    });

    it('leaves all fields visible for unrecognized cloud types (fail-safe)', () => {
      const visible = filterFieldsByCloudType(cloudFields, 'weird-cloud').map((f) => f.variable);
      expect(visible).toEqual(cloudFields.map((f) => f.variable));
    });

  });

  describe('filterScenarioFieldsByCloudType', () => {
    it('drops groups with no visible members after filtering', () => {
      const fields = [
        { variable: 'G_AWS', type: 'group' },
        { variable: 'AWS_ACCESS_KEY_ID', type: 'string', group: 'G_AWS' },
        { variable: 'G_IBM', type: 'group' },
        { variable: 'IBMC_URL', type: 'string', group: 'G_IBM' },
        { variable: 'TIMEOUT', type: 'number' },
      ];

      const awsVisible = filterScenarioFieldsByCloudType(fields, 'aws').map((f) => f.variable);
      expect(awsVisible).toContain('G_AWS');
      expect(awsVisible).toContain('AWS_ACCESS_KEY_ID');
      expect(awsVisible).not.toContain('G_IBM');
      expect(awsVisible).not.toContain('IBMC_URL');

      const ibmVisible = filterScenarioFieldsByCloudType(fields, 'ibmcloud').map((f) => f.variable);
      expect(ibmVisible).toContain('G_IBM');
      expect(ibmVisible).toContain('IBMC_URL');
      expect(ibmVisible).not.toContain('G_AWS');
      expect(ibmVisible).not.toContain('AWS_ACCESS_KEY_ID');
    });
  });
});
