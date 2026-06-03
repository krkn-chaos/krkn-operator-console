/**
 * StudioContext - State management for Chaos Scenario Studio
 *
 * Provides:
 * - Workflow state (nodes, edges)
 * - Node CRUD operations
 * - Edge management with validation
 * - Autosave to localStorage
 */

import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode, useRef } from 'react';
import type { StudioNode, StudioEdge, StudioWorkflow, StudioAutosave, GraphScenarioNode } from '../../types/api';
import { AUTOSAVE_KEY, AUTOSAVE_VERSION, saveAutosave } from './studioAutosave';

const AUTOSAVE_INTERVAL = 30000; // 30 seconds
const AUTOSAVE_VERSION = '1.0';

interface StudioContextType {
  workflow: StudioWorkflow;
  addNode: () => void;
  updateNode: (nodeId: string, updates: Partial<StudioNode>) => void;
  deleteNode: (nodeId: string) => void;
  cloneNode: (sourceNodeId: string, newNodeId: string) => void;
  addEdge: (source: string, target: string) => { valid: boolean; error?: string; warning?: string };
  deleteEdge: (edgeId: string) => void;
  validateConnection: (source: string, target: string) => { valid: boolean; error?: string; warning?: string };
  validateNodeId: (nodeId: string, excludeId?: string) => { valid: boolean; error?: string };
  exportWorkflow: () => { graph: { [nodeId: string]: GraphScenarioNode }; metadata: { exportedAt: string; nodeCount: number } } | { error: string };
  clearWorkflow: () => void;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

interface StudioProviderProps {
  children: ReactNode;
  initialWorkflow?: StudioWorkflow;
}

export function StudioProvider({ children, initialWorkflow }: StudioProviderProps) {
  const [workflow, setWorkflow] = useState<StudioWorkflow>(
    initialWorkflow || {
      nodes: [],
      edges: [],
      nextNodeNumber: 1,
    }
  );

  // Use ref to access latest workflow without re-creating interval
  const workflowRef = useRef(workflow);
  workflowRef.current = workflow;

  // Autosave to localStorage - interval runs once, reads from ref
  useEffect(() => {
    const interval = setInterval(() => {
      const currentWorkflow = workflowRef.current;
      if (currentWorkflow.nodes.length > 0) {
        const autosave: StudioAutosave = {
          workflow: currentWorkflow,
          timestamp: Date.now(),
          version: AUTOSAVE_VERSION,
        };
        saveAutosave(autosave);
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(interval);
  }, []); // Empty deps - interval never re-created

  // Add new unconfigured node
  const addNode = useCallback(() => {
    const newNode: StudioNode = {
      nodeId: `node-${workflow.nextNodeNumber}`,
      status: 'unconfigured',
      position: {
        x: 100 + (workflow.nextNodeNumber - 1) * 300,
        y: 200,
      },
    };

    setWorkflow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
      nextNodeNumber: prev.nextNodeNumber + 1,
    }));
  }, [workflow.nextNodeNumber]);

  // Update node (used for configuration, position changes, etc.)
  const updateNode = useCallback((nodeId: string, updates: Partial<StudioNode>) => {
    setWorkflow(prev => {
      // Check if nodeId is being changed
      const newNodeId = updates.nodeId;
      const isNodeIdChanging = newNodeId && newNodeId !== nodeId;

      const updatedNodes = prev.nodes.map(node =>
        node.nodeId === nodeId ? { ...node, ...updates } : node
      );

      let updatedEdges = prev.edges;

      // If nodeId changed, update all edges referencing this node
      if (isNodeIdChanging && newNodeId) {
        updatedEdges = prev.edges.map(edge => {
          if (edge.source === nodeId) {
            return { ...edge, source: newNodeId };
          }
          if (edge.target === nodeId) {
            return { ...edge, target: newNodeId, id: `${edge.source}-${newNodeId}` };
          }
          return edge;
        });
      }

      return {
        ...prev,
        nodes: updatedNodes,
        edges: updatedEdges,
      };
    });
  }, []);

  // Delete node and its edges
  const deleteNode = useCallback((nodeId: string) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.nodeId !== nodeId),
      edges: prev.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    }));
  }, []);

  // Clone node (copy config, not dependencies)
  const cloneNode = useCallback((sourceNodeId: string, newNodeId: string) => {
    setWorkflow(prev => {
      const sourceNode = prev.nodes.find(n => n.nodeId === sourceNodeId);

      if (!sourceNode || sourceNode.status !== 'configured') {
        return prev; // No changes
      }

      const clonedNode: StudioNode = {
        nodeId: newNodeId,
        status: 'configured',
        config: sourceNode.config ? { ...sourceNode.config } : undefined,
        position: {
          x: sourceNode.position.x + 50,
          y: sourceNode.position.y + 50,
        },
      };

      return {
        ...prev,
        nodes: [...prev.nodes, clonedNode],
      };
    });
  }, []);

  // Validate node ID
  const validateNodeId = useCallback((nodeId: string, excludeId?: string): { valid: boolean; error?: string } => {
    const pattern = /^[a-z0-9-]{5,25}$/;
    if (!pattern.test(nodeId)) {
      return {
        valid: false,
        error: 'Node ID must be 5-25 characters: lowercase letters, numbers, and hyphens only',
      };
    }

    const exists = workflow.nodes.some(n => n.nodeId === nodeId && n.nodeId !== excludeId);
    if (exists) {
      return {
        valid: false,
        error: 'Node ID already exists',
      };
    }

    return { valid: true };
  }, [workflow.nodes]);

  // Validate connection (checks for cycles and dependency limits)
  const validateConnection = useCallback((source: string, target: string): { valid: boolean; error?: string; warning?: string } => {
    // Check if both nodes exist
    const sourceNode = workflow.nodes.find(n => n.nodeId === source);
    const targetNode = workflow.nodes.find(n => n.nodeId === target);

    if (!sourceNode || !targetNode) {
      return { valid: false, error: 'Source or target node not found' };
    }

    // IMPORTANT: Source node MUST be configured to create edges
    if (sourceNode.status !== 'configured') {
      return { valid: false, error: 'Source node must be configured before creating connections' };
    }

    // Check if edge already exists
    const edgeExists = workflow.edges.some(e => e.source === source && e.target === target);
    if (edgeExists) {
      return { valid: false, error: 'Connection already exists' };
    }

    // IMPORTANT: GraphScenarioNode supports only ONE dependency per node (depends_on: string)
    // Check if target already has an incoming edge
    const targetHasDependency = workflow.edges.some(e => e.target === target);
    if (targetHasDependency) {
      return { valid: false, error: 'Node can only have one dependency (krknctl limitation)' };
    }

    // IMPORTANT: Target node MUST be configured to create valid connections
    // This prevents edge creation but ReactFlow will show visual feedback during drag
    if (targetNode.status !== 'configured') {
      return { valid: false, error: 'Target node must be configured before creating connections' };
    }

    // Build graph with new edge to check for cycles
    const testEdges = [...workflow.edges, { id: `${source}-${target}`, source, target }];
    const graph: { [nodeId: string]: GraphScenarioNode } = {};

    workflow.nodes.forEach(node => {
      if (node.status === 'configured') {
        const dependencies = testEdges
          .filter(e => e.target === node.nodeId)
          .map(e => e.source);

        graph[node.nodeId] = {
          name: node.config?.scenarioName || node.nodeId,
          depends_on: dependencies.length === 1 ? dependencies[0] : undefined,
        };
      }
    });

    // Use graphRunsApi cycle detection
    const circularErrors = detectCircularDependencies(graph);
    if (circularErrors.length > 0) {
      return { valid: false, error: circularErrors[0] };
    }

    return { valid: true };
  }, [workflow.nodes, workflow.edges]);

  // Add edge (dependency)
  const addEdge = useCallback((source: string, target: string): { valid: boolean; error?: string; warning?: string } => {
    const validation = validateConnection(source, target);
    if (!validation.valid) {
      return validation;
    }

    const newEdge: StudioEdge = {
      id: `${source}-${target}`,
      source,
      target,
    };

    setWorkflow(prev => ({
      ...prev,
      edges: [...prev.edges, newEdge],
    }));

    return { valid: true };
  }, [validateConnection]);

  // Delete edge
  const deleteEdge = useCallback((edgeId: string) => {
    setWorkflow(prev => ({
      ...prev,
      edges: prev.edges.filter(e => e.id !== edgeId),
    }));
  }, []);

  // Export workflow to GraphRunSpec format (krknctl compatible)
  const exportWorkflow = useCallback((): { graph: { [nodeId: string]: GraphScenarioNode }; metadata: { exportedAt: string; nodeCount: number } } | { error: string } => {
    // Validate: all nodes must be configured
    const unconfiguredNodes = workflow.nodes.filter(n => n.status !== 'configured');
    if (unconfiguredNodes.length > 0) {
      return {
        error: `Cannot export: ${unconfiguredNodes.length} node(s) are not configured yet (${unconfiguredNodes.map(n => n.nodeId).join(', ')})`,
      };
    }

    const graph: { [nodeId: string]: GraphScenarioNode } = {};

    workflow.nodes.forEach(node => {
      if (node.status === 'configured' && node.config) {
        // Find incoming edge (max 1 due to validation)
        const incomingEdge = workflow.edges.find(e => e.target === node.nodeId);

        // Convert form values to environment variables
        const env: { [key: string]: string } = {};
        if (node.config.scenarioFormValues) {
          Object.entries(node.config.scenarioFormValues).forEach(([key, value]) => {
            env[key] = String(value);
          });
        }
        if (node.config.globalFormValues) {
          Object.entries(node.config.globalFormValues).forEach(([key, value]) => {
            env[key] = String(value);
          });
        }

        graph[node.nodeId] = {
          name: node.config.scenarioName,
          image: node.config.scenarioImage,
          env,
          volumes: node.config.volumes,
          depends_on: incomingEdge?.source, // undefined if no dependency (root node)
        };
      }
    });

    return {
      graph,
      metadata: {
        exportedAt: new Date().toISOString(),
        nodeCount: workflow.nodes.length,
      },
    };
  }, [workflow]);

  // Clear workflow
  const clearWorkflow = useCallback(() => {
    setWorkflow({
      nodes: [],
      edges: [],
      nextNodeNumber: 1,
    });
    localStorage.removeItem(AUTOSAVE_KEY);
  }, []);

  const value: StudioContextType = useMemo(() => ({
    workflow,
    addNode,
    updateNode,
    deleteNode,
    cloneNode,
    addEdge,
    deleteEdge,
    validateConnection,
    validateNodeId,
    exportWorkflow,
    clearWorkflow,
  }), [
    workflow,
    addNode,
    updateNode,
    deleteNode,
    cloneNode,
    addEdge,
    deleteEdge,
    validateConnection,
    validateNodeId,
    exportWorkflow,
    clearWorkflow,
  ]);

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

// Hook to use Studio context
export function useStudioContext() {
  const context = useContext(StudioContext);
  if (context === undefined) {
    throw new Error('useStudioContext must be used within a StudioProvider');
  }
  return context;
}

// Re-export autosave helpers for convenience
export { loadAutosave, clearAutosave } from './studioAutosave';

// Helper: Detect circular dependencies (adapted from graphRunsApi)
function detectCircularDependencies(graph: { [nodeId: string]: GraphScenarioNode }): string[] {
  const errors: string[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const dfs = (nodeId: string, path: string[]): boolean => {
    if (!graph[nodeId]) {
      return false;
    }

    if (recursionStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      const cycle = [...path.slice(cycleStart), nodeId].join(' → ');
      errors.push(`Circular dependency detected: ${cycle}`);
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const node = graph[nodeId];
    if (node.depends_on) {
      dfs(node.depends_on, [...path]);
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const nodeId of Object.keys(graph)) {
    if (!visited.has(nodeId)) {
      dfs(nodeId, []);
    }
  }

  return errors;
}
