import type { ScenarioField, FieldType } from '../types/api';
import type { JsonSchema, JsonSchemaProperty, CustomSchemaField } from '../types/provider';

/**
 * Convert JSON Schema property type to ScenarioField type
 */
function mapJsonSchemaType(type: string): FieldType {
  switch (type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'string'; // Fallback to string for unknown types
  }
}

/**
 * Generate a human-readable label from a field path (e.g., "api.port" → "API Port")
 */
function generateLabel(fieldPath: string): string {
  return fieldPath
    .split('.')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Recursively flatten nested JSON Schema properties into ScenarioField array
 * @param properties - JSON Schema properties object
 * @param parentPath - Parent field path (for nested fields like "api.port")
 * @returns Array of ScenarioField objects
 */
function flattenJsonSchemaProperties(
  properties: { [key: string]: JsonSchemaProperty },
  parentPath: string = ''
): ScenarioField[] {
  const fields: ScenarioField[] = [];

  for (const [key, prop] of Object.entries(properties)) {
    const fieldPath = parentPath ? `${parentPath}.${key}` : key;

    // If property is an object with nested properties, recurse
    if (prop.type === 'object' && prop.properties) {
      fields.push(...flattenJsonSchemaProperties(prop.properties, fieldPath));
      continue;
    }

    // Map to ScenarioField
    const field: ScenarioField = {
      name: generateLabel(fieldPath),
      short_description: generateLabel(fieldPath),
      description: prop.description || `Configuration for ${fieldPath}`,
      variable: fieldPath, // Use dot notation for nested fields
      type: mapJsonSchemaType(prop.type),
      default: prop.default !== undefined ? String(prop.default) : undefined,
      required: false, // JSON Schema doesn't have required at property level in this format
    } as ScenarioField;

    // Add validator for string fields with pattern
    if (prop.type === 'string' && prop.pattern) {
      (field as any).validator = prop.pattern;
      (field as any).validation_message = `Must match pattern: ${prop.pattern}`;
    }

    fields.push(field);
  }

  return fields;
}

/**
 * Parse JSON Schema format (krkn-operator style) into ScenarioField array
 * @param schemaString - JSON string containing the schema
 * @returns Array of ScenarioField objects
 */
export function parseJsonSchema(schemaString: string): ScenarioField[] {
  try {
    console.log('Parsing JSON Schema, input length:', schemaString.length);
    const schema: JsonSchema = JSON.parse(schemaString);
    console.log('Parsed JSON Schema:', schema);

    if (!schema.properties || typeof schema.properties !== 'object') {
      console.warn('JSON Schema missing properties object');
      return [];
    }

    const fields = flattenJsonSchemaProperties(schema.properties);
    console.log('Flattened JSON Schema fields:', fields);
    return fields;
  } catch (error) {
    console.error('Failed to parse JSON Schema:', error);
    console.error('Schema string was:', schemaString);
    return [];
  }
}

/**
 * Convert custom schema field type to ScenarioField type
 * Supports both numeric and string types:
 * - Numeric: 1=string, 2=number, 3=enum, 4=boolean
 * - String: "string", "number", "enum", "boolean"
 */
function mapCustomSchemaType(type: number | string): FieldType {
  // Handle string types (new backend format)
  if (typeof type === 'string') {
    const lowerType = type.toLowerCase();
    switch (lowerType) {
      case 'string':
        return 'string';
      case 'number':
      case 'integer':
        return 'number';
      case 'enum':
        return 'enum';
      case 'boolean':
        return 'boolean';
      default:
        console.warn(`Unknown custom schema type string: ${type}, defaulting to string`);
        return 'string';
    }
  }

  // Handle numeric types (legacy format)
  switch (type) {
    case 1:
      return 'string';
    case 2:
      return 'number';
    case 3:
      return 'enum';
    case 4:
      return 'boolean';
    default:
      console.warn(`Unknown custom schema type number: ${type}, defaulting to string`);
      return 'string';
  }
}

/**
 * Parse custom schema format (krkn-operator-acm style) into ScenarioField array
 * @param schemaString - JSON string containing array of CustomSchemaField
 * @returns Array of ScenarioField objects
 */
export function parseCustomSchema(schemaString: string): ScenarioField[] {
  try {
    console.log('Parsing custom schema, input length:', schemaString.length);
    const customFields: CustomSchemaField[] = JSON.parse(schemaString);
    console.log('Parsed custom schema:', customFields);

    if (!Array.isArray(customFields)) {
      console.warn('Custom schema is not an array');
      return [];
    }

    const fields = customFields.map(customField => {
      console.log(`Mapping custom field "${customField.variable}":`, {
        inputType: customField.type,
        typeOf: typeof customField.type,
        separator: customField.separator,
        allowed_values: customField.allowed_values
      });

      const fieldType = mapCustomSchemaType(customField.type);
      console.log(`  → Mapped to fieldType: ${fieldType}`);

      const scenarioField: ScenarioField = {
        name: customField.name,
        short_description: customField.short_description || customField.description,
        description: customField.description,
        variable: customField.variable,
        type: fieldType,
        default: customField.default,
        required: customField.required,
      } as ScenarioField;

      // Add enum-specific fields
      if (fieldType === 'enum') {
        if (customField.separator && customField.allowed_values) {
          (scenarioField as any).separator = customField.separator;
          (scenarioField as any).allowed_values = customField.allowed_values;
          console.log(`  → Enum field configured with separator="${customField.separator}", allowed_values="${customField.allowed_values}"`);
        } else {
          console.error(`  → ERROR: Enum field missing separator or allowed_values!`, {
            separator: customField.separator,
            allowed_values: customField.allowed_values
          });
        }
      }

      return scenarioField;
    });

    console.log('Mapped custom schema fields:', fields);
    return fields;
  } catch (error) {
    console.error('Failed to parse custom schema:', error);
    console.error('Schema string was:', schemaString);
    return [];
  }
}

/**
 * Auto-detect schema format and parse accordingly
 * @param schemaString - JSON string containing either JSON Schema or custom format
 * @returns Array of ScenarioField objects
 */
export function parseSchema(schemaString: string): ScenarioField[] {
  try {
    console.log('Auto-detecting schema format...');
    const parsed = JSON.parse(schemaString);
    console.log('Parsed schema object:', parsed);

    // Detect format by structure
    if (Array.isArray(parsed)) {
      // Custom format (array of fields)
      console.log('Detected custom schema format (array)');
      return parseCustomSchema(schemaString);
    } else if (parsed.type === 'object' && parsed.properties) {
      // JSON Schema format
      console.log('Detected JSON Schema format');
      return parseJsonSchema(schemaString);
    } else {
      console.warn('Unknown schema format, attempting JSON Schema parsing');
      console.warn('Parsed object:', parsed);
      return parseJsonSchema(schemaString);
    }
  } catch (error) {
    console.error('Failed to auto-detect schema format:', error);
    console.error('Schema string was:', schemaString);
    return [];
  }
}
