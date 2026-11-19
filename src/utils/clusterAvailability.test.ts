import { describe, expect, it } from 'vitest';
import {
  findDiscoveredCluster,
  formatClusterCheckedAt,
  isClusterUnavailable,
  normalizeClusterApiUrl,
} from './clusterAvailability';

interface Discovered {
  clusterName: string;
  clusterAPIURL?: string;
  online?: boolean;
  clusterStatus?: 'healthy' | 'unhealthy' | 'unknown';
}

function discovered(overrides: Partial<Discovered> & { clusterName: string }): Discovered {
  return { clusterAPIURL: 'https://api.example.com:6443', ...overrides };
}

describe('isClusterUnavailable', () => {
  it.each([
    { online: false, status: undefined, expected: true },
    { online: undefined, status: 'unhealthy' as const, expected: true },
    { online: false, status: 'unhealthy' as const, expected: true },
    { online: true, status: 'healthy' as const, expected: false },
    { online: true, status: 'unknown' as const, expected: false },
    { online: undefined, status: undefined, expected: false },
  ])('online=$online clusterStatus=$status -> $expected', ({ online, status, expected }) => {
    expect(isClusterUnavailable(online, status)).toBe(expected);
  });
});

describe('normalizeClusterApiUrl', () => {
  it.each([
    { input: 'https://API.example.com:6443/', expected: 'https://api.example.com:6443' },
    { input: '  https://api.example.com:6443///  ', expected: 'https://api.example.com:6443' },
    { input: 'https://api.example.com:6443', expected: 'https://api.example.com:6443' },
    { input: undefined, expected: '' },
    { input: '', expected: '' },
  ])('normalizes $input to $expected', ({ input, expected }) => {
    expect(normalizeClusterApiUrl(input)).toBe(expected);
  });
});

describe('findDiscoveredCluster', () => {
  it('matches by normalized API URL even when the cluster was renamed', () => {
    const cluster = discovered({ clusterName: 'renamed', clusterAPIURL: 'https://api.example.com:6443' });

    expect(
      findDiscoveredCluster(
        { clusterName: 'ibm', clusterAPIURL: 'https://API.example.com:6443/' },
        [cluster]
      )
    ).toBe(cluster);
  });

  it('does not borrow another provider\'s same-named cluster when the API URL differs', () => {
    // The local operator omitted the target from discovery; ACM reports a
    // cluster with the same name but a different endpoint.
    const acmCluster = discovered({
      clusterName: 'ibm',
      clusterAPIURL: 'https://api.ibm-acm.example.com:6443',
      online: true,
    });

    expect(
      findDiscoveredCluster(
        { clusterName: 'ibm', clusterAPIURL: 'https://api.ibm.example.com:6443' },
        [acmCluster]
      )
    ).toBeUndefined();
  });

  it('falls back to the cluster name only when the target has no API URL', () => {
    const cluster = discovered({ clusterName: 'ibm', clusterAPIURL: 'https://api.ibm.example.com:6443' });

    expect(findDiscoveredCluster({ clusterName: 'ibm' }, [cluster])).toBe(cluster);
    expect(findDiscoveredCluster({ clusterName: 'ibm', clusterAPIURL: '' }, [cluster])).toBe(cluster);
  });

  it('prefers a selectable record when operators report the same API URL with different liveness', () => {
    // The picker lists each record per operator; the cluster is still runnable
    // through the selectable one, so Settings must not call it unavailable.
    const offline = discovered({ clusterName: 'ibm', online: false });
    const healthy = discovered({ clusterName: 'ibm', online: true });
    const target = { clusterName: 'ibm', clusterAPIURL: 'https://api.example.com:6443' };

    expect(findDiscoveredCluster(target, [offline, healthy])).toBe(healthy);
    expect(findDiscoveredCluster(target, [healthy, offline])).toBe(healthy);
  });

  it('returns the first record when every record for the API URL is unavailable', () => {
    const unhealthy = discovered({ clusterName: 'ibm', online: true, clusterStatus: 'unhealthy' });
    const offline = discovered({ clusterName: 'ibm', online: false });
    const target = { clusterName: 'ibm', clusterAPIURL: 'https://api.example.com:6443' };

    expect(findDiscoveredCluster(target, [unhealthy, offline])).toBe(unhealthy);
    expect(findDiscoveredCluster(target, [offline, unhealthy])).toBe(offline);
  });

  it('refuses an ambiguous name match', () => {
    const clusters = [
      discovered({ clusterName: 'ibm', clusterAPIURL: 'https://api.a.example.com:6443' }),
      discovered({ clusterName: 'ibm', clusterAPIURL: 'https://api.b.example.com:6443' }),
    ];

    expect(findDiscoveredCluster({ clusterName: 'ibm' }, clusters)).toBeUndefined();
  });

  it('returns undefined for empty or missing discovery data', () => {
    const target = { clusterName: 'ibm', clusterAPIURL: 'https://api.ibm.example.com:6443' };

    expect(findDiscoveredCluster(target, null)).toBeUndefined();
    expect(findDiscoveredCluster(target, undefined)).toBeUndefined();
    expect(findDiscoveredCluster(target, [])).toBeUndefined();
  });
});

describe('formatClusterCheckedAt', () => {
  it('returns "unknown" when no timestamp was reported', () => {
    expect(formatClusterCheckedAt(undefined)).toBe('unknown');
    expect(formatClusterCheckedAt('')).toBe('unknown');
  });

  it('returns malformed input unchanged instead of an invalid date', () => {
    expect(formatClusterCheckedAt('not-a-date')).toBe('not-a-date');
  });

  it('formats a valid timestamp with medium date and short time', () => {
    const formatted = formatClusterCheckedAt('2026-09-09T08:00:00Z');

    expect(formatted).not.toBe('2026-09-09T08:00:00Z');
    expect(formatted).not.toBe('unknown');
    expect(formatted).toBe(
      new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date('2026-09-09T08:00:00Z')
      )
    );
  });
});
