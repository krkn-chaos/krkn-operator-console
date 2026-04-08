import type { ScenarioField } from './api';

// Provider information from GET /providers
export interface ProviderInfo {
  name: string;
  active: boolean;
  lastHeartbeat: string | null;
}

export interface ListProvidersResponse {
  providers: ProviderInfo[];
}

// Update provider status PATCH /providers/{name}
export interface UpdateProviderStatusRequest {
  active: boolean;
}

export interface UpdateProviderStatusResponse {
  message: string;
  name: string;
  active: boolean;
}

// Provider config request POST /provider-config
export interface CreateProviderConfigResponse {
  uuid: string;
}

// JSON Schema types (for krkn-operator style schemas)
export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object';
  description?: string;
  default?: string | number | boolean | Record<string, unknown>;
  pattern?: string;
  properties?: { [key: string]: JsonSchemaProperty };
}

export interface JsonSchema {
  type: 'object';
  properties: { [key: string]: JsonSchemaProperty };
}

// Custom schema format (for krkn-operator-acm style schemas)
// Maps to ScenarioField but uses numeric type codes or string type names
export interface CustomSchemaField {
  name: string;
  short_description?: string;
  description: string;
  variable: string;
  type: number | string; // Numeric: 1=string, 2=number, 3=enum, 4=boolean OR String: "string", "number", "enum", "boolean"
  default?: string;
  separator?: string;
  allowed_values?: string;
  required?: boolean;
  secret?: boolean; // For password fields
}

// Provider config data from GET /provider-config/{uuid}
export interface ProviderConfigData {
  'config-map': string;
  namespace: string;
  'config-schema': string; // JSON string - needs parsing
}

export interface GetProviderConfigResponse {
  uuid: string;
  status: 'pending' | 'Completed';
  config_data: {
    [providerName: string]: ProviderConfigData;
  };
}

// Normalized provider schema (after parsing)
export interface ProviderSchema {
  configMap: string;
  namespace: string;
  fields: ScenarioField[]; // Normalized to ScenarioField format
}

// Submit provider config POST /provider-config/{uuid}
export interface SubmitProviderConfigRequest {
  provider_name: string;
  values: { [key: string]: string }; // All values as strings
}

export interface SubmitProviderConfigResponse {
  message: string;
  updatedFields: string[];
}

// Error responses
export interface ProviderErrorResponse {
  error: string;
  message: string;
}
