import {
  Card,
  CardBody,
  CardTitle,
  Title,
  List,
  ListItem,
  Label,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
} from '@patternfly/react-core';
import { ServerIcon } from '@patternfly/react-icons';
import type { SelectedCluster } from '../types/api';

interface NodesDisplayProps {
  selectedCluster: SelectedCluster;
  nodes: string[] | null;
}

export function NodesDisplay({ selectedCluster, nodes }: NodesDisplayProps) {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Cluster Info Header */}
      <Card style={{ marginBottom: '1.5rem', backgroundColor: 'var(--pf-v5-global--palette--blue-50)' }}>
        <CardBody>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <ServerIcon style={{ fontSize: '2rem' }} />
            <div>
              <Title headingLevel="h2" size="xl">
                {selectedCluster.clusterName}
              </Title>
              <div style={{ fontSize: '0.875rem', color: 'var(--pf-v5-global--Color--200)', marginTop: '0.25rem' }}>
                <strong>Operator:</strong> {selectedCluster.operatorName}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--pf-v5-global--Color--200)' }}>
                <strong>API URL:</strong> {selectedCluster.clusterApiUrl}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Nodes List */}
      <Card>
        <CardTitle>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Cluster Nodes</span>
            {nodes && <Label color="blue">{nodes.length} nodes</Label>}
          </div>
        </CardTitle>
        <CardBody>
          {!nodes || nodes.length === 0 ? (
            <EmptyState>
              <EmptyStateIcon icon={ServerIcon} />
              <Title headingLevel="h3" size="lg">
                No Nodes Found
              </Title>
              <EmptyStateBody>
                No nodes were discovered in the selected cluster.
              </EmptyStateBody>
            </EmptyState>
          ) : (
            <List isPlain isBordered>
              {nodes.map((nodeName, index) => (
                <ListItem key={`${nodeName}-${index}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ServerIcon />
                    <span style={{ fontFamily: 'monospace' }}>{nodeName}</span>
                  </div>
                </ListItem>
              ))}
            </List>
          )}
        </CardBody>
      </Card>

      {/* Placeholder for future chaos scenario selection */}
      <Card style={{ marginTop: '1.5rem' }}>
        <CardBody style={{ textAlign: 'center', padding: '2rem', color: 'var(--pf-v5-global--Color--200)' }}>
          <Title headingLevel="h3" size="md">
            Chaos Scenario Selection
          </Title>
          <div style={{ marginTop: '0.5rem' }}>
            Coming soon: Select and configure chaos scenarios to run on this cluster
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
