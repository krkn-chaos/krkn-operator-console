import type { ScenarioReference } from '../types/api';

/** Creates the registry-independent scenario representation accepted by run APIs. */
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
