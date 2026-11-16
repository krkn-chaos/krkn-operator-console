import { useCallback, useEffect, useRef, useState } from 'react';

export type RefreshReason = 'entry' | 'tick' | 'manual' | 'visibility';

export interface KrknAIPollResult {
  active: boolean;
  retry: boolean;
}

const POLL_INTERVAL_MS = 10_000;
const MAX_RETRIES = 3;

export function isRetryableKrknAIError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') return false;
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
  return status === undefined || status === 408 || status === 429 || status === 500 || status === 503 || status === 504;
}

type Refresh = (signal: AbortSignal, reason: RefreshReason) => Promise<KrknAIPollResult>;

export function useKrknAIPolling(load: Refresh, enabled = true) {
  const refreshRef = useRef<() => void>(() => undefined);
  const [retryExhausted, setRetryExhausted] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let inFlight = false;
    let loaded = false;
    let refreshWhenVisible = false;
    let failures = 0;
    let result: KrknAIPollResult = { active: false, retry: false };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    setRetryExhausted(false);

    const clearTimer = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const schedule = () => {
      if (disposed || document.hidden) return;
      if (result.retry && failures > MAX_RETRIES) return;
      if (!result.active && !result.retry) return;
      const delay = result.retry ? POLL_INTERVAL_MS * 2 ** (failures - 1) : POLL_INTERVAL_MS;
      timer = setTimeout(() => { void refresh('tick'); }, delay);
    };
    const refresh = async (reason: RefreshReason) => {
      if (disposed || document.hidden) return;
      if (inFlight) {
        if (reason === 'visibility') refreshWhenVisible = true;
        return;
      }
      clearTimer();
      if (reason === 'manual') {
        failures = 0;
        setRetryExhausted(false);
      }
      inFlight = true;
      controller = new AbortController();
      const { signal } = controller;
      try {
        result = await load(signal, reason);
      } finally {
        inFlight = false;
        if (!disposed && !signal.aborted) {
          loaded = true;
          failures = result.retry ? failures + 1 : 0;
          setRetryExhausted(result.retry && failures > MAX_RETRIES);
          if (refreshWhenVisible && !document.hidden) {
            refreshWhenVisible = false;
            if (failures <= MAX_RETRIES && (result.active || result.retry)) void refresh('visibility');
          } else {
            schedule();
          }
        }
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        clearTimer();
      } else if (!loaded || (failures <= MAX_RETRIES && (result.active || result.retry))) {
        void refresh('visibility');
      }
    };
    refreshRef.current = () => { void refresh('manual'); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    void refresh('entry');
    return () => {
      disposed = true;
      clearTimer();
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      refreshRef.current = () => undefined;
    };
  }, [enabled, load]);

  return { refresh: useCallback(() => refreshRef.current(), []), retryExhausted };
}
