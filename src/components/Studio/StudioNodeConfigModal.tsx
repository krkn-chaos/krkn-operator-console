/**
 * StudioNodeConfigModal - Read-only view of a node's scenario configuration
 *
 * Displays scenario name, image, form values, and global values
 * in the standard dl/dt/dd layout.
 */

import {
  Modal,
  ModalVariant,
  Button,
} from '@patternfly/react-core';
import type { StudioNode } from '../../types/api';

const SENSITIVE_PATTERNS = /PASSWORD|SECRET|TOKEN|KEY|CREDENTIALS/i;

interface StudioNodeConfigModalProps {
  node: StudioNode | null;
  onClose: () => void;
}

function formatValue(key: string, value: string | number | boolean | File): string {
  if (SENSITIVE_PATTERNS.test(key)) return '********';
  if (value instanceof File) return value.name;
  return String(value);
}

export function StudioNodeConfigModal({ node, onClose }: StudioNodeConfigModalProps) {
  if (!node?.config) return null;

  const { config } = node;
  const formEntries = Object.entries(config.scenarioFormValues || {})
    .filter(([, v]) => v !== '' && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const globalEntries = Object.entries(config.globalFormValues || {})
    .filter(([key]) => config.globalTouchedFields?.[key])
    .filter(([, v]) => v !== '' && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const volumeEntries = Object.entries(config.volumes || {}).sort(([a], [b]) => a.localeCompare(b));

  const dlStyle = { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', margin: 0 } as const;
  const dtStyle = { fontWeight: 'bold' } as const;
  const ddStyle = { margin: 0, fontFamily: 'monospace', fontSize: 'var(--pf-v5-global--FontSize--sm)' } as const;
  const sectionStyle = { padding: '1rem', backgroundColor: 'var(--pf-v5-global--BackgroundColor--200)', borderRadius: '4px' } as const;
  const labelStyle = {
    margin: 0,
    marginBottom: '0.5rem',
    fontSize: 'var(--pf-v5-global--FontSize--sm)',
    fontWeight: 600,
    color: 'var(--pf-v5-global--Color--200)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  };

  return (
    <Modal
      variant={ModalVariant.medium}
      title={`Configuration: ${node.nodeId}`}
      isOpen
      onClose={onClose}
      actions={[
        <Button key="close" variant="primary" onClick={onClose}>
          Close
        </Button>,
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Scenario Settings */}
        <div style={sectionStyle}>
          <p style={labelStyle}>Scenario Settings</p>
          <dl style={dlStyle}>
            <dt style={dtStyle}>Scenario Name:</dt>
            <dd style={ddStyle}>{config.scenarioName}</dd>

            <dt style={dtStyle}>Scenario Image:</dt>
            <dd style={{ ...ddStyle, wordBreak: 'break-all' }}>{config.scenarioImage}</dd>

            <dt style={dtStyle}>Registry:</dt>
            <dd style={ddStyle}>
              {config.registryType === 'private' ? config.registryConfig.registryName || 'private' : 'public'}
            </dd>
          </dl>
        </div>

        {/* Scenario Variables */}
        {formEntries.length > 0 && (
          <div style={sectionStyle}>
            <p style={labelStyle}>Scenario Variables</p>
            <dl style={dlStyle}>
              {formEntries.map(([key, value]) => (
                <div key={key} style={{ display: 'contents' }}>
                  <dt style={dtStyle}>{key}:</dt>
                  <dd style={ddStyle}>{formatValue(key, value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Global Parameters */}
        {globalEntries.length > 0 && (
          <div style={sectionStyle}>
            <p style={labelStyle}>Global Parameters</p>
            <dl style={dlStyle}>
              {globalEntries.map(([key, value]) => (
                <div key={key} style={{ display: 'contents' }}>
                  <dt style={dtStyle}>{key}:</dt>
                  <dd style={ddStyle}>{formatValue(key, value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Volumes */}
        {volumeEntries.length > 0 && (
          <div style={sectionStyle}>
            <p style={labelStyle}>Volumes</p>
            <dl style={dlStyle}>
              {volumeEntries.map(([key, value]) => (
                <div key={key} style={{ display: 'contents' }}>
                  <dt style={dtStyle}>{key}:</dt>
                  <dd style={ddStyle}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </Modal>
  );
}
