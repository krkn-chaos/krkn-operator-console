/**
 * GraphRunDetail Component
 *
 * Visualizes a GraphRun as a directed acyclic graph (DAG) using ReactFlow.
 * Shows nodes with their status, dependencies, and allows clicking nodes to view details.
 * Similar to GitHub Actions workflow visualization.
 */

import { useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  NodeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import {
  Card,
  CardBody,
  Spinner,
  Alert,
  Label,
  Tooltip,
} from '@patternfly/react-core';
import {
  HourglassHalfIcon,
  SyncAltIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  BanIcon,
} from '@patternfly/react-icons';
import type { GraphRunDetail, NodeStatus } from '../types/api';
import { graphRunsApi } from '../services';

interface GraphRunDetailProps {
  /** Name of the graph run to visualize */
  graphRunName: string;
  /** Callback when a node is clicked */
  onNodeClick?: (nodeStatus: NodeStatus) => void;
}

/**
 * Custom node component for ReactFlow
 * Displays scenario name, status badge, and connections
 */
function ScenarioNode({ data }: NodeProps) {
  const { nodeStatus, onClick } = data;
  const phase = nodeStatus.phase as string;

  // Get phase display properties
  const getPhaseDisplay = (phase: string) => {
    switch (phase) {
      case 'Pending':
        return { icon: <HourglassHalfIcon />, color: 'orange' as const, label: 'Pending' };
      case 'Running':
        return { icon: <SyncAltIcon className="pf-m-spin" />, color: 'blue' as const, label: 'Running' };
      case 'Completed':
        return { icon: <CheckCircleIcon />, color: 'green' as const, label: 'Completed' };
      case 'Failed':
        return { icon: <ExclamationCircleIcon />, color: 'red' as const, label: 'Failed' };
      case 'Blocked':
        return { icon: <BanIcon />, color: 'grey' as const, label: 'Blocked' };
      default:
        return { icon: <ExclamationCircleIcon />, color: 'grey' as const, label: phase };
    }
  };

  const phaseDisplay = getPhaseDisplay(phase);

  return (
    <div
      onClick={() => onClick?.(nodeStatus)}
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        border: `2px solid ${
          phase === 'Completed' ? 'var(--pf-v5-global--success-color--100)' :
          phase === 'Failed' ? 'var(--pf-v5-global--danger-color--100)' :
          phase === 'Running' ? 'var(--pf-v5-global--info-color--100)' :
          phase === 'Blocked' ? 'var(--pf-v5-global--disabled-color--100)' :
          'var(--pf-v5-global--warning-color--100)'
        }`,
        backgroundColor: 'var(--pf-v5-global--BackgroundColor--100)',
        minWidth: '200px',
        cursor: 'pointer',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Input handle for dependencies (left side for horizontal flow) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'var(--pf-v5-global--BorderColor--300)' }}
      />

      {/* Node content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Status badge */}
        <div>
          <Label color={phaseDisplay.color} icon={phaseDisplay.icon} isCompact>
            {phaseDisplay.label}
          </Label>
        </div>

        {/* Scenario name */}
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
          {nodeStatus.nodeName}
        </div>

        {/* Node ID (small, grey) */}
        <div
          style={{
            fontSize: '11px',
            color: 'var(--pf-v5-global--Color--200)',
            fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
          }}
        >
          {nodeStatus.nodeId}
        </div>
      </div>

      {/* Output handle for dependents (right side for horizontal flow) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'var(--pf-v5-global--BorderColor--300)' }}
      />
    </div>
  );
}

// Register custom node type
const nodeTypes = {
  scenarioNode: ScenarioNode,
};

/**
 * Calculate graph layout using Dagre
 * Arranges nodes in topological order from top to bottom
 */
function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 220;
  const nodeHeight = 120;

  dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 150 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Main GraphRunDetail component
 */
export function GraphRunDetail({ graphRunName, onNodeClick }: GraphRunDetailProps) {
  const [graphRunDetail, setGraphRunDetail] = useState<GraphRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Fetch graph run details
  useEffect(() => {
    let mounted = true;

    const fetchGraphRunDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        const detail = await graphRunsApi.getGraphRun(graphRunName);

        if (mounted) {
          setGraphRunDetail(detail);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load graph run details');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchGraphRunDetail();

    return () => {
      mounted = false;
    };
  }, [graphRunName]);

  // Build ReactFlow nodes and edges from graph run data
  useEffect(() => {
    if (!graphRunDetail) return;

    // Filter out _comment nodes
    const nodeStatuses = graphRunDetail.status.nodeStatuses.filter(
      (nodeStatus: NodeStatus) => nodeStatus.nodeId !== '_comment'
    );

    // Create nodes
    const reactFlowNodes: Node[] = nodeStatuses.map((nodeStatus: NodeStatus) => ({
      id: nodeStatus.nodeId,
      type: 'scenarioNode',
      position: { x: 0, y: 0 }, // Will be calculated by dagre
      data: {
        nodeStatus,
        onClick: onNodeClick,
      },
    }));

    // Create edges from dependencies
    const reactFlowEdges: Edge[] = [];
    nodeStatuses.forEach((nodeStatus: NodeStatus) => {
      if (nodeStatus.dependsOn && nodeStatus.dependsOn.length > 0) {
        nodeStatus.dependsOn.forEach((dependencyId: string) => {
          // Skip edges that reference _comment nodes
          if (dependencyId === '_comment') return;

          reactFlowEdges.push({
            id: `${dependencyId}-${nodeStatus.nodeId}`,
            source: dependencyId,
            target: nodeStatus.nodeId,
            type: 'smoothstep',
            animated: nodeStatus.phase === 'Running',
            style: {
              stroke: nodeStatus.phase === 'Running'
                ? 'var(--pf-v5-global--info-color--100)'
                : 'var(--pf-v5-global--BorderColor--300)',
              strokeWidth: 2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: nodeStatus.phase === 'Running'
                ? 'var(--pf-v5-global--info-color--100)'
                : 'var(--pf-v5-global--BorderColor--300)',
            },
          });
        });
      }
    });

    // Layout nodes and edges (horizontal LR layout)
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      reactFlowNodes,
      reactFlowEdges,
      'LR'
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [graphRunDetail, onNodeClick, setNodes, setEdges]);

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardBody>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Spinner size="lg" aria-label="Loading graph run details" />
          </div>
        </CardBody>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardBody>
          <Alert variant="danger" isInline title="Failed to load graph run">
            {error}
          </Alert>
        </CardBody>
      </Card>
    );
  }

  // No data
  if (!graphRunDetail) {
    return null;
  }

  return (
    <Card isFlat>
      <CardBody>
        {/* Graph summary */}
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Tooltip content="Total nodes in the graph">
            <Label color="blue" isCompact>
              Total: {graphRunDetail.status.summary.totalNodes}
            </Label>
          </Tooltip>
          <Tooltip content="Successfully completed nodes">
            <Label color="green" icon={<CheckCircleIcon />} isCompact>
              Completed: {graphRunDetail.status.summary.completedNodes}
            </Label>
          </Tooltip>
          <Tooltip content="Currently running nodes">
            <Label color="blue" icon={<SyncAltIcon />} isCompact>
              Running: {graphRunDetail.status.summary.runningNodes}
            </Label>
          </Tooltip>
          <Tooltip content="Failed nodes">
            <Label color="red" icon={<ExclamationCircleIcon />} isCompact>
              Failed: {graphRunDetail.status.summary.failedNodes}
            </Label>
          </Tooltip>
          <Tooltip content="Pending nodes (waiting for dependencies)">
            <Label color="orange" icon={<HourglassHalfIcon />} isCompact>
              Pending: {graphRunDetail.status.summary.pendingNodes}
            </Label>
          </Tooltip>
        </div>

        {/* ReactFlow graph */}
        <div style={{ height: '600px', border: '1px solid var(--pf-v5-global--BorderColor--100)', borderRadius: '4px' }}>
          <style>{`
            .react-flow__attribution {
              background: rgba(255, 255, 255, 0.8) !important;
              padding: 2px 6px !important;
              border-radius: 3px !important;
              font-size: 10px !important;
            }
            .pf-v5-theme-dark .react-flow__attribution {
              background: rgba(0, 0, 0, 0.6) !important;
              color: rgba(255, 255, 255, 0.7) !important;
            }
            .react-flow__attribution a {
              color: var(--pf-v5-global--link--Color) !important;
              text-decoration: none !important;
            }
            .react-flow__attribution a:hover {
              text-decoration: underline !important;
            }
          `}</style>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            panOnDrag={true}
            fitView
            attributionPosition="bottom-left"
          >
            <Background />
            <Controls showZoom={false} showInteractive={false} position="top-right" />
          </ReactFlow>
        </div>
      </CardBody>
    </Card>
  );
}
