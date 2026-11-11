/**
 * studioImport - Parse and reconstruct Chaos Studio workflows from uploaded JSON.
 *
 * The studio can export a workflow to a JSON file. This module implements the
 * reverse: turning an uploaded file back into a `StudioWorkflow` that renders on
 * the canvas.
 *
 * Two file shapes are supported:
 *
 * 1. **Enriched export** `{ graph, studioLayout, metadata }` (current export
 *    format) or a raw `StudioWorkflow`. The `studioLayout` carries full canvas
 *    fidelity (positions, node status, per-node config, edges), so it is used
 *    directly for a lossless round-trip.
 * 2. **Legacy flat graph** `{ [nodeId]: GraphScenarioNode }` (older export files
 *    that stored only the executable krknctl graph). These are reconstructed on
 *    a best-effort basis: positions are auto-laid-out and node config is derived
 *    from the graph. This is lossy — the scenario/global env split, private
 *    registry details, and file mounts cannot be recovered, so reconstructed
 *    nodes may need to be reconfigured before saving.
 */

import type {
  StudioNode,
  StudioEdge,
  StudioWorkflow,
  GraphScenarioNode,
  ResiliencyScoreConfig,
} from '../../types/api';
import { graphRunsApi } from '../../services/graphRunsApi';

/**
 * Node-ID contract accepted by the operator's graph-run validation
 * (`krkngraphrun_validation.go`). Imported and exported layouts must accept
 * every ID the operator accepts; the stricter editor pattern
 * (`^[a-z0-9-]{5,25}$` in StudioContext) applies only to nodes the user
 * creates in the canvas, not to graphs that already ran on the cluster.
 */
/** Maximum node-ID length (mirrors MaxNodeIDLength). */
const MAX_NODE_ID_LENGTH = 253;
/** Kubernetes label-value length cap used by sanitization (mirrors MaxLabelValueLength). */
const MAX_LABEL_VALUE_LENGTH = 63;

/**
 * Sanitize a node ID the same way the operator does
 * (`SanitizeNodeIDForKubernetes`): lowercase, replace any char outside
 * `[a-z0-9._-]` with `-`, truncate to 63, and trim leading/trailing `-_.`.
 * Used only to mirror the operator's collision and validity checks.
 */
function sanitizeNodeIDForKubernetes(nodeId: string): string {
  if (nodeId === '') return 'empty';

  let sanitized = nodeId.toLowerCase().replace(/[^a-z0-9._-]/g, '-');

  if (sanitized.length > MAX_LABEL_VALUE_LENGTH) {
    sanitized = sanitized.slice(0, MAX_LABEL_VALUE_LENGTH);
  }

  sanitized = sanitized.replace(/^[-_.]+/, '');
  if (sanitized === '') return 'node';

  sanitized = sanitized.replace(/[-_.]+$/, '');
  if (sanitized === '') return 'node';

  return sanitized;
}

/**
 * Assert a set of node IDs satisfies the operator's graph-run contract: each ID
 * non-empty, <= 253 chars, sanitizes to a valid value, and no two IDs collide
 * after sanitization. Shared by lossy reconstruction and lossless-layout
 * validation so both accept exactly the IDs the operator accepts.
 *
 * @throws Error with a descriptive message for the first violation found.
 */
function assertValidNodeIds(nodeIds: string[]): void {
  const sanitizedToOriginals = new Map<string, string[]>();
  for (const nodeId of nodeIds) {
    if (nodeId === '') {
      throw new Error('Invalid node ID: node ID cannot be empty');
    }
    if (nodeId.length > MAX_NODE_ID_LENGTH) {
      throw new Error(
        `Invalid node ID "${nodeId}": exceeds maximum length of ${MAX_NODE_ID_LENGTH} characters`
      );
    }
    const sanitized = sanitizeNodeIDForKubernetes(nodeId);
    // 'empty'/'node' are synthesized fallbacks for IDs that collapse to nothing.
    // Reject only when synthesized, not when the ID legitimately sanitizes to
    // that value (e.g. literal "node", "empty", or "Node").
    if (
      sanitized === '' ||
      ((sanitized === 'empty' || sanitized === 'node') && sanitized !== nodeId.toLowerCase())
    ) {
      throw new Error(
        `Invalid node ID "${nodeId}": sanitizes to invalid value "${sanitized}"; use alphanumeric characters, hyphens, underscores, or dots`
      );
    }
    sanitizedToOriginals.set(sanitized, [...(sanitizedToOriginals.get(sanitized) ?? []), nodeId]);
  }

  for (const [sanitized, originals] of sanitizedToOriginals) {
    if (originals.length > 1) {
      throw new Error(
        `Invalid node ID: ${JSON.stringify(originals)} all sanitize to "${sanitized}"; use distinct node IDs that remain unique after lowercase conversion and special character replacement`
      );
    }
  }
}

/**
 * Structurally validate a Studio layout accepted on a lossless import path
 * (`_studioLayout`, legacy `studioLayout`, or a raw `StudioWorkflow`).
 *
 * `isStudioWorkflowShape` only confirms the top-level arrays exist; a hand-edited
 * or corrupted file can still carry null entries, non-numeric positions,
 * configured nodes without config, or edges pointing at missing nodes. Those
 * would otherwise reach rendering, `buildGraph`, and autosave. This gate rejects
 * them up front with a descriptive error.
 *
 * @throws Error if any node or edge entry is malformed, IDs are not unique or
 *   violate the operator contract, or the edges form a cycle.
 */
function validateStudioLayout(wf: StudioWorkflow): void {
  const nodeIds = new Set<string>();

  for (const node of wf.nodes as unknown[]) {
    if (!node || typeof node !== 'object') {
      throw new Error('Invalid workflow format: a node entry is not an object');
    }
    const n = node as Partial<StudioNode>;
    if (typeof n.nodeId !== 'string') {
      throw new Error('Invalid workflow format: a node is missing a string nodeId');
    }
    if (nodeIds.has(n.nodeId)) {
      throw new Error(`Invalid workflow format: duplicate node ID "${n.nodeId}"`);
    }
    nodeIds.add(n.nodeId);

    const pos = n.position as { x?: unknown; y?: unknown } | undefined;
    if (
      !pos ||
      typeof pos.x !== 'number' ||
      typeof pos.y !== 'number' ||
      !Number.isFinite(pos.x) ||
      !Number.isFinite(pos.y)
    ) {
      throw new Error(`Invalid workflow format: node "${n.nodeId}" has a non-numeric position`);
    }

    if (n.status === 'configured') {
      if (
        !n.config ||
        typeof n.config !== 'object' ||
        !n.config.scenarioName ||
        !n.config.registryConfig ||
        typeof n.config.registryConfig !== 'object'
      ) {
        throw new Error(
          `Invalid workflow format: configured node "${n.nodeId}" is missing its configuration`
        );
      }
    }
  }

  // Node IDs must satisfy the same operator contract as reconstructed graphs.
  assertValidNodeIds([...nodeIds]);

  // Edges: well-formed, both endpoints exist.
  const adjacency = new Map<string, string[]>();
  for (const edge of wf.edges as unknown[]) {
    if (!edge || typeof edge !== 'object') {
      throw new Error('Invalid workflow format: an edge entry is not an object');
    }
    const e = edge as Partial<StudioEdge>;
    if (typeof e.id !== 'string' || typeof e.source !== 'string' || typeof e.target !== 'string') {
      throw new Error('Invalid workflow format: an edge is missing a string id/source/target');
    }
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) {
      throw new Error(`Invalid workflow format: edge "${e.id}" references a missing node`);
    }
    adjacency.set(e.source, [...(adjacency.get(e.source) ?? []), e.target]);
  }

  // Reject cycles via DFS over the edge adjacency (source -> target).
  const visited = new Set<string>();
  const stack = new Set<string>();
  const hasCycle = (nodeId: string): boolean => {
    if (stack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    stack.add(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      if (hasCycle(next)) return true;
    }
    stack.delete(nodeId);
    return false;
  };
  for (const nodeId of nodeIds) {
    if (hasCycle(nodeId)) {
      throw new Error('Invalid workflow format: workflow edges form a cycle');
    }
  }
}

/** Horizontal spacing between dependency layers on the reconstructed canvas. */
const LAYER_X_SPACING = 300;
/** Vertical spacing between sibling nodes within a layer. */
const LAYER_Y_SPACING = 150;
/** Canvas origin for reconstructed layouts (mirrors addNode defaults). */
const ORIGIN_X = 100;
const ORIGIN_Y = 100;

/**
 * Result of parsing an uploaded workflow file.
 *
 * `lossy` is true when the file was a legacy flat graph and had to be
 * reconstructed, so callers can warn the user that some config may be missing.
 */
export interface ParsedImport {
  workflow: StudioWorkflow;
  lossy: boolean;
}

/**
 * Type guard: does an object have the shape of a `StudioWorkflow`?
 * Matches the inline shape check used when loading cluster templates.
 */
function isStudioWorkflowShape(value: unknown): value is StudioWorkflow {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.edges) &&
    typeof candidate.nextNodeNumber === 'number'
  );
}

/**
 * Type guard: does an object look like a flat krknctl graph map
 * (`{ [nodeId]: GraphScenarioNode }`)?
 */
function isGraphMapShape(value: unknown): value is { [nodeId: string]: GraphScenarioNode } {
  if (!value || typeof value !== 'object') return false;
  const entries = Object.values(value as Record<string, unknown>);
  if (entries.length === 0) return false;
  // Every value must be a plain object (a scenario node). Reject arrays/primitives.
  return entries.every(
    entry => entry !== null && typeof entry === 'object' && !Array.isArray(entry)
  );
}

/**
 * Compute the dependency depth of each node (distance from a root node with no
 * `depends_on`). Used to lay out reconstructed nodes into horizontal layers.
 * Nodes whose dependency chain cannot be resolved fall back to depth 0.
 */
function computeDepths(graph: { [nodeId: string]: GraphScenarioNode }): Map<string, number> {
  const depths = new Map<string, number>();

  const depthOf = (nodeId: string, seen: Set<string>): number => {
    const cached = depths.get(nodeId);
    if (cached !== undefined) return cached;

    const node = graph[nodeId];
    // Root, missing dependency, or a cycle guard: treat as depth 0.
    if (!node || !node.depends_on || !graph[node.depends_on] || seen.has(nodeId)) {
      return 0;
    }

    seen.add(nodeId);
    const depth = depthOf(node.depends_on, seen) + 1;
    depths.set(nodeId, depth);
    return depth;
  };

  for (const nodeId of Object.keys(graph)) {
    depths.set(nodeId, depthOf(nodeId, new Set()));
  }

  return depths;
}

/**
 * Resolve a graph node's scenario name, preferring the current
 * `scenario.name` identity and falling back to the legacy top-level `name`.
 */
export function resolveScenarioName(node: GraphScenarioNode): string {
  return node.scenario?.name ?? node.name ?? '';
}

/**
 * Map a krknctl graph node to a Studio node `config`.
 *
 * Shared by import reconstruction and the graph-run replay path so both derive
 * the same Studio settings from a graph node. Recovers the registry (private vs
 * public, private registry name), signature status, environment (form values),
 * volumes, and cloud credential the graph carries. The image is resolved
 * separately: the graph's `image` when present, else the `krkn-hub:${name}`
 * suggestion the studio uses for a scenario picked by name.
 *
 * Signature status here comes only from `scenario.signature_status`; callers
 * that fetch a fresher status (e.g. replay) may override it.
 */
export function graphNodeToStudioConfig(
  node: GraphScenarioNode
): NonNullable<StudioNode['config']> {
  const scenarioName = resolveScenarioName(node);
  return {
    registryType: node.scenario?.private ? 'private' : 'public',
    registryConfig: node.scenario?.registryName
      ? { registryName: node.scenario.registryName }
      : {},
    scenarioName,
    scenarioImage: node.image ?? `krkn-hub:${scenarioName}`,
    signature_status: node.scenario?.signature_status,
    scenarioFormValues: { ...(node.env ?? {}) },
    volumes: node.volumes,
    resiliencyWeight: node.resiliencyWeight,
    cloudCredentialRef: node.cloudCredentialRef,
  };
}

/**
 * Reconstruct a `StudioWorkflow` from a flat krknctl graph map (best-effort).
 *
 * Positions are auto-laid-out by dependency depth. A node is marked
 * `'configured'` when it identifies a scenario (via `scenario.name` or the
 * legacy `name`); otherwise it is `'unconfigured'` so the user completes it.
 *
 * @throws Error if any node ID violates the studio node-ID pattern, or the
 *   resulting graph fails validation (empty, dangling/self dependency, cycle).
 *
 * @example
 * ```ts
 * const workflow = reconstructWorkflowFromGraph({
 *   'node-alpha': { scenario: { name: 'pod-scenarios', private: false }, env: { NAMESPACE: 'default' } },
 *   'node-beta': { scenario: { name: 'node-cpu-hog', private: false }, depends_on: 'node-alpha' },
 * });
 *
 * workflow.nodes.length;       // 2
 * workflow.nodes[0].status;    // 'configured'
 * workflow.edges;              // [{ id: 'node-alpha-node-beta', source: 'node-alpha', target: 'node-beta' }]
 * importWorkflow(workflow);    // render the reconstructed graph on the canvas
 * ```
 */
export function reconstructWorkflowFromGraph(
  graph: { [nodeId: string]: GraphScenarioNode }
): StudioWorkflow {
  const nodeIds = Object.keys(graph);

  // Accept every ID the operator accepts (mirrors krkngraphrun_validation.go):
  // non-empty, <= 253 chars, and a valid non-colliding Kubernetes sanitization.
  assertValidNodeIds(nodeIds);

  // Validate the executable graph up front (empty, bad refs, cycles).
  const validationErrors = graphRunsApi.validateGraph(graph);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid workflow graph: ${validationErrors.join('; ')}`);
  }

  const depths = computeDepths(graph);
  // Track how many nodes already placed in each layer for vertical stacking.
  const layerCounts = new Map<number, number>();

  const nodes: StudioNode[] = nodeIds.map(nodeId => {
    const scenario = graph[nodeId];
    const depth = depths.get(nodeId) ?? 0;
    const indexInLayer = layerCounts.get(depth) ?? 0;
    layerCounts.set(depth, indexInLayer + 1);

    const isConfigured = Boolean(resolveScenarioName(scenario));

    const node: StudioNode = {
      nodeId,
      status: isConfigured ? 'configured' : 'unconfigured',
      position: {
        x: ORIGIN_X + depth * LAYER_X_SPACING,
        y: ORIGIN_Y + indexInLayer * LAYER_Y_SPACING,
      },
    };

    if (isConfigured) {
      node.config = graphNodeToStudioConfig(scenario);
    }

    return node;
  });

  const edges: StudioEdge[] = nodeIds
    .filter(nodeId => graph[nodeId].depends_on)
    .map(nodeId => {
      const source = graph[nodeId].depends_on as string;
      return { id: `${source}-${nodeId}`, source, target: nodeId };
    });

  // Derive nextNodeNumber so it never collides with an existing node ID.
  // In a sparse graph (e.g. { node-2, node-3 }) `nodes.length + 1` could match an
  // imported ID, so increment past any `node-<n>` already in use (mirrors replay).
  const idSet = new Set(nodeIds);
  let next = nodes.length + 1;
  while (idSet.has(`node-${next}`)) {
    next += 1;
  }

  return {
    nodes,
    edges,
    nextNodeNumber: next,
  };
}

/** Metadata recorded alongside an exported workflow file. */
export interface StudioExportMetadata {
  exportedAt: string;
  nodeCount: number;
  [key: string]: unknown;
}

/**
 * The workflow export file written to disk.
 *
 * The file is krknctl-compatible: its top level IS the flat executable graph
 * map (`{ [nodeId]: GraphScenarioNode }`), so krknctl and the Go operator can
 * run it directly. Studio state rides along under `_`-prefixed keys
 * (`_studioLayout`, `_metadata`), which both krknctl and the operator strip
 * because they ignore any top-level key starting with `_` (see executor.go).
 * On re-import the studio reads `_studioLayout` for a lossless round-trip.
 */
export interface StudioExportFile {
  [nodeId: string]: GraphScenarioNode | StudioWorkflow | StudioExportMetadata;
  _studioLayout: StudioWorkflow;
  _metadata: StudioExportMetadata;
}

/**
 * Assemble the on-disk export file: a flat krknctl graph map with Studio state
 * embedded under `_`-prefixed keys.
 *
 * Any `_`-prefixed key already present in `graph` (e.g. `_comment`) is dropped
 * so the emitted graph carries only real scenario nodes plus our own metadata.
 *
 * @param graph - The executable krknctl graph map (top-level nodes).
 * @param studioLayout - Full canvas fidelity for lossless re-import.
 * @param meta - Extra provenance merged into `_metadata`.
 */
export function assembleExportFile(
  graph: { [nodeId: string]: GraphScenarioNode },
  studioLayout: StudioWorkflow,
  meta?: { [key: string]: unknown }
): StudioExportFile {
  const file = {} as StudioExportFile;
  for (const [nodeId, node] of Object.entries(graph ?? {})) {
    if (nodeId.startsWith('_')) continue;
    file[nodeId] = node;
  }

  file._studioLayout = studioLayout;
  file._metadata = {
    exportedAt: new Date().toISOString(),
    nodeCount: studioLayout.nodes.length,
    ...meta,
  };

  return file;
}

/**
 * Build a re-importable export file from a flat krknctl graph map.
 *
 * Used by the Job page to export a graph run: the run response carries only the
 * executable `spec.graph` (no canvas positions), so a `studioLayout` is
 * synthesized via {@link reconstructWorkflowFromGraph} (auto-layout positions),
 * then embedded via {@link assembleExportFile}. The resulting file round-trips
 * through {@link parseImportedWorkflow}.
 *
 * `_`-prefixed keys (e.g. the `_comment` krknctl annotation) are stripped before
 * reconstruction so they do not fail node-ID validation.
 *
 * @throws Error if the graph fails validation (see reconstructWorkflowFromGraph).
 */
export function buildStudioExport(
  graph: { [nodeId: string]: GraphScenarioNode },
  meta?: { [key: string]: unknown },
  resiliency?: ResiliencyScoreConfig
): StudioExportFile {
  const cleanGraph: { [nodeId: string]: GraphScenarioNode } = {};
  for (const [nodeId, node] of Object.entries(graph ?? {})) {
    if (nodeId.startsWith('_')) continue;
    cleanGraph[nodeId] = node;
  }

  const studioLayout = reconstructWorkflowFromGraph(cleanGraph);
  // Carry graph-level resiliency settings so re-import restores the same config.
  if (resiliency) {
    studioLayout.resiliencyScoreConfig = resiliency;
  }

  return assembleExportFile(cleanGraph, studioLayout, meta);
}

/**
 * Parse the text of an uploaded workflow file into a `StudioWorkflow`.
 *
 * Detection order:
 *   1. krknctl-compatible file with an embedded `_studioLayout` -> used directly
 *      (lossless, current export format).
 *   2. Legacy enriched export with a top-level `studioLayout` sibling -> used
 *      directly (lossless, older export format).
 *   3. A raw `StudioWorkflow` -> used directly (lossless).
 *   4. A flat graph map -> reconstructed (lossy). Any `_`-prefixed key is
 *      stripped first (e.g. `_comment`).
 *
 * @throws Error on invalid JSON, unrecognized shape, or failed graph validation.
 *
 * @example
 * ```ts
 * const text = await file.text();
 * const { workflow, lossy } = parseImportedWorkflow(text);
 *
 * importWorkflow(workflow); // render on the canvas
 * if (lossy) {
 *   showWarning('Imported from a flat graph; some settings may need review');
 * } else {
 *   showSuccess(`Imported ${workflow.nodes.length} node(s)`);
 * }
 * ```
 */
export function parseImportedWorkflow(text: string): ParsedImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Unrecognized workflow file format');
  }

  const record = parsed as Record<string, unknown>;

  // 1. krknctl-compatible file: flat graph + embedded `_studioLayout`.
  const embeddedLayout = record._studioLayout;
  if (embeddedLayout !== undefined) {
    if (!isStudioWorkflowShape(embeddedLayout)) {
      throw new Error('Invalid workflow format: _studioLayout is malformed');
    }
    validateStudioLayout(embeddedLayout);
    return { workflow: embeddedLayout, lossy: false };
  }

  // 2. Legacy enriched export: { graph, studioLayout, metadata }
  const studioLayout = record.studioLayout;
  if (studioLayout !== undefined) {
    if (!isStudioWorkflowShape(studioLayout)) {
      throw new Error('Invalid workflow format: studioLayout is malformed');
    }
    validateStudioLayout(studioLayout);
    return { workflow: studioLayout, lossy: false };
  }

  // 3. Raw StudioWorkflow
  if (isStudioWorkflowShape(parsed)) {
    validateStudioLayout(parsed);
    return { workflow: parsed, lossy: false };
  }

  // 4. Flat graph map (strip metadata / `_`-prefixed keys before reconstruction)
  const graphOnly: { [nodeId: string]: GraphScenarioNode } = {};
  for (const [nodeId, node] of Object.entries(record)) {
    if (nodeId.startsWith('_')) continue;
    graphOnly[nodeId] = node as GraphScenarioNode;
  }
  if (isGraphMapShape(graphOnly)) {
    return {
      workflow: reconstructWorkflowFromGraph(graphOnly),
      lossy: true,
    };
  }

  throw new Error('Unrecognized workflow file format');
}
