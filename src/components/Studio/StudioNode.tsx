/**
 * StudioNode - Custom ReactFlow node component
 *
 * Displays scenario node in two states:
 * - Unconfigured: Placeholder with "Configure" prompt
 * - Configured: Shows scenario name and status
 *
 * Interactions:
 * - Left-click: Open configuration wizard
 * - Right-click: Context menu (Edit, Clone, Delete)
 */

import { NodeProps, Handle, Position } from 'reactflow';
import { Label } from '@patternfly/react-core';
import { CogIcon, CheckCircleIcon } from '@patternfly/react-icons';
import type { StudioNode as StudioNodeType } from '../../types/api';

export function StudioNode({ data }: NodeProps) {
  const node: StudioNodeType = data.node;
  const onNodeClick = data.onNodeClick as ((node: StudioNodeType) => void) | undefined;
  const isInvalidConnectionTarget = data.isInvalidConnectionTarget as boolean | undefined;
  const onMouseEnter = data.onMouseEnter as (() => void) | undefined;
  const onMouseLeave = data.onMouseLeave as (() => void) | undefined;

  const isConfigured = node.status === 'configured';

  const handleClick = () => {
    onNodeClick?.(node);
  };

  // Border color logic
  const getBorderColor = () => {
    if (isInvalidConnectionTarget) {
      return 'var(--pf-v5-global--danger-color--100)'; // Red when being targeted for invalid connection
    }
    if (isConfigured) {
      return 'var(--pf-v5-global--success-color--100)'; // Green for configured
    }
    return 'var(--pf-v5-global--BorderColor--200)'; // Grey for unconfigured
  };

  return (
    <>
      {/* Input handle (left side) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'var(--pf-v5-global--BorderColor--300)' }}
      />

      {/* Node content */}
      <div
        className="nopan"
        onClick={handleClick}
        onMouseEnter={(e) => {
          onMouseEnter?.();
          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          onMouseLeave?.();
          e.currentTarget.style.boxShadow = isInvalidConnectionTarget
            ? '0 0 8px rgba(201, 25, 11, 0.3)'
            : '0 2px 4px rgba(0,0,0,0.1)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
        style={{
          padding: '12px 16px',
          borderRadius: '8px',
          border: `2px solid ${getBorderColor()}`,
          backgroundColor: 'var(--pf-v5-global--BackgroundColor--100)',
          minWidth: '200px',
          cursor: 'pointer',
          boxShadow: isInvalidConnectionTarget
            ? '0 0 8px rgba(201, 25, 11, 0.3)'
            : '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Status badge */}
          <div>
            {isConfigured ? (
              <Label color="green" icon={<CheckCircleIcon />} isCompact>
                Configured
              </Label>
            ) : (
              <Label color="grey" icon={<CogIcon />} isCompact>
                Unconfigured
              </Label>
            )}
          </div>

          {/* Scenario name or placeholder */}
          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
            {isConfigured && node.config
              ? node.config.scenarioName
              : 'Click to configure'}
          </div>

          {/* Node ID */}
          <div
            style={{
              fontSize: '11px',
              color: 'var(--pf-v5-global--Color--200)',
              fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
            }}
          >
            {node.nodeId}
          </div>

          {/* Hint */}
          <div
            style={{
              fontSize: '10px',
              color: 'var(--pf-v5-global--Color--200)',
              fontStyle: 'italic',
              marginTop: '4px',
              borderTop: '1px solid var(--pf-v5-global--BorderColor--100)',
              paddingTop: '4px',
            }}
          >
            Right-click for options
          </div>
        </div>
      </div>

      {/* Output handle (right side) - disabled if unconfigured */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: isConfigured
            ? 'var(--pf-v5-global--BorderColor--300)'
            : 'var(--pf-v5-global--disabled-color--200)',
          cursor: isConfigured ? 'crosshair' : 'not-allowed',
        }}
        isConnectable={isConfigured}
      />
    </>
  );
}
