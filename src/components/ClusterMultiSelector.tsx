import { useMemo } from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  Checkbox,
  Button,
  Title,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  Badge,
  Flex,
  FlexItem,
  ActionGroup,
} from '@patternfly/react-core';
import { CubesIcon } from '@patternfly/react-icons';
import type { Cluster, SelectedCluster } from '../types/api';

interface ClusterMultiSelectorProps {
  clusters: { [operatorName: string]: Cluster[] } | null;
  selectedClusters: SelectedCluster[];
  onToggle: (cluster: SelectedCluster) => void;
  onProceed: () => void;
  onCancel: () => void;
}

export function ClusterMultiSelector({
  clusters,
  selectedClusters,
  onToggle,
  onProceed,
  onCancel,
}: ClusterMultiSelectorProps) {
  // Helper to check if a cluster is selected
  const isSelected = (operatorName: string, clusterName: string): boolean => {
    return selectedClusters.some(
      (c) => c.operatorName === operatorName && c.clusterName === clusterName
    );
  };

  // Get all clusters as flat list for Select All / Deselect All
  const allClusters = useMemo(() => {
    if (!clusters) return [];

    const flatList: SelectedCluster[] = [];
    Object.entries(clusters).forEach(([operatorName, clusterList]) => {
      clusterList.forEach((cluster) => {
        flatList.push({
          operatorName,
          clusterName: cluster['cluster-name'],
          clusterApiUrl: cluster['cluster-api-url'],
        });
      });
    });
    return flatList;
  }, [clusters]);

  const handleSelectAll = () => {
    allClusters.forEach((cluster) => {
      if (!isSelected(cluster.operatorName, cluster.clusterName)) {
        onToggle(cluster);
      }
    });
  };

  const handleDeselectAll = () => {
    selectedClusters.forEach((cluster) => {
      onToggle(cluster);
    });
  };

  // Empty state
  if (!clusters || Object.keys(clusters).length === 0) {
    return (
      <EmptyState>
        <EmptyStateIcon icon={CubesIcon} />
        <Title headingLevel="h1" size="lg">
          No Clusters Found
        </Title>
        <EmptyStateBody>
          No target clusters were discovered. Please check your operator configuration.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <Card>
        <CardTitle>
          <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
            <FlexItem>
              <Title headingLevel="h1" size="2xl">
                Select Target Clusters
              </Title>
            </FlexItem>
            <FlexItem>
              <Badge isRead>{selectedClusters.length} selected</Badge>
            </FlexItem>
          </Flex>
        </CardTitle>
        <CardBody>
          <ActionGroup style={{ marginBottom: '1rem' }}>
            <Button variant="link" onClick={handleSelectAll} size="sm">
              Select All
            </Button>
            <Button
              variant="link"
              onClick={handleDeselectAll}
              size="sm"
              isDisabled={selectedClusters.length === 0}
            >
              Deselect All
            </Button>
          </ActionGroup>

          {Object.entries(clusters).map(([operatorName, clusterList]) => (
            <Card key={operatorName} style={{ marginBottom: '1rem' }} isCompact>
              <CardTitle>{operatorName}</CardTitle>
              <CardBody>
                <DataList aria-label={`Clusters for ${operatorName}`} isCompact>
                  {clusterList.map((cluster) => {
                    const clusterId = `${operatorName}-${cluster['cluster-name']}`;
                    const checked = isSelected(operatorName, cluster['cluster-name']);

                    return (
                      <DataListItem key={clusterId} aria-labelledby={clusterId}>
                        <DataListItemRow>
                          <DataListItemCells
                            dataListCells={[
                              <DataListCell key="checkbox">
                                <Checkbox
                                  id={clusterId}
                                  isChecked={checked}
                                  onChange={() =>
                                    onToggle({
                                      operatorName,
                                      clusterName: cluster['cluster-name'],
                                      clusterApiUrl: cluster['cluster-api-url'],
                                    })
                                  }
                                  label={
                                    <div>
                                      <div style={{ fontWeight: 'bold' }}>
                                        {cluster['cluster-name']}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '0.875rem',
                                          color: 'var(--pf-v5-global--Color--200)',
                                        }}
                                      >
                                        {cluster['cluster-api-url']}
                                      </div>
                                    </div>
                                  }
                                />
                              </DataListCell>,
                            ]}
                          />
                        </DataListItemRow>
                      </DataListItem>
                    );
                  })}
                </DataList>
              </CardBody>
            </Card>
          ))}

          <ActionGroup style={{ marginTop: '1.5rem' }}>
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={onProceed}
              isDisabled={selectedClusters.length === 0}
              size="lg"
            >
              {selectedClusters.length > 0
                ? `Proceed with ${selectedClusters.length} cluster${
                    selectedClusters.length === 1 ? '' : 's'
                  }`
                : 'Select clusters to proceed'}
            </Button>
          </ActionGroup>
        </CardBody>
      </Card>
    </div>
  );
}
