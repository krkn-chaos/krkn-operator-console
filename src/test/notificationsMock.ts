import { vi } from 'vitest';
import type { useNotifications } from '../hooks/useNotifications';

type NotificationsMock = ReturnType<typeof useNotifications>;

/**
 * Builds a useNotifications() mock return value for tests.
 *
 * Callers supply their own showSuccess/showError spies so assertions can
 * target them directly; the remaining, rarely-asserted-on methods default
 * to no-op vi.fn() stubs.
 */
export function createNotificationsMock(overrides: {
  showSuccess?: NotificationsMock['showSuccess'];
  showError?: NotificationsMock['showError'];
} = {}): NotificationsMock {
  return {
    showNotification: vi.fn(),
    showSuccess: overrides.showSuccess ?? vi.fn(),
    showError: overrides.showError ?? vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    hideNotification: vi.fn(),
  };
}
