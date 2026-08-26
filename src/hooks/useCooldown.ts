import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Hook that manages a countdown cooldown timer.
 * Returns the remaining seconds and a function to start the cooldown.
 */
export function useCooldown(): [cooldownSeconds: number, startCooldown: (seconds: number) => void] {
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = useCallback((seconds: number) => {
    setCooldownSeconds(seconds);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return [cooldownSeconds, startCooldown];
}
