/**
 * Robot token status helpers
 *
 * Derives a displayable state for a robot's MCP token and formats expiry
 * timestamps for humans. Used by the MCP Robots admin UI.
 */

import type { RobotDetails } from '../types/api';

/**
 * Display state of a robot's token.
 *
 * - `disabled` — robot is disabled; token state is irrelevant until re-enabled
 * - `none` — robot has no token (tokenId is empty)
 * - `expired` — token expiry has passed (now >= tokenExpiresAt)
 * - `expiring` — token expires within the warning window (14 days)
 * - `active` — token valid with more than the warning window remaining
 */
export type RobotTokenState = 'active' | 'expiring' | 'expired' | 'none' | 'disabled';

/** Number of days before expiry at which a token is considered "expiring" */
const EXPIRING_WINDOW_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Derive the display state of a robot's token.
 *
 * Precedence: disabled → none → expired → expiring → active.
 * A robot with no expiry timestamp on its token is treated as active.
 *
 * @param robot - Robot details (uses disabled, tokenId, tokenExpiresAt)
 * @param now - Current time (injected for testability)
 * @returns The derived token state
 *
 * @example
 * ```typescript
 * const state = deriveRobotTokenState(robot, new Date());
 * if (state === 'expiring' || state === 'expired') { /* warn admin *\/ }
 * ```
 */
export function deriveRobotTokenState(robot: RobotDetails, now: Date): RobotTokenState {
  if (robot.disabled) {
    return 'disabled';
  }
  if (!robot.tokenId) {
    return 'none';
  }
  if (!robot.tokenExpiresAt) {
    return 'active';
  }
  const expiresAt = new Date(robot.tokenExpiresAt).getTime();
  if (Number.isNaN(expiresAt)) {
    return 'active';
  }
  if (now.getTime() >= expiresAt) {
    return 'expired';
  }
  if (expiresAt - now.getTime() < EXPIRING_WINDOW_DAYS * DAY_MS) {
    return 'expiring';
  }
  return 'active';
}

/**
 * Format a token expiry timestamp as a human-readable relative string.
 *
 * @param expiresAt - ISO timestamp of expiry
 * @param now - Current time (injected for testability)
 * @returns Human phrase like "in 5 days", "in 3 hours", "expired 2 days ago"
 *
 * @example
 * ```typescript
 * formatExpiry(robot.tokenExpiresAt, new Date()); // "in 13 days"
 * ```
 */
export function formatExpiry(expiresAt: string, now: Date): string {
  const expiryMs = new Date(expiresAt).getTime();
  const diffMs = expiryMs - now.getTime();
  const past = diffMs < 0;
  const absMs = Math.abs(diffMs);

  const minutes = Math.round(absMs / (60 * 1000));
  const hours = Math.floor(absMs / (60 * 60 * 1000));
  const days = Math.floor(absMs / DAY_MS);

  let unit: string;
  if (days >= 1) {
    unit = days === 1 ? '1 day' : `${days} days`;
  } else if (hours >= 1) {
    unit = hours === 1 ? '1 hour' : `${hours} hours`;
  } else {
    unit = minutes <= 1 ? 'less than a minute' : `${minutes} minutes`;
  }

  return past ? `expired ${unit} ago` : `in ${unit}`;
}
