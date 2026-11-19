import { describe, expect, it } from 'vitest';
import { describeTargetAvailability } from './targetAvailability';
import type { TargetResponse } from '../types/api';

function discovered(overrides: Partial<TargetResponse> = {}): TargetResponse {
  return {
    uuid: 'discovered-1',
    clusterName: 'ibm',
    clusterAPIURL: 'https://api.ibm.example:6443',
    secretType: 'kubeconfig',
    ready: true,
    ...overrides,
  };
}

const configuredTarget = {
  clusterName: 'ibm',
  clusterAPIURL: 'https://api.ibm.example:6443',
  ready: true,
};

describe('describeTargetAvailability', () => {
  it('reports availability from discovery, not from the registration flag', () => {
    const result = describeTargetAvailability(
      { ...configuredTarget, ready: true },
      [discovered({ online: false, checkedAt: '2026-11-19T10:00:00Z' })],
      null,
      false
    );

    expect(result.state).toBe('unavailable');
    expect(result.detail).toContain('API server was unreachable');
  });

  it.each([
    {
      name: 'reachable and healthy',
      cluster: discovered({ online: true, clusterStatus: 'healthy' as const }),
      expected: 'available',
    },
    {
      name: 'reachable with unknown ACM health',
      cluster: discovered({ online: true, clusterStatus: 'unknown' as const }),
      expected: 'available',
    },
    {
      name: 'reachable but unhealthy',
      cluster: discovered({ online: true, clusterStatus: 'unhealthy' as const }),
      expected: 'unavailable',
    },
    {
      name: 'offline',
      cluster: discovered({ online: false }),
      expected: 'unavailable',
    },
    {
      name: 'offline and unhealthy',
      cluster: discovered({ online: false, clusterStatus: 'unhealthy' as const }),
      expected: 'unavailable',
    },
  ])('classifies a $name cluster as $expected', ({ cluster, expected }) => {
    const result = describeTargetAvailability(configuredTarget, [cluster], null, false);

    expect(result.state).toBe(expected);
    expect(result.cluster).toBe(cluster);
  });

  it('reports a target that discovery did not return as not available', () => {
    const result = describeTargetAvailability(
      configuredTarget,
      [discovered({ clusterName: 'other', clusterAPIURL: 'https://api.other.example:6443' })],
      null,
      false
    );

    expect(result.state).toBe('not-discovered');
    expect(result.detail).toContain('Cluster discovery did not report this target');
  });

  it('explains when the target is excluded because it is not registered ready', () => {
    const result = describeTargetAvailability(
      { ...configuredTarget, ready: false },
      [],
      null,
      false
    );

    expect(result.state).toBe('not-discovered');
    expect(result.detail).toContain('not registered as ready');
  });

  it('matches discovery records by API URL before cluster name', () => {
    const local = discovered({
      clusterName: 'ibm',
      clusterAPIURL: 'https://api.ibm.example:6443',
      online: true,
    });

    const result = describeTargetAvailability(
      { ...configuredTarget, clusterAPIURL: 'https://api.ibm.example:6443/' },
      [local],
      null,
      false
    );

    expect(result.state).toBe('available');
    expect(result.cluster).toBe(local);
  });

  it('does not label a target with another provider\'s same-named cluster health', () => {
    // The local operator omitted the target from discovery, but ACM reports a
    // cluster with the same name at a different endpoint. That cluster's health
    // must not describe this target.
    const acmCluster = discovered({
      clusterName: 'ibm',
      clusterAPIURL: 'https://api.ibm-acm.example:6443',
      online: true,
      clusterStatus: 'healthy',
    });

    const result = describeTargetAvailability(configuredTarget, [acmCluster], null, false);

    expect(result.state).toBe('not-discovered');
    expect(result.cluster).toBeUndefined();
  });

  it('reports available when any operator offers the target URL as selectable', () => {
    // Core reports the endpoint offline, but an ACM record for the same URL is
    // selectable, so the picker still lets users run on the cluster.
    const offline = discovered({ online: false, checkedAt: '2026-11-19T10:00:00Z' });
    const healthy = discovered({ online: true, clusterStatus: 'healthy' });

    const result = describeTargetAvailability(
      configuredTarget,
      [offline, healthy],
      null,
      false
    );

    expect(result.state).toBe('available');
    expect(result.cluster).toBe(healthy);
  });

  it('reports checking while discovery runs or has not started', () => {
    expect(describeTargetAvailability(configuredTarget, null, null, false).state).toBe('checking');
    expect(describeTargetAvailability(configuredTarget, [], null, true).state).toBe('checking');
  });

  it('reports unknown when discovery failed', () => {
    const result = describeTargetAvailability(
      configuredTarget,
      null,
      'Discovery timeout - please try again',
      false
    );

    expect(result.state).toBe('unknown');
    expect(result.detail).toContain('Discovery timeout - please try again');
  });
});
