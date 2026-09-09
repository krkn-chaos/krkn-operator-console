import type { ScenarioReference } from '../types/api';

/** Creates and validates the only scenario representation accepted by run APIs. */
export function createScenarioReference(
  name: string,
  isPrivate: boolean,
  registryName?: string,
): ScenarioReference {
  const trimmedName = name.trim();
  const trimmedRegistry = registryName?.trim();

  if (!trimmedName) {
    throw new Error('Scenario name is required');
  }
  if (isPrivate && !trimmedRegistry) {
    throw new Error('A private scenario requires an accessible registry');
  }
  if (!isPrivate && trimmedRegistry) {
    throw new Error('Public scenarios cannot specify a registry');
  }

  return isPrivate
    ? { name: trimmedName, private: true, registryName: trimmedRegistry }
    : { name: trimmedName, private: false };
}

export function validateScenarioReference(scenario: ScenarioReference): string | undefined {
  try {
    createScenarioReference(scenario.name, scenario.private, scenario.registryName);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid scenario reference';
  }
}
