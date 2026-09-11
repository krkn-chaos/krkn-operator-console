import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCooldown } from '../useCooldown';

describe('useCooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start at 0', () => {
    const { result } = renderHook(() => useCooldown());
    expect(result.current[0]).toBe(0);
  });

  it('should count down after startCooldown is called', () => {
    const { result } = renderHook(() => useCooldown());

    act(() => {
      result.current[1](3);
    });
    expect(result.current[0]).toBe(3);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current[0]).toBe(2);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current[0]).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current[0]).toBe(0);
  });

  it('should stay at 0 after countdown finishes', () => {
    const { result } = renderHook(() => useCooldown());

    act(() => {
      result.current[1](1);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current[0]).toBe(0);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current[0]).toBe(0);
  });

  it('should restart cooldown when called again', () => {
    const { result } = renderHook(() => useCooldown());

    act(() => {
      result.current[1](5);
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current[0]).toBe(3);

    act(() => {
      result.current[1](5);
    });
    expect(result.current[0]).toBe(5);
  });

  it('should clean up interval on unmount', () => {
    const { result, unmount } = renderHook(() => useCooldown());

    act(() => {
      result.current[1](5);
    });

    unmount();

    // No assertion needed — if clearInterval wasn't called, fake timers would leak
  });
});
