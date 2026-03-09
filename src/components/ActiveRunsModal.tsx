/**
 * ActiveRunsModal Component
 *
 * Displays a modal with tree view of active scenario runs grouped by cluster.
 * Shows cluster names as parent nodes and scenario run names as children.
 * Maximum depth: 1 (cluster -> runs)
 */

import {
  Modal,
  ModalVariant,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  Title,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
} from '@patternfly/react-core';
import { TopologyIcon } from '@patternfly/react-icons';
import type { ActiveRunsResponse } from '../types/api';

interface ActiveRunsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRuns: ActiveRunsResponse | null;
}

export function ActiveRunsModal({ isOpen, onClose, activeRuns }: ActiveRunsModalProps) {
  const hasRuns = activeRuns && activeRuns.totalActiveRuns > 0;

  return (
    <Modal
      variant={ModalVariant.medium}
      title="Active Scenario Runs by Cluster"
      isOpen={isOpen}
      onClose={onClose}
    >
      {!hasRuns ? (
        <EmptyState>
          <EmptyStateIcon icon={TopologyIcon} />
          <Title headingLevel="h2" size="lg">
            No Active Runs
          </Title>
          <EmptyStateBody>
            There are currently no active scenario runs.
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <DataList aria-label="Active runs by cluster" isCompact>
          {Object.entries(activeRuns.clusterRuns).map(([clusterName, runNames]) => (
            <DataListItem key={clusterName} aria-labelledby={`cluster-${clusterName}`}>
              <DataListItemRow>
                <DataListItemCells
                  dataListCells={[
                    <DataListCell key="cluster" width={2}>
                      <div>
                        <strong id={`cluster-${clusterName}`}>{clusterName}</strong>
                        <div style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
                          <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                            {runNames.map((runName) => (
                              <li key={runName} style={{ fontSize: '0.9rem', color: 'var(--pf-v5-global--Color--200)' }}>
                                {runName}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </DataListCell>,
                  ]}
                />
              </DataListItemRow>
            </DataListItem>
          ))}
        </DataList>
      )}
    </Modal>
  );
}
