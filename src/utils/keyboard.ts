import type { KeyboardEvent } from 'react';

/** Runs an action for plain Enter on supported form controls, excluding search inputs. */
export function runOnEnterFromFormControl(
  event: KeyboardEvent<HTMLElement>,
  action: () => void,
): void {
  if (event.key !== 'Enter' || event.shiftKey) return;

  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;
  if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'search') return;

  event.preventDefault();
  action();
}
