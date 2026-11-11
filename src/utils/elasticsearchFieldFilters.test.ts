import { describe, expect, it } from 'vitest';
import { collectFieldPaths, getFieldValue, matchesFieldFilters } from './elasticsearchFieldFilters';

const alert = {
  run_uuid: 'run-1',
  labels: { severity: 'critical', component: 'apiserver' },
  instances: [{ namespace: 'openshift-monitoring' }],
};

describe('elasticsearch field filters', () => {
  it('collects nested object and array paths', () => {
    expect(collectFieldPaths(alert)).toEqual(expect.arrayContaining([
      'run_uuid',
      'labels.severity',
      'labels.component',
      'instances[0].namespace',
    ]));
  });

  it('reads nested values by path', () => {
    expect(getFieldValue(alert, 'labels.severity')).toBe('critical');
    expect(getFieldValue(alert, 'instances[0].namespace')).toBe('openshift-monitoring');
  });

  it('reads literal dotted object keys from generated paths', () => {
    const source = { labels: { 'app.kubernetes.io/name': 'api' } };
    expect(getFieldValue(source, 'labels.app.kubernetes.io/name')).toBe('api');
    expect(matchesFieldFilters(source, [{ key: 'labels.app.kubernetes.io/name', value: 'api' }])).toBe(true);
  });

  it('requires every configured filter to match', () => {
    expect(matchesFieldFilters(alert, [
      { key: 'labels.severity', value: 'crit' },
      { key: 'labels.component', value: 'api' },
    ])).toBe(true);
    expect(matchesFieldFilters(alert, [
      { key: 'labels.severity', value: 'crit' },
      { key: 'labels.component', value: 'database' },
    ])).toBe(false);
  });
});
