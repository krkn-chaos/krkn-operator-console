export function isActiveAIRunPhase(phase: string): boolean {
  return phase === 'Pending' || phase === 'Provisioning' || phase === 'Running' || phase === 'Cancelling';
}

export function isTerminalAIRunPhase(phase: string): boolean {
  return phase === 'Succeeded' || phase === 'Failed' || phase === 'Cancelled';
}

export function canCancelAIRunPhase(phase: string): boolean {
  return isActiveAIRunPhase(phase) && phase !== 'Cancelling';
}

export function isActiveScenarioPhase(phase: string): boolean {
  return phase === 'Creating' || isActiveAIRunPhase(phase);
}

export function isTerminalScenarioPhase(phase: string): boolean {
  return isTerminalAIRunPhase(phase) || phase === 'Complete' || phase === 'Completed' || phase === 'Stopped';
}
