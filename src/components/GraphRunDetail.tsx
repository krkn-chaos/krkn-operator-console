/**
 * GraphRunDetail Component
 *
 * Visualizes a GraphRun as a directed acyclic graph (DAG) using ReactFlow.
 * Shows nodes with their status, dependencies, and allows clicking nodes to view details.
 * Similar to GitHub Actions workflow visualization.
 */

import { useState, useEffect, useCallback } from 'react';
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
import type { GraphRunDetail, NodeStatus, ClusterResiliencyScore, GraphClusterScore } from '../types/api';
import { graphRunsApi } from '../services';
import { ScenarioRunDetailModal } from './ScenarioRunDetailModal';
import { getScoreColor, getScoreLevel, formatScore, SCORE_CALCULATING } from '../utils/resiliency';

interface GraphRunDetailProps {
  /** Name of the graph run to visualize */
  graphRunName: string;
}

/**
 * Per-cluster resiliency score list with search and scrollable container
 */
function ClusterScoresSection({ scores }: { scores: GraphClusterScore[] }) {
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');

  const toggleCluster = (clusterName: string) => {
    setExpandedClusters(prev => {
      const next = new Set(prev);
      if (next.has(clusterName)) next.delete(clusterName);
      else next.add(clusterName);
      return next;
    });
  };

  const filteredScores = searchFilter
    ? scores.filter(cs => cs.clusterName.toLowerCase().includes(searchFilter.toLowerCase()))
    : scores;

  return (
    <div style={{
      marginBottom: '1rem',
      border: '1px solid var(--pf-v5-global--BorderColor--100)',
      borderRadius: '6px',
      overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)',
        borderBottom: '1px solid var(--pf-v5-global--BorderColor--100)',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
          Cluster Scores
          <Label color="blue" isCompact>{scores.length}</Label>
        </div>
        {scores.length > 3 && (
          <input
            type="text"
            placeholder="Search cluster..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            aria-label="Search clusters"
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              border: '1px solid var(--pf-v5-global--BorderColor--100)',
              borderRadius: '4px',
              backgroundColor: 'var(--pf-v5-global--BackgroundColor--100)',
              color: 'var(--pf-v5-global--Color--100)',
              width: '180px',
              outline: 'none',
            }}
          />
        )}
      </div>

      {/* Scrollable list */}
      <div style={{
        maxHeight: '240px',
        overflowY: 'auto',
      }}>
        {filteredScores.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--pf-v5-global--Color--200)', fontSize: '12px' }}>
            No clusters match &quot;{searchFilter}&quot;
          </div>
        ) : (
          filteredScores.map((cs, idx) => {
            const calculating = cs.calculated === SCORE_CALCULATING;
            const bgColor = calculating ? '#6c757d' : (cs.baseline != null ? getScoreColor(cs.calculated, cs.baseline) : '#17a2b8');
            const level = !calculating && cs.baseline != null ? getScoreLevel(cs.calculated, cs.baseline) : null;
            const contributions = cs.nodeContributions ? Object.entries(cs.nodeContributions) : [];
            const isExpanded = expandedClusters.has(cs.clusterName);

            return (
              <div
                key={cs.clusterName}
                style={{
                  borderBottom: idx < filteredScores.length - 1 ? '1px solid var(--pf-v5-global--BorderColor--100)' : 'none',
                  borderLeft: `4px solid ${bgColor}`,
                  padding: '8px 12px',
                }}
              >
                {/* Main row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}>
                  {/* Cluster name */}
                  <span style={{
                    fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
                    fontSize: '12px',
                    fontWeight: 600,
                    minWidth: '160px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {cs.clusterName}
                  </span>

                  {calculating ? (
                    <>
                      <SyncAltIcon className="pf-m-spin" style={{ color: '#6c757d' }} />
                      <Label color="grey" icon={<SyncAltIcon className="pf-m-spin" />} isCompact>
                        Calculating...
                      </Label>
                    </>
                  ) : (
                    <>
                      {/* Score */}
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: bgColor, minWidth: '45px' }}>
                        {formatScore(cs.calculated)}
                      </span>

                      {/* Level badge */}
                      {level ? (
                        <Tooltip content={level.description}>
                          <Label
                            color={
                              level.label === 'Excellent' || level.label === 'Good' ? 'green'
                                : level.label === 'Warning' || level.label === 'Poor' ? 'orange'
                                : 'red'
                            }
                            icon={
                              level.label === 'Excellent' || level.label === 'Good'
                                ? <CheckCircleIcon />
                                : level.label === 'Critical'
                                ? <ExclamationCircleIcon />
                                : undefined
                            }
                            isCompact
                          >
                            {level.label}
                          </Label>
                        </Tooltip>
                      ) : (
                        <Label color="blue" isCompact>No Baseline</Label>
                      )}
                    </>
                  )}

                  {/* Baseline info */}
                  {cs.baseline != null && (
                    <span style={{ fontSize: '11px', color: 'var(--pf-v5-global--Color--200)' }}>
                      Baseline: {formatScore(cs.baseline)}
                    </span>
                  )}

                  {/* Spacer */}
                  <span style={{ flex: 1 }} />

                  {/* Node breakdown toggle */}
                  {contributions.length > 0 && (
                    <button
                      onClick={() => toggleCluster(cs.clusterName)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--pf-v5-global--link--Color)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        padding: '2px 4px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isExpanded ? '▾' : '▸'} {contributions.length} nodes
                    </button>
                  )}
                </div>

                {/* Expanded node contributions */}
                {isExpanded && contributions.length > 0 && (
                  <div style={{
                    marginTop: '6px',
                    marginLeft: '8px',
                    borderLeft: '2px solid var(--pf-v5-global--BorderColor--100)',
                    paddingLeft: '10px',
                  }}>
                    {contributions.map(([nodeId, nodeScore]) => {
                      const nodeColor = cs.baseline != null ? getScoreColor(nodeScore, cs.baseline) : '#17a2b8';
                      return (
                        <div key={nodeId} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '1px 0',
                          fontSize: '11px',
                          maxWidth: '300px',
                        }}>
                          <span style={{
                            fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '200px',
                          }}>
                            {nodeId}
                          </span>
                          <span style={{ fontWeight: 'bold', color: nodeColor }}>
                            {formatScore(nodeScore)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Custom node component for ReactFlow
 * Displays scenario name, status badge, resiliency score, and connections
 */
function ScenarioNode({ data }: NodeProps) {
  const { nodeStatus, onClick, resiliencyBaseline, resiliencyEnabled } = data;
  const phase = nodeStatus.phase as string;
  const clusterScores: ClusterResiliencyScore[] | undefined = nodeStatus.resiliencyScores;
  const nodeScore: number | undefined = nodeStatus.resiliencyScoreAvg
    ?? (clusterScores?.length === 1 ? clusterScores[0].score : undefined);
  const isMultiCluster = (clusterScores?.length ?? 0) > 1;

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

  const hasScore = resiliencyEnabled && nodeScore !== undefined;
  const scoreColor = hasScore && resiliencyBaseline
    ? getScoreColor(nodeScore, resiliencyBaseline)
    : '#17a2b8';
  const scoreLevel = hasScore && resiliencyBaseline
    ? getScoreLevel(nodeScore, resiliencyBaseline)
    : null;

  const scoreTooltipContent = hasScore ? (
    <div style={{ maxWidth: '300px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '8px', paddingBottom: '6px',
        borderBottom: `2px solid ${scoreColor}`,
      }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '6px',
          backgroundColor: scoreColor, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 'bold', fontSize: '11px',
        }}>
          {nodeScore.toFixed(1)}
        </div>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '13px' }}>
            Resiliency Score{isMultiCluster ? ' (avg)' : ''}
          </div>
          <div style={{ fontSize: '11px', color: scoreColor, fontWeight: 600 }}>
            {scoreLevel?.label}
          </div>
        </div>
      </div>
      <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
        <div style={{ marginBottom: '4px' }}>
          This node scored <strong>{nodeScore.toFixed(1)}</strong>{isMultiCluster ? ' (average)' : ''} against a
          workflow baseline of <strong>{resiliencyBaseline?.toFixed(1)}</strong>.
        </div>
        <div style={{ color: scoreColor, fontStyle: 'italic', fontSize: '11px', marginBottom: isMultiCluster ? '8px' : '0' }}>
          {scoreLevel?.description}
        </div>
        {isMultiCluster && clusterScores && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '6px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}>Per-Cluster Scores:</div>
            {clusterScores.map((cs: ClusterResiliencyScore) => {
              const clusterColor = resiliencyBaseline ? getScoreColor(cs.score, resiliencyBaseline) : '#17a2b8';
              return (
                <div key={cs.clusterName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{cs.clusterName}</span>
                  <span style={{ fontWeight: 'bold', fontSize: '11px', color: clusterColor }}>{cs.score.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      {phase === 'Running' && (
        <style>{`
          @keyframes pulse-border {
            0%, 100% { box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.4); }
            50% { box-shadow: 0 0 0 8px rgba(0, 123, 255, 0); }
          }
          @keyframes glow {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(1.2); }
          }
        `}</style>
      )}
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
          minWidth: '220px',
          cursor: 'pointer',
          boxShadow: phase === 'Running'
            ? '0 2px 4px rgba(0,0,0,0.1), 0 0 0 0 rgba(0, 123, 255, 0.4)'
            : '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.2s ease',
          animation: phase === 'Running' ? 'pulse-border 2s ease-in-out infinite, glow 2s ease-in-out infinite' : 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          if (phase === 'Running') {
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1), 0 0 0 0 rgba(0, 123, 255, 0.4)';
          } else {
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
          }
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'var(--pf-v5-global--BorderColor--300)' }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Top row: status badge + resiliency score badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <Label color={phaseDisplay.color} icon={phaseDisplay.icon} isCompact>
            {phaseDisplay.label}
          </Label>

          {hasScore && (
            <Tooltip content={scoreTooltipContent}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                backgroundColor: scoreColor,
                color: 'white',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {nodeScore.toFixed(1)}{isMultiCluster && <span style={{ fontSize: '9px', marginLeft: '2px', opacity: 0.8 }}>avg</span>}
              </div>
            </Tooltip>
          )}

          {resiliencyEnabled && !clusterScores?.length && (phase === 'Running' || phase === 'Completed') && (
            <Tooltip content={
              phase === 'Running'
                ? "Resiliency score will be calculated when this node completes"
                : "Resiliency score is being calculated..."
            }>
              <div style={{
                backgroundColor: '#6c757d',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: 'bold',
              }}>
                ···
              </div>
            </Tooltip>
          )}
        </div>

        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
          {nodeStatus.nodeName}
        </div>

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

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'var(--pf-v5-global--BorderColor--300)' }}
      />
    </div>
    </>
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
export function GraphRunDetail({ graphRunName }: GraphRunDetailProps) {
  const [graphRunDetail, setGraphRunDetail] = useState<GraphRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedScenarioRunName, setSelectedScenarioRunName] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handle node click - open detail modal
  const handleNodeClick = useCallback((nodeStatus: NodeStatus) => {
    if (nodeStatus.scenarioRunRef) {
      setSelectedScenarioRunName(nodeStatus.scenarioRunRef);
      setIsModalOpen(true);
    }
  }, []);

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

  // Poll for updates every 2 seconds
  useEffect(() => {
    // Don't poll if still loading or if there's an error
    if (loading || error || !graphRunDetail) return;

    // Check if all nodes are in terminal state
    const allTerminal = graphRunDetail.status.nodeStatuses
      .filter((ns: NodeStatus) => ns.nodeId !== '_comment')
      .every((ns: NodeStatus) =>
        ns.phase === 'Completed' || ns.phase === 'Failed' || ns.phase === 'Blocked'
      );

    // Stop polling if all nodes are done
    if (allTerminal) return;

    const pollInterval = setInterval(async () => {
      try {
        const detail = await graphRunsApi.getGraphRun(graphRunName);
        setGraphRunDetail(detail);
      } catch (err) {
        // Silently ignore polling errors to avoid disrupting the UI
        console.error('Failed to poll graph run status:', err);
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [graphRunName, loading, error, graphRunDetail]);

  // Build ReactFlow nodes and edges from graph run data
  useEffect(() => {
    if (!graphRunDetail) return;

    // Filter out _comment nodes
    const nodeStatuses = graphRunDetail.status.nodeStatuses.filter(
      (nodeStatus: NodeStatus) => nodeStatus.nodeId !== '_comment'
    );

    const resiliencyEnabled = graphRunDetail.spec.resiliencyScoreEnabled ?? false;
    const resiliencyBaseline = graphRunDetail.spec.resiliencyScoreBaseline;

    // Create nodes
    const reactFlowNodes: Node[] = nodeStatuses.map((nodeStatus: NodeStatus) => ({
      id: nodeStatus.nodeId,
      type: 'scenarioNode',
      position: { x: 0, y: 0 },
      data: {
        nodeStatus,
        onClick: handleNodeClick,
        resiliencyEnabled,
        resiliencyBaseline,
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
  }, [graphRunDetail, handleNodeClick, setNodes, setEdges]);

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

  // Calculate summary excluding _comment nodes
  const filteredNodes = graphRunDetail.status.nodeStatuses.filter(
    (ns: NodeStatus) => ns.nodeId !== '_comment'
  );
  const summary = {
    totalNodes: filteredNodes.length,
    completedNodes: filteredNodes.filter((ns: NodeStatus) => ns.phase === 'Completed').length,
    runningNodes: filteredNodes.filter((ns: NodeStatus) => ns.phase === 'Running').length,
    failedNodes: filteredNodes.filter((ns: NodeStatus) => ns.phase === 'Failed').length,
    pendingNodes: filteredNodes.filter((ns: NodeStatus) => ns.phase === 'Pending').length,
  };

  const clusterScoresOverall = graphRunDetail.status.resiliencyScores;
  const specEnabled = graphRunDetail.spec.resiliencyScoreEnabled;

  return (
    <Card isFlat>
      <CardBody>
        {/* Graph summary */}
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Tooltip content="Total nodes in the graph">
            <Label color="blue" isCompact>
              Total: {summary.totalNodes}
            </Label>
          </Tooltip>
          <Tooltip content="Successfully completed nodes">
            <Label color="green" icon={<CheckCircleIcon />} isCompact>
              Completed: {summary.completedNodes}
            </Label>
          </Tooltip>
          <Tooltip content="Currently running nodes">
            <Label color="blue" icon={<SyncAltIcon />} isCompact>
              Running: {summary.runningNodes}
            </Label>
          </Tooltip>
          <Tooltip content="Failed nodes">
            <Label color="red" icon={<ExclamationCircleIcon />} isCompact>
              Failed: {summary.failedNodes}
            </Label>
          </Tooltip>
          <Tooltip content="Pending nodes (waiting for dependencies)">
            <Label color="orange" icon={<HourglassHalfIcon />} isCompact>
              Pending: {summary.pendingNodes}
            </Label>
          </Tooltip>

        </div>

        {/* Per-cluster resiliency score cards */}
        {specEnabled && clusterScoresOverall && clusterScoresOverall.length > 0 && (
          <ClusterScoresSection scores={clusterScoresOverall} />
        )}

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

      {/* Scenario Run Detail Modal */}
      <ScenarioRunDetailModal
        scenarioRunName={selectedScenarioRunName}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </Card>
  );
}
