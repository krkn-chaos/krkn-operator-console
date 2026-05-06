import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { operatorApi } from '../operatorApi';
import type {
  ScenariosRequest,
  ScenariosResponse,
  ScenarioDetail,
  ScenarioGlobals,
} from '../../types/api';

const mockFetch = vi.fn();

describe('OperatorApi - Registry Methods', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  describe('getScenarios', () => {
    it('should fetch scenarios with public registry (empty request)', async () => {
      const mockResponse: ScenariosResponse = {
        scenarios: [
          {
            name: 'pod-scenarios',
            digest: 'sha256:abc123',
          },
          {
            name: 'node-scenarios',
            digest: 'sha256:def456',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: ScenariosRequest = {};
      const result = await operatorApi.getScenarios(request);

      // Verify fetch was called with scenarios endpoint
      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain('/scenarios');
      expect(fetchCall[1].method).toBe('POST');
      expect(fetchCall[1].body).toBe(JSON.stringify(request));

      expect(result).toEqual(mockResponse);
      expect(result.scenarios).toHaveLength(2);
    });

    it('should fetch scenarios with private registry credentials', async () => {
      const mockResponse: ScenariosResponse = {
        scenarios: [
          {
            name: 'custom-scenario',
            digest: 'sha256:xyz789',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: ScenariosRequest = {
        registryName: 'test-registry',
      };

      const result = await operatorApi.getScenarios(request);

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain('/scenarios');
      expect(fetchCall[1].method).toBe('POST');
      expect(result).toEqual(mockResponse);
    });

    it('should fetch scenarios with private registry token', async () => {
      const mockResponse: ScenariosResponse = {
        scenarios: [
          {
            name: 'token-scenario',
            digest: 'sha256:token123',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: ScenariosRequest = {
        registryName: 'private-registry',
      };

      const result = await operatorApi.getScenarios(request);

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain('/scenarios');
      expect(fetchCall[1].method).toBe('POST');
      expect(result).toEqual(mockResponse);
    });

    it('should handle skipTls and insecure flags', async () => {
      const mockResponse: ScenariosResponse = {
        scenarios: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: ScenariosRequest = {
        registryName: 'insecure-registry',
      };

      await operatorApi.getScenarios(request);
    });

    it('should handle API errors when fetching scenarios', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Authentication failed' }),
      });

      const request: ScenariosRequest = {
        registryName: 'wrong-registry',
      };

      await expect(operatorApi.getScenarios(request)).rejects.toThrow();
    });

    it('should handle empty scenarios list', async () => {
      const mockResponse: ScenariosResponse = {
        scenarios: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await operatorApi.getScenarios({});

      expect(result.scenarios).toHaveLength(0);
    });
  });

  describe('getScenarioDetail', () => {
    it('should fetch scenario detail with public registry', async () => {
      const mockDetail: ScenarioDetail = {
        name: 'pod-scenarios',
        title: 'Pod Scenarios',
        description: 'Kill random pods',
        digest: 'sha256:abc123',
        fields: [
          {
            name: 'NAMESPACE',
            variable: 'NAMESPACE',
            short_description: 'Target namespace',
            description: 'Target namespace',
            title: 'Namespace',
            type: 'string',
            required: true,
          },
          {
            name: 'KILL_COUNT',
            variable: 'KILL_COUNT',
            short_description: 'Number of pods to kill',
            description: 'Number of pods to kill',
            title: 'Kill Count',
            type: 'number',
            required: false,
            default: '1',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDetail,
      });

      const result = await operatorApi.getScenarioDetail('pod-scenarios', {});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/scenarios/detail/pod-scenarios'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
      expect(result).toEqual(mockDetail);
      expect(result.fields).toHaveLength(2);
    });

    it('should fetch scenario detail with private registry credentials', async () => {
      const mockDetail: ScenarioDetail = {
        name: 'custom-scenario',
        title: 'Custom Scenario',
        description: 'Custom chaos scenario',
        digest: 'sha256:custom123',
        fields: [
          {
            name: 'TARGET',
            variable: 'TARGET',
            short_description: 'Target resource',
            description: 'Target resource',
            title: 'Target',
            type: 'string',
            required: true,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDetail,
      });

      const request: ScenariosRequest = {
        registryName: 'custom-registry',
      };

      const result = await operatorApi.getScenarioDetail('custom-scenario', request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/scenarios/detail/custom-scenario'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request),
        })
      );
      expect(result).toEqual(mockDetail);
    });

    it('should encode scenario name in URL', async () => {
      const mockDetail: ScenarioDetail = {
        name: 'scenario/with/slashes',
        title: 'Test',
        description: 'Test',
        digest: 'sha256:test',
        fields: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDetail,
      });

      await operatorApi.getScenarioDetail('scenario/with/slashes', {});

      const fetchCall = mockFetch.mock.calls[0][0];
      expect(fetchCall).toContain(encodeURIComponent('scenario/with/slashes'));
    });

    it('should handle different field types', async () => {
      const mockDetail: ScenarioDetail = {
        name: 'complex-scenario',
        title: 'Complex Scenario',
        description: 'Scenario with various field types',
        digest: 'sha256:complex',
        fields: [
          {
            name: 'TEXT_FIELD',
            variable: 'TEXT_FIELD',
            short_description: 'Text input',
            description: 'Text input',
            title: 'Text Field',
            type: 'string',
            required: true,
          },
          {
            name: 'NUMBER_FIELD',
            variable: 'NUMBER_FIELD',
            short_description: 'Number input',
            description: 'Number input',
            title: 'Number Field',
            type: 'number',
            required: false,
            default: '10',
          },
          {
            name: 'BOOLEAN_FIELD',
            variable: 'BOOLEAN_FIELD',
            short_description: 'Boolean toggle',
            description: 'Boolean toggle',
            title: 'Boolean Field',
            type: 'boolean',
            required: false,
            default: 'false',
          },
          {
            name: 'SECRET_FIELD',
            variable: 'SECRET_FIELD',
            short_description: 'Secret value',
            description: 'Secret value',
            title: 'Secret Field',
            type: 'string',
            required: true,
            secret: true,
          },
          {
            name: 'DROPDOWN_FIELD',
            variable: 'DROPDOWN_FIELD',
            short_description: 'Select option',
            description: 'Select option',
            title: 'Dropdown Field',
            type: 'enum',
            required: true,
            separator: ',',
            allowed_values: 'option1,option2',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDetail,
      });

      const result = await operatorApi.getScenarioDetail('complex-scenario', {});

      expect(result.fields).toHaveLength(5);
      expect(result.fields[0].type).toBe('string');
      expect(result.fields[1].type).toBe('number');
      expect(result.fields[2].type).toBe('boolean');
      expect(result.fields[3].secret).toBe(true);
      expect(result.fields[4].type).toBe('enum');
      if (result.fields[4].type === 'enum') {
        expect(result.fields[4].allowed_values).toBe('option1,option2');
      }
    });

    it('should handle API errors when fetching scenario detail', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Scenario not found' }),
      });

      await expect(
        operatorApi.getScenarioDetail('nonexistent-scenario', {})
      ).rejects.toThrow();
    });
  });

  describe('getScenarioGlobals', () => {
    it('should fetch global parameters with public registry', async () => {
      const mockGlobals: ScenarioGlobals = {
        name: 'pod-scenarios',
        title: 'Global Parameters',
        description: 'Common parameters for all scenarios',
        fields: [
          {
            name: 'KRAKEN_PROMETHEUS_URL',
            variable: 'KRAKEN_PROMETHEUS_URL',
            short_description: 'Prometheus URL',
            description: 'Prometheus URL',
            title: 'Prometheus URL',
            type: 'string',
            required: false,
            default: '',
          },
          {
            name: 'ENABLE_ALERTS',
            variable: 'ENABLE_ALERTS',
            short_description: 'Enable alerting',
            description: 'Enable alerting',
            title: 'Enable Alerts',
            type: 'boolean',
            required: false,
            default: 'false',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGlobals,
      });

      const result = await operatorApi.getScenarioGlobals('pod-scenarios', {});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/scenarios/globals/pod-scenarios'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
      expect(result).toEqual(mockGlobals);
      expect(result.fields).toHaveLength(2);
    });

    it('should fetch global parameters with private registry', async () => {
      const mockGlobals: ScenarioGlobals = {
        name: 'custom-scenario',
        title: 'Custom Globals',
        description: 'Custom global parameters',
        fields: [
          {
            name: 'CUSTOM_PARAM',
            variable: 'CUSTOM_PARAM',
            short_description: 'Custom parameter',
            description: 'Custom parameter',
            title: 'Custom Param',
            type: 'string',
            required: false,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGlobals,
      });

      const request: ScenariosRequest = {
        registryName: 'private-registry',
      };

      const result = await operatorApi.getScenarioGlobals('custom-scenario', request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/scenarios/globals/custom-scenario'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request),
        })
      );
      expect(result).toEqual(mockGlobals);
    });

    it('should encode scenario name in URL for globals', async () => {
      const mockGlobals: ScenarioGlobals = {
        name: 'scenario:with:colons',
        title: 'Globals',
        description: 'Global params',
        fields: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGlobals,
      });

      await operatorApi.getScenarioGlobals('scenario:with:colons', {});

      const fetchCall = mockFetch.mock.calls[0][0];
      expect(fetchCall).toContain(encodeURIComponent('scenario:with:colons'));
    });

    it('should handle empty global parameters', async () => {
      const mockGlobals: ScenarioGlobals = {
        name: 'simple-scenario',
        title: 'No Globals',
        description: 'Scenario with no global parameters',
        fields: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGlobals,
      });

      const result = await operatorApi.getScenarioGlobals('simple-scenario', {});

      expect(result.fields).toHaveLength(0);
    });

    it('should handle API errors when fetching globals', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' }),
      });

      await expect(
        operatorApi.getScenarioGlobals('scenario', {})
      ).rejects.toThrow();
    });
  });

  describe('Registry authentication scenarios', () => {
    it('should handle scenarios with private registry name', async () => {
      const mockResponse: ScenariosResponse = {
        scenarios: [{ name: 'test', digest: 'sha256:test' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: ScenariosRequest = {
        registryName: 'my-private-registry',
      };

      await operatorApi.getScenarios(request);

      const callBody = JSON.parse(
        mockFetch.mock.calls[0][1].body
      );
      expect(callBody.registryName).toBe('my-private-registry');
    });

    it('should handle scenarios with public registry (no registryName)', async () => {
      const mockResponse: ScenariosResponse = {
        scenarios: [{ name: 'test', digest: 'sha256:test' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: ScenariosRequest = {};

      await operatorApi.getScenarios(request);

      const callBody = JSON.parse(
        mockFetch.mock.calls[0][1].body
      );
      expect(callBody.registryName).toBeUndefined();
    });
  });

  describe('Network error handling', () => {
    it('should handle network errors when fetching scenarios', async () => {
      mockFetch.mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(operatorApi.getScenarios({})).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(
        new Error('Request timeout')
      );

      await expect(
        operatorApi.getScenarioDetail('pod-scenarios', {})
      ).rejects.toThrow('Request timeout');
    });

    it('should handle connection refused errors', async () => {
      mockFetch.mockRejectedValueOnce(
        new Error('Connection refused')
      );

      await expect(
        operatorApi.getScenarioGlobals('pod-scenarios', {})
      ).rejects.toThrow('Connection refused');
    });
  });
});
