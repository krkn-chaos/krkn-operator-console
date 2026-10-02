import { describe, it, expect } from 'vitest';
import { parseImportedWorkflow, reconstructWorkflowFromGraph, buildStudioExport } from './studioImport';
import type { StudioWorkflow, GraphScenarioNode } from '../../types/api';

/** A small, fully-configured studio workflow used across the lossless tests. */
const sampleWorkflow: StudioWorkflow = {
  nodes: [
    {
      nodeId: 'node-alpha',
      status: 'configured',
      position: { x: 100, y: 200 },
      config: {
        registryType: 'public',
        registryConfig: {},
        scenarioName: 'pod-scenarios',
        scenarioImage: 'quay.io/krkn/pod-scenarios:latest',
        scenarioFormValues: { NAMESPACE: 'default' },
      },
    },
    {
      nodeId: 'node-beta',
      status: 'configured',
      position: { x: 400, y: 200 },
      config: {
        registryType: 'public',
        registryConfig: {},
        scenarioName: 'node-cpu-hog',
        scenarioImage: 'quay.io/krkn/node-cpu-hog:latest',
        scenarioFormValues: { DURATION: '60' },
      },
    },
  ],
  edges: [{ id: 'node-alpha-node-beta', source: 'node-alpha', target: 'node-beta' }],
  nextNodeNumber: 3,
};

/** Legacy flat krknctl graph (older export format, no studio layout). */
const sampleGraph: { [nodeId: string]: GraphScenarioNode } = {
  'node-alpha': {
    name: 'pod-scenarios',
    image: 'quay.io/krkn/pod-scenarios:latest',
    env: { NAMESPACE: 'default' },
  },
  'node-beta': {
    name: 'node-cpu-hog',
    image: 'quay.io/krkn/node-cpu-hog:latest',
    env: { DURATION: '60' },
    depends_on: 'node-alpha',
  },
};

describe('parseImportedWorkflow', () => {
  it('returns _studioLayout unchanged from a krknctl-compatible export (lossless)', () => {
    const file = JSON.stringify({
      ...sampleGraph,
      _studioLayout: sampleWorkflow,
      _metadata: { exportedAt: '2026-01-01T00:00:00Z', nodeCount: 2 },
    });

    const result = parseImportedWorkflow(file);

    expect(result.lossy).toBe(false);
    expect(result.workflow).toEqual(sampleWorkflow);
  });

  it('returns studioLayout unchanged from a legacy enriched export (lossless)', () => {
    const file = JSON.stringify({
      graph: sampleGraph,
      studioLayout: sampleWorkflow,
      metadata: { exportedAt: '2026-01-01T00:00:00Z', nodeCount: 2 },
    });

    const result = parseImportedWorkflow(file);

    expect(result.lossy).toBe(false);
    expect(result.workflow).toEqual(sampleWorkflow);
  });

  it('accepts a raw StudioWorkflow file (lossless)', () => {
    const result = parseImportedWorkflow(JSON.stringify(sampleWorkflow));

    expect(result.lossy).toBe(false);
    expect(result.workflow).toEqual(sampleWorkflow);
  });

  it('reconstructs a workflow from a legacy flat graph map (lossy)', () => {
    const result = parseImportedWorkflow(JSON.stringify(sampleGraph));

    expect(result.lossy).toBe(true);
    expect(result.workflow.nodes).toHaveLength(2);
    expect(result.workflow.edges).toEqual([
      { id: 'node-alpha-node-beta', source: 'node-alpha', target: 'node-beta' },
    ]);
    expect(result.workflow.nextNodeNumber).toBe(3);
  });

  it('reconstructs a flat graph while ignoring _-prefixed keys (lossy)', () => {
    const result = parseImportedWorkflow(
      JSON.stringify({ _comment: { note: 'annotation' }, ...sampleGraph })
    );

    expect(result.lossy).toBe(true);
    expect(result.workflow.nodes).toHaveLength(2);
    expect(result.workflow.nodes.some(n => n.nodeId === '_comment')).toBe(false);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseImportedWorkflow('{not json')).toThrow(/not valid JSON/);
  });

  it('throws on an unrecognized shape', () => {
    expect(() => parseImportedWorkflow(JSON.stringify([1, 2, 3]))).toThrow(/Unrecognized/);
  });

  it('throws when studioLayout is malformed', () => {
    const file = JSON.stringify({ studioLayout: { nodes: 'nope' } });
    expect(() => parseImportedWorkflow(file)).toThrow(/malformed/);
  });

  it('rejects a lossless layout with a null node entry', () => {
    const file = JSON.stringify({
      _studioLayout: { nodes: [null], edges: [], nextNodeNumber: 2 },
    });
    expect(() => parseImportedWorkflow(file)).toThrow(/node entry is not an object/);
  });

  it('rejects a configured node missing its configuration', () => {
    const file = JSON.stringify({
      nodes: [{ nodeId: 'node-alpha', status: 'configured', position: { x: 0, y: 0 } }],
      edges: [],
      nextNodeNumber: 2,
    });
    expect(() => parseImportedWorkflow(file)).toThrow(/missing its configuration/);
  });

  it('rejects a node with a non-numeric position', () => {
    const file = JSON.stringify({
      studioLayout: {
        nodes: [{ nodeId: 'node-alpha', status: 'unconfigured', position: { x: 'nope', y: 0 } }],
        edges: [],
        nextNodeNumber: 2,
      },
    });
    expect(() => parseImportedWorkflow(file)).toThrow(/non-numeric position/);
  });

  it('rejects duplicate node IDs in a lossless layout', () => {
    const file = JSON.stringify({
      nodes: [
        { nodeId: 'node-alpha', status: 'unconfigured', position: { x: 0, y: 0 } },
        { nodeId: 'node-alpha', status: 'unconfigured', position: { x: 1, y: 1 } },
      ],
      edges: [],
      nextNodeNumber: 2,
    });
    expect(() => parseImportedWorkflow(file)).toThrow(/duplicate node ID/);
  });

  it('rejects an edge referencing a missing node', () => {
    const file = JSON.stringify({
      _studioLayout: {
        nodes: [{ nodeId: 'node-alpha', status: 'unconfigured', position: { x: 0, y: 0 } }],
        edges: [{ id: 'e1', source: 'node-alpha', target: 'ghost-node' }],
        nextNodeNumber: 2,
      },
    });
    expect(() => parseImportedWorkflow(file)).toThrow(/references a missing node/);
  });

  it('rejects a lossless layout whose edges form a cycle', () => {
    const file = JSON.stringify({
      nodes: [
        { nodeId: 'node-alpha', status: 'unconfigured', position: { x: 0, y: 0 } },
        { nodeId: 'node-betaa', status: 'unconfigured', position: { x: 1, y: 1 } },
      ],
      edges: [
        { id: 'e1', source: 'node-alpha', target: 'node-betaa' },
        { id: 'e2', source: 'node-betaa', target: 'node-alpha' },
      ],
      nextNodeNumber: 3,
    });
    expect(() => parseImportedWorkflow(file)).toThrow(/cycle/);
  });
});

describe('reconstructWorkflowFromGraph', () => {
  it('marks nodes configured when a scenario name is present', () => {
    const graph: { [nodeId: string]: GraphScenarioNode } = {
      'node-full': { name: 'pod-scenarios', image: 'img:1', env: { A: '1' } },
      // Name but no image: still configured; image falls back to krkn-hub.
      'node-noimg': { name: 'node-cpu-hog' },
      // Image only, no scenario name -> passes validation but unconfigured.
      'node-empty': { image: 'img:2' },
    };

    const wf = reconstructWorkflowFromGraph(graph);
    const full = wf.nodes.find(n => n.nodeId === 'node-full');
    const noimg = wf.nodes.find(n => n.nodeId === 'node-noimg');
    const empty = wf.nodes.find(n => n.nodeId === 'node-empty');

    expect(full?.status).toBe('configured');
    expect(full?.config?.scenarioName).toBe('pod-scenarios');
    expect(full?.config?.scenarioImage).toBe('img:1');
    expect(full?.config?.scenarioFormValues).toEqual({ A: '1' });
    expect(noimg?.status).toBe('configured');
    expect(noimg?.config?.scenarioImage).toBe('krkn-hub:node-cpu-hog');
    expect(empty?.status).toBe('unconfigured');
    expect(empty?.config).toBeUndefined();
  });

  it('configures nodes from scenario reference without a top-level image', () => {
    // Current graph-run form: identity is under `scenario`, no legacy name/image.
    const graph: { [nodeId: string]: GraphScenarioNode } = {
      'node-priv': {
        scenario: { name: 'pod-scenarios', private: true, registryName: 'my-registry' },
        env: { NAMESPACE: 'default' },
        volumes: { '/data': 'vol1' },
        cloudCredentialRef: 'aws-creds',
      },
    };

    const wf = reconstructWorkflowFromGraph(graph);
    const node = wf.nodes.find(n => n.nodeId === 'node-priv');

    expect(node?.status).toBe('configured');
    expect(node?.config?.scenarioName).toBe('pod-scenarios');
    // No image in the graph -> krkn-hub suggestion.
    expect(node?.config?.scenarioImage).toBe('krkn-hub:pod-scenarios');
    expect(node?.config?.registryType).toBe('private');
    expect(node?.config?.registryConfig).toEqual({ registryName: 'my-registry' });
    expect(node?.config?.scenarioFormValues).toEqual({ NAMESPACE: 'default' });
    expect(node?.config?.volumes).toEqual({ '/data': 'vol1' });
    expect(node?.config?.cloudCredentialRef).toBe('aws-creds');
  });

  it('assigns positions by dependency depth', () => {
    const wf = reconstructWorkflowFromGraph(sampleGraph);
    const alpha = wf.nodes.find(n => n.nodeId === 'node-alpha');
    const beta = wf.nodes.find(n => n.nodeId === 'node-beta');

    // beta depends on alpha, so it lands in a deeper (further right) layer.
    expect(beta!.position.x).toBeGreaterThan(alpha!.position.x);
  });

  it('picks a nextNodeNumber that avoids colliding with a sparse node ID', () => {
    // Two nodes but IDs node-2/node-3: nodes.length + 1 = 3 would collide with node-3.
    const graph: { [nodeId: string]: GraphScenarioNode } = {
      'node-2': { name: 'pod-scenarios', image: 'img:1' },
      'node-3': { name: 'node-cpu-hog', image: 'img:2', depends_on: 'node-2' },
    };

    const wf = reconstructWorkflowFromGraph(graph);

    expect(wf.nodes).toHaveLength(2);
    expect(wf.nextNodeNumber).toBe(4);
    expect(wf.nodes.some(n => n.nodeId === `node-${wf.nextNodeNumber}`)).toBe(false);
  });

  it('accepts operator-valid node IDs the editor pattern would reject', () => {
    // Uppercase, underscores, dots, and short IDs are all valid to the operator.
    const graph: { [nodeId: string]: GraphScenarioNode } = {
      Node_A: { name: 'pod-scenarios', image: 'img:1' },
      'n1.b': { name: 'node-cpu-hog', image: 'img:2', depends_on: 'Node_A' },
    };

    const wf = reconstructWorkflowFromGraph(graph);

    expect(wf.nodes.map(n => n.nodeId).sort()).toEqual(['Node_A', 'n1.b']);
    expect(wf.edges).toEqual([{ id: 'Node_A-n1.b', source: 'Node_A', target: 'n1.b' }]);
  });

  it('throws when a node ID sanitizes to an invalid value', () => {
    // '___' trims to empty -> operator maps it to reserved 'node'.
    const graph: { [nodeId: string]: GraphScenarioNode } = {
      ___: { name: 'x', image: 'y' },
    };
    expect(() => reconstructWorkflowFromGraph(graph)).toThrow(/Invalid node ID/);
  });

  it('throws when two node IDs collide after sanitization', () => {
    // 'Node-A' and 'node-a' both sanitize to 'node-a'.
    const graph: { [nodeId: string]: GraphScenarioNode } = {
      'Node-A': { name: 'x', image: 'y' },
      'node-a': { name: 'x', image: 'y' },
    };
    expect(() => reconstructWorkflowFromGraph(graph)).toThrow(/all sanitize to/);
  });

  it('throws when a node ID exceeds the maximum length', () => {
    const graph: { [nodeId: string]: GraphScenarioNode } = {
      [`n${'a'.repeat(260)}`]: { name: 'x', image: 'y' },
    };
    expect(() => reconstructWorkflowFromGraph(graph)).toThrow(/exceeds maximum length/);
  });

  it('throws on a circular dependency', () => {
    const graph: { [nodeId: string]: GraphScenarioNode } = {
      'node-one': { name: 'a', image: 'i', depends_on: 'node-two' },
      'node-two': { name: 'b', image: 'i', depends_on: 'node-one' },
    };
    expect(() => reconstructWorkflowFromGraph(graph)).toThrow(/Invalid workflow graph/);
  });

  it('throws on a dangling dependency reference', () => {
    const graph: { [nodeId: string]: GraphScenarioNode } = {
      'node-one': { name: 'a', image: 'i', depends_on: 'missing-node' },
    };
    expect(() => reconstructWorkflowFromGraph(graph)).toThrow(/Invalid workflow graph/);
  });
});

describe('buildStudioExport', () => {
  it('strips _-prefixed keys and embeds _studioLayout/_metadata', () => {
    const graph: { [nodeId: string]: GraphScenarioNode } = {
      _comment: { name: 'annotation' },
      'node-alpha': { name: 'pod-scenarios', image: 'img:1', env: { A: '1' } },
    };

    const file = buildStudioExport(graph, { graphRunName: 'run-123' });

    // Top level is the flat krknctl graph; the annotation key is dropped.
    expect(file._comment).toBeUndefined();
    expect(file['node-alpha']).toBeDefined();
    expect(file._studioLayout.nodes).toHaveLength(1);
    expect(file._metadata.nodeCount).toBe(1);
    expect(file._metadata.graphRunName).toBe('run-123');
    expect(file._metadata.exportedAt).toBeTruthy();
  });

  it('round-trips through parseImportedWorkflow losslessly', () => {
    const graph: { [nodeId: string]: GraphScenarioNode } = {
      'node-alpha': { name: 'pod-scenarios', image: 'img:1', env: { A: '1' } },
      'node-beta': { name: 'node-cpu-hog', image: 'img:2', depends_on: 'node-alpha' },
    };

    const file = buildStudioExport(graph);
    const parsed = parseImportedWorkflow(JSON.stringify(file));

    expect(parsed.lossy).toBe(false);
    expect(parsed.workflow).toEqual(file._studioLayout);
  });

  it('exports and re-imports a current scenario-form graph run', () => {
    // A graph run as returned today: scenario reference, no legacy name/image.
    const graph: { [nodeId: string]: GraphScenarioNode } = {
      _comment: { _comment: 'annotation' },
      'node-alpha': {
        scenario: { name: 'pod-scenarios', private: true, registryName: 'my-registry' },
        env: { NAMESPACE: 'default' },
      },
      'node-beta': {
        scenario: { name: 'node-cpu-hog', private: false },
        depends_on: 'node-alpha',
      },
    };

    const file = buildStudioExport(graph, { graphRunName: 'run-123' });
    const parsed = parseImportedWorkflow(JSON.stringify(file));

    expect(parsed.lossy).toBe(false);
    expect(parsed.workflow).toEqual(file._studioLayout);

    const alpha = parsed.workflow.nodes.find(n => n.nodeId === 'node-alpha');
    expect(alpha?.status).toBe('configured');
    expect(alpha?.config?.scenarioName).toBe('pod-scenarios');
    expect(alpha?.config?.registryType).toBe('private');
    expect(alpha?.config?.registryConfig).toEqual({ registryName: 'my-registry' });
    expect(parsed.workflow.edges).toEqual([
      { id: 'node-alpha-node-beta', source: 'node-alpha', target: 'node-beta' },
    ]);
  });

  it('throws when the underlying graph is invalid (cycle)', () => {
    const graph: { [nodeId: string]: GraphScenarioNode } = {
      'node-one': { name: 'a', image: 'i', depends_on: 'node-two' },
      'node-two': { name: 'b', image: 'i', depends_on: 'node-one' },
    };
    expect(() => buildStudioExport(graph)).toThrow(/Invalid workflow graph/);
  });

  it('embeds graph-level resiliency settings when provided', () => {
    const graph: { [nodeId: string]: GraphScenarioNode } = {
      'node-alpha': { name: 'pod-scenarios', image: 'img:1' },
    };

    const file = buildStudioExport(graph, { graphRunName: 'run-123' }, {
      baseline: 80,
      mountPath: '/etc/krkn/metrics.yaml',
    });

    expect(file._studioLayout.resiliencyScoreConfig).toEqual({
      baseline: 80,
      mountPath: '/etc/krkn/metrics.yaml',
    });

    // Round-trips so re-import restores the config.
    const parsed = parseImportedWorkflow(JSON.stringify(file));
    expect(parsed.workflow.resiliencyScoreConfig).toEqual({
      baseline: 80,
      mountPath: '/etc/krkn/metrics.yaml',
    });
  });

  it('omits resiliency config when none is provided', () => {
    const graph: { [nodeId: string]: GraphScenarioNode } = {
      'node-alpha': { name: 'pod-scenarios', image: 'img:1' },
    };

    const file = buildStudioExport(graph);

    expect(file._studioLayout.resiliencyScoreConfig).toBeUndefined();
  });

  it('preserves per-node resiliencyWeight on reconstruction', () => {
    const graph: { [nodeId: string]: GraphScenarioNode } = {
      'node-alpha': { name: 'pod-scenarios', image: 'img:1', resiliencyWeight: 3 },
    };

    const wf = reconstructWorkflowFromGraph(graph);
    const alpha = wf.nodes.find(n => n.nodeId === 'node-alpha');

    expect(alpha?.config?.resiliencyWeight).toBe(3);
  });
});

describe('node ID validation', () => {
  it.each(['node', 'empty', 'Node', 'EMPTY'])(
    'accepts literal node ID "%s"',
    (nodeId) => {
      const graph: { [nodeId: string]: GraphScenarioNode } = {
        [nodeId]: { name: 'pod-scenarios', image: 'img:1' },
      };
      expect(() => reconstructWorkflowFromGraph(graph)).not.toThrow();
    }
  );

  it.each(['___', '@@@', '---'])(
    'rejects ID "%s" that only sanitizes via fallback',
    (nodeId) => {
      const graph: { [nodeId: string]: GraphScenarioNode } = {
        [nodeId]: { name: 'pod-scenarios', image: 'img:1' },
      };
      expect(() => reconstructWorkflowFromGraph(graph)).toThrow(/Invalid node ID/);
    }
  );
});

describe('validateStudioLayout registryConfig check', () => {
  it('rejects a configured node missing registryConfig', () => {
    const wf = {
      nodes: [
        {
          nodeId: 'node-alpha',
          status: 'configured',
          position: { x: 0, y: 0 },
          config: {
            registryType: 'public',
            scenarioName: 'pod-scenarios',
            scenarioImage: 'img:1',
            scenarioFormValues: {},
          },
        },
      ],
      edges: [],
      nextNodeNumber: 2,
    };
    expect(() => parseImportedWorkflow(JSON.stringify(wf))).toThrow(/missing its configuration/);
  });
});
