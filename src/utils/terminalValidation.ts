/**
 * Terminal Command Validation Utility
 *
 * Provides client-side validation for kubectl commands before sending to backend.
 * Improves UX by catching errors early instead of waiting for backend rejection.
 *
 * **Validation Rules:**
 * - Only read-only commands allowed (get, describe, logs, etc.)
 * - Write operations blocked (apply, create, delete, etc.)
 * - Streaming flags blocked (--watch, --follow)
 *
 * @module terminalValidation
 */

/**
 * List of allowed read-only kubectl commands
 */
const ALLOWED_COMMANDS = new Set([
  'get',
  'describe',
  'logs',
  'top',
  'explain',
  'version',
  'api-resources',
  'api-versions',
  'cluster-info',
  'config',
  'help',
]);

/**
 * List of blocked write-operation commands
 */
const BLOCKED_COMMANDS = new Set([
  'apply',
  'create',
  'delete',
  'edit',
  'patch',
  'replace',
  'scale',
  'autoscale',
  'rollout',
  'set',
  'label',
  'annotate',
  'expose',
  'run',
  'attach',
  'exec',
  'port-forward',
  'proxy',
  'cp',
  'drain',
  'cordon',
  'uncordon',
  'taint',
]);

/**
 * List of blocked streaming flags (not supported in v1)
 */
const BLOCKED_FLAGS = new Set(['--watch', '-w', '--follow', '-f', '--watch-only']);

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * Parse kubectl command to extract subcommand and flags
 *
 * @param command - Full kubectl command string
 * @returns Object containing subcommand and flags
 *
 * @example
 * ```typescript
 * parseCommand('kubectl get pods -n default')
 * // Returns: { subcommand: 'get', flags: ['-n', 'default'] }
 * ```
 */
function parseCommand(command: string): { subcommand: string | null; flags: string[] } {
  const trimmed = command.trim();
  const parts = trimmed.split(/\s+/);

  // Remove 'kubectl' if present
  const commandParts = parts[0] === 'kubectl' ? parts.slice(1) : parts;

  if (commandParts.length === 0) {
    return { subcommand: null, flags: [] };
  }

  const subcommand = commandParts[0];
  const flags = commandParts.slice(1);

  return { subcommand, flags };
}

/**
 * Check if any blocked flags are present in the command
 *
 * @param flags - Array of command flags
 * @returns First blocked flag found, or null if none
 */
function findBlockedFlag(flags: string[]): string | null {
  for (const flag of flags) {
    // Check exact match or flag with value (e.g., --watch=true)
    const flagName = flag.split('=')[0];
    if (BLOCKED_FLAGS.has(flagName)) {
      return flagName;
    }
  }
  return null;
}

/**
 * Validate kubectl command
 *
 * Checks if command is allowed based on:
 * 1. Subcommand is in allowed list
 * 2. No blocked flags present
 *
 * **Why Validation:**
 * - Streaming commands (--watch, --follow) not supported in v1
 * - Write operations not permitted for security
 * - Improves UX by catching errors early
 *
 * @param command - Full kubectl command string
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```typescript
 * // Valid command
 * validateCommand('kubectl get pods -n default')
 * // Returns: { valid: true }
 *
 * // Invalid command - blocked flag
 * validateCommand('kubectl get pods --watch')
 * // Returns: { valid: false, error: 'Streaming commands...', suggestion: 'Remove --watch' }
 *
 * // Invalid command - write operation
 * validateCommand('kubectl delete pod nginx')
 * // Returns: { valid: false, error: 'Write operations not permitted' }
 * ```
 */
export function validateCommand(command: string): ValidationResult {
  if (!command || !command.trim()) {
    return {
      valid: false,
      error: 'Command cannot be empty',
    };
  }

  const { subcommand, flags } = parseCommand(command);

  if (!subcommand) {
    return {
      valid: false,
      error: 'Invalid command format',
      suggestion: 'Start with a kubectl command (e.g., "kubectl get pods")',
    };
  }

  // Check for blocked flags first (higher priority)
  const blockedFlag = findBlockedFlag(flags);
  if (blockedFlag) {
    return {
      valid: false,
      error: `Streaming commands (${blockedFlag}) are not supported in this version`,
      suggestion: `Remove ${blockedFlag} flag and run the command without streaming`,
    };
  }

  // Check if command is blocked
  if (BLOCKED_COMMANDS.has(subcommand)) {
    return {
      valid: false,
      error: `Write operations (${subcommand}) are not permitted`,
      suggestion: 'Only read-only kubectl commands are allowed (get, describe, logs, etc.)',
    };
  }

  // Check if command is allowed
  if (!ALLOWED_COMMANDS.has(subcommand)) {
    return {
      valid: false,
      error: `Command "${subcommand}" is not recognized or not allowed`,
      suggestion: 'Use read-only commands: get, describe, logs, top, explain, version, etc.',
    };
  }

  return { valid: true };
}

/**
 * Get list of allowed commands for auto-completion
 *
 * @returns Array of allowed command names
 */
export function getAllowedCommands(): string[] {
  return Array.from(ALLOWED_COMMANDS).sort();
}

/**
 * Check if a command is a write operation
 *
 * @param subcommand - Kubectl subcommand
 * @returns True if command is a write operation
 */
export function isWriteCommand(subcommand: string): boolean {
  return BLOCKED_COMMANDS.has(subcommand);
}

/**
 * Check if a command contains streaming flags
 *
 * @param command - Full kubectl command string
 * @returns True if command contains streaming flags
 */
export function hasStreamingFlags(command: string): boolean {
  const { flags } = parseCommand(command);
  return findBlockedFlag(flags) !== null;
}
