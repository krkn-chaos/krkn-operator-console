/**
 * StudioCanvas - ReactFlow canvas for visual workflow design
 *
 * Features:
 * - Editable graph (drag, connect)
 * - Custom node components
 * - Real-time validation
 */

import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Connection,
  MarkerType,
  OnConnectStart,
  OnConnectEnd,
  EdgeProps,
  getBezierPath,
  BaseEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@patternfly/react-core';
import { TimesIcon } from '@patternfly/react-icons';
import { useStudioContext } from './StudioContext';
import { StudioNode } from './StudioNode';
import { StudioNodeContextMenu } from './StudioNodeContextMenu';
import { StudioNodeModals } from './StudioNodeModals';
import type { StudioNode as StudioNodeType } from '../../types/api';

// Custom edge with delete button
function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const { deleteEdge } = useStudioContext();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteEdge(id);
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <foreignObject
        width={24}
        height={24}
        x={labelX - 12}
        y={labelY - 12}
        className="edgebutton-foreignobject"
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Button
            variant="danger"
            style={{
              width: '24px',
              height: '24px',
              padding: 0,
              minWidth: 'unset',
              fontSize: '10px',
            }}
            onClick={handleDelete}
            aria-label="Delete connection"
          >
            <TimesIcon />
          </Button>
        </div>
      </foreignObject>
    </>
  );
}

const nodeTypes = {
  studioNode: StudioNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
};

interface StudioCanvasProps {
  onNodeClick?: (node: StudioNodeType) => void;
}

export function StudioCanvas({ onNodeClick }: StudioCanvasProps) {
  const { workflow, updateNode, addEdge, validateConnection } = useStudioContext();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [cloneModal, setCloneModal] = useState<{ nodeId: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ nodeId: string } | null>(null);

  // Convert Studio workflow to ReactFlow nodes and edges
  useEffect(() => {
    // Check if hovered node would create an invalid connection
    let wouldBeInvalidTarget = false;
    if (connectingFrom && hoveredNode && connectingFrom !== hoveredNode) {
      const validation = validateConnection(connectingFrom, hoveredNode);
      wouldBeInvalidTarget = !validation.valid;
    }

    // Create ReactFlow nodes
    const reactFlowNodes: Node[] = workflow.nodes.map((node: StudioNodeType) => ({
      id: node.nodeId,
      type: 'studioNode',
      position: node.position,
      data: {
        node,
        onNodeClick,
        isInvalidConnectionTarget: connectingFrom && hoveredNode === node.nodeId && wouldBeInvalidTarget,
        onMouseEnter: () => setHoveredNode(node.nodeId),
        onMouseLeave: () => setHoveredNode(null),
        contextMenuOpen: contextMenu?.nodeId === node.nodeId,
      },
    }));

    // Create ReactFlow edges with delete button
    const reactFlowEdges: Edge[] = workflow.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'deletable',
      animated: false,
      style: {
        stroke: 'var(--pf-v5-global--BorderColor--300)',
        strokeWidth: 2,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'var(--pf-v5-global--BorderColor--300)',
      },
    }));

    setNodes(reactFlowNodes);
    setEdges(reactFlowEdges);
  }, [workflow, setNodes, setEdges, onNodeClick, connectingFrom, hoveredNode, validateConnection, contextMenu]);

  // Handle node context menu (right-click)
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        nodeId: node.id,
        x: event.clientX,
        y: event.clientY,
      });
    },
    []
  );

  // Close context menu
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle node position changes
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);

      // Update positions in workflow state
      changes.forEach((change: any) => {
        if (change.type === 'position' && change.position) {
          updateNode(change.id, { position: change.position });
        }
      });
    },
    [onNodesChange, updateNode]
  );

  // Handle connection creation
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const result = addEdge(connection.source, connection.target);
      if (!result.valid && result.error) {
        alert(result.error); // TODO: Replace with toast notification
      } else if (result.warning) {
        // Connection created but with warning - user can see visual feedback
        console.warn(result.warning);
      }
    },
    [addEdge]
  );

  // Validate connection before allowing it
  const isValidConnection = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return false;

      const result = validateConnection(connection.source, connection.target);
      return result.valid;
    },
    [validateConnection]
  );

  // Handle connection start (user starts dragging from a handle)
  const handleConnectStart: OnConnectStart = useCallback(
    (_event, params) => {
      if (params.nodeId) {
        setConnectingFrom(params.nodeId);
      }
    },
    []
  );

  // Handle connection end (user releases the drag)
  const handleConnectEnd: OnConnectEnd = useCallback(
    () => {
      setConnectingFrom(null);
      setHoveredNode(null);
    },
    []
  );

  // Dynamic connection line style (red if targeting unconfigured node)
  const getConnectionLineStyle = () => {
    if (connectingFrom && hoveredNode && connectingFrom !== hoveredNode) {
      const validation = validateConnection(connectingFrom, hoveredNode);
      if (!validation.valid) {
        return {
          stroke: 'var(--pf-v5-global--danger-color--100)',
          strokeWidth: 2,
        };
      }
    }
    return {
      stroke: 'var(--pf-v5-global--BorderColor--300)',
      strokeWidth: 2,
    };
  };

  // Empty state
  if (workflow.nodes.length === 0) {
    return (
      <div
        style={{
          height: '600px',
          border: '2px dashed var(--pf-v5-global--BorderColor--100)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)',
        }}
      >
        <div style={{ textAlign: 'center', color: 'var(--pf-v5-global--Color--200)' }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No scenarios yet</p>
          <p>Click "Add Scenario" to start building your workflow</p>
        </div>
      </div>
    );
  }

  // Get nodes for modals
  const contextMenuNode = contextMenu
    ? workflow.nodes.find(n => n.nodeId === contextMenu.nodeId)
    : null;

  const cloneNodeData = cloneModal
    ? workflow.nodes.find(n => n.nodeId === cloneModal.nodeId)
    : null;

  const deleteNodeData = deleteModal
    ? workflow.nodes.find(n => n.nodeId === deleteModal.nodeId)
    : null;

  return (
    <div style={{ height: '600px', border: '1px solid var(--pf-v5-global--BorderColor--100)', borderRadius: '4px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onNodeContextMenu={handleNodeContextMenu}
        isValidConnection={isValidConnection}
        connectionLineStyle={getConnectionLineStyle()}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        deleteKeyCode={null} // Disable delete key (use delete button on edge instead)
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>

      {/* Context Menu */}
      {contextMenu && contextMenuNode && (
        <StudioNodeContextMenu
          node={contextMenuNode}
          onEdit={(node) => {
            onNodeClick?.(node);
            handleCloseContextMenu();
          }}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={handleCloseContextMenu}
          onOpenClone={(nodeId) => setCloneModal({ nodeId })}
          onOpenDelete={(nodeId) => setDeleteModal({ nodeId })}
        />
      )}

      {/* Clone & Delete Modals */}
      <StudioNodeModals
        cloneNode={cloneNodeData || null}
        deleteNode={deleteNodeData || null}
        onCloseClone={() => setCloneModal(null)}
        onCloseDelete={() => setDeleteModal(null)}
      />
    </div>
  );
}
