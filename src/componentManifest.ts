import embeddedManifest from './component.json';
import type { ComponentManifest } from './services/componentsApi';

/** The console manifest is bundled by Vite after the release build stamps its version. */
export const consoleComponentName = 'krkn-operator-console';
export const consoleComponentManifest: ComponentManifest = embeddedManifest;
