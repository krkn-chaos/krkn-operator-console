/**
 * Module-level ref for Studio leave guard.
 * Studio registers a guard function on mount; App.tsx calls it before navigating away.
 *
 * The guard receives a "proceed" callback. If the canvas is clean, it returns true
 * and the caller invokes proceed() itself. If dirty, it stores the callback,
 * opens the unsaved-changes modal, and returns false — the modal handles proceed().
 */
export const studioLeaveGuard: { current: ((proceed: () => void) => boolean) | null } = { current: null };
