/**
 * Autosave utilities for Studio
 * Separated from StudioContext to avoid react-refresh warnings
 */

import type { StudioAutosave } from '../../types/api';

const AUTOSAVE_KEY = 'chaos-studio-autosave';
const AUTOSAVE_VERSION = '1.0';

// Load autosave from localStorage
export function loadAutosave(): StudioAutosave | null {
  try {
    const data = localStorage.getItem(AUTOSAVE_KEY);
    if (!data) return null;

    const autosave: StudioAutosave = JSON.parse(data);
    if (autosave.version !== AUTOSAVE_VERSION) {
      return null; // Incompatible version
    }

    return autosave;
  } catch {
    return null;
  }
}

// Clear autosave from localStorage
export function clearAutosave() {
  localStorage.removeItem(AUTOSAVE_KEY);
}

// Save autosave to localStorage
export function saveAutosave(autosave: StudioAutosave) {
  localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(autosave));
}

export { AUTOSAVE_KEY, AUTOSAVE_VERSION };
