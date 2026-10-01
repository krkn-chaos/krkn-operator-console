import type { StudioAutosave, StudioWorkflow } from '../../types/api';

export interface StudioRecoveryState {
  workflow: StudioWorkflow;
  categories: string[];
}

/** Restore the complete Studio state from an autosave, including legacy autosaves without categories. */
export function getStudioRecoveryState(autosave: Pick<StudioAutosave, 'workflow' | 'categories'>): StudioRecoveryState {
  return {
    workflow: autosave.workflow,
    categories: autosave.categories ?? [],
  };
}
