import { useState } from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  Radio,
  Button,
  Title,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
} from '@patternfly/react-core';
import { CubesIcon } from '@patternfly/react-icons';
import type { Cluster, SelectedCluster } from '../types/api';

interface ClusterSelectorProps {
  clusters: { [operatorName: string]: Cluster[] } | null;
  onSelect: (cluster: SelectedCluster) => void;
}

export function ClusterSelector({ clusters, onSelect }: ClusterSelectorProps) {
  const [selectedCluster, setSelectedCluster] = useState<SelectedCluster | null>(null);

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

  const handleRadioChange = (operatorName: string, cluster: Cluster) => {
    setSelectedCluster({
      operatorName,
      clusterName: cluster['cluster-name'],
      clusterApiUrl: cluster['cluster-api-url'],
    });
  };

  const handleProceed = () => {
    if (selectedCluster) {
      onSelect(selectedCluster);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Title headingLevel="h1" size="2xl" style={{ marginBottom: '1rem' }}>
        Select Target Cluster
      </Title>

      {Object.entries(clusters).map(([operatorName, clusterList]) => (
        <Card key={operatorName} style={{ marginBottom: '1rem' }}>
          <CardTitle>{operatorName}</CardTitle>
          <CardBody>
            <DataList aria-label={`Clusters for ${operatorName}`}>
              {clusterList.map((cluster) => {
                const clusterId = `${operatorName}-${cluster['cluster-name']}`;
                const isSelected =
                  selectedCluster?.operatorName === operatorName &&
                  selectedCluster?.clusterName === cluster['cluster-name'];

                return (
                  <DataListItem key={clusterId} aria-labelledby={clusterId}>
                    <DataListItemRow>
                      <DataListItemCells
                        dataListCells={[
                          <DataListCell key="radio">
                            <Radio
                              id={clusterId}
                              name="cluster-selection"
                              isChecked={isSelected}
                              onChange={() => handleRadioChange(operatorName, cluster)}
                              label={
                                <div>
                                  <div style={{ fontWeight: 'bold' }}>
                                    {cluster['cluster-name']}
                                  </div>
                                  <div style={{ fontSize: '0.875rem', color: 'var(--pf-v5-global--Color--200)' }}>
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

      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <Button
          variant="primary"
          isDisabled={!selectedCluster}
          onClick={handleProceed}
          size="lg"
        >
          {selectedCluster
            ? `Proceed with ${selectedCluster.clusterName}`
            : 'Select a cluster to proceed'}
        </Button>
      </div>
    </div>
  );
}
