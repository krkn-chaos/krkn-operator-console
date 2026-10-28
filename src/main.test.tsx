import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_STORAGE_KEYS } from './types/auth';

const { createRootMock, workerStartMock } = vi.hoisted(() => {
  const renderMock = vi.fn();

  return {
    createRootMock: vi.fn(() => ({ render: renderMock })),
    workerStartMock: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('react-dom/client', () => ({
  default: { createRoot: createRootMock },
}));

vi.mock('./AppRouter', () => ({ AppRouter: () => null }));
vi.mock('./context/AppContext', () => ({ AppProvider: () => null }));
vi.mock('./context/AuthContext', () => ({ AuthProvider: () => null }));
vi.mock('./mocks/browser', () => ({
  worker: { start: workerStartMock },
}));

describe('console startup preview authentication', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_PREVIEW_MODE', 'true');
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '<div id="root"></div>';
    createRootMock.mockClear();
    workerStartMock.mockClear();
    workerStartMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('stores preview authentication in localStorage during startup', async () => {
    const startedAt = Date.now();

    await import('./main');
    await vi.waitFor(() => expect(createRootMock).toHaveBeenCalledOnce());

    expect(workerStartMock).toHaveBeenCalledOnce();
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN)).toBe('mock-preview-jwt-token');
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.USER_EMAIL)).toBe('admin@preview.local');
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.USER_ROLE)).toBe('admin');
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.USER_NAME)).toBe('Preview');
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.USER_SURNAME)).toBe('User');
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.USER_ORGANIZATION)).toBe('Krkn');

    const expiresAt = localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT);
    expect(expiresAt).not.toBeNull();
    expect(Date.parse(expiresAt!)).toBeGreaterThan(startedAt + 23 * 60 * 60 * 1000);
    expect(Date.parse(expiresAt!)).toBeLessThan(startedAt + 25 * 60 * 60 * 1000);

    for (const key of [
      AUTH_STORAGE_KEYS.TOKEN,
      AUTH_STORAGE_KEYS.USER_EMAIL,
      AUTH_STORAGE_KEYS.USER_ROLE,
      AUTH_STORAGE_KEYS.USER_NAME,
      AUTH_STORAGE_KEYS.USER_SURNAME,
      AUTH_STORAGE_KEYS.USER_ORGANIZATION,
      AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT,
    ]) {
      expect(sessionStorage.getItem(key)).toBeNull();
    }
  });
});
