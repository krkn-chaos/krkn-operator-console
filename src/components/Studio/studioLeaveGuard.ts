/**
 * Module-level ref for Studio leave guard.
 * Studio registers a guard function on mount; App.tsx calls it before navigating away.
 */
export const studioLeaveGuard: { current: (() => boolean) | null } = { current: null };
