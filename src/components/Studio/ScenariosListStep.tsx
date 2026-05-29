/**
 * ScenariosListStep - Scenario selection for wizard (controlled component)
 *
 * Displays available scenarios and allows selection.
 * Adapted from ScenariosList but as a controlled component.
 */

import { useState } from 'react';
import {
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  SearchInput,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
  Title,
} from '@patternfly/react-core';
import { FileCodeIcon } from '@patternfly/react-icons';
import type { ScenarioTag } from '../../types/api';

interface ScenariosListStepProps {
  scenarios: ScenarioTag[];
  selectedScenario: string | null;
  onSelectScenario: (scenarioName: string) => void;
}

export function ScenariosListStep({
  scenarios,
  selectedScenario,
  onSelectScenario,
}: ScenariosListStepProps) {
  const [searchValue, setSearchValue] = useState('');

  if (!scenarios || scenarios.length === 0) {
    return (
      <EmptyState>
        <EmptyStateIcon icon={FileCodeIcon} />
        <Title headingLevel="h4" size="lg">
          No Scenarios Found
        </Title>
        <EmptyStateBody>
          No chaos scenarios were found in the registry. Please check your registry configuration.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  const formatBytes = (bytes?: number): string => {
    if (!bytes) return 'N/A';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    if (kb >= 1) return `${kb.toFixed(2)} KB`;
    return `${bytes} B`;
  };

  // Filter scenarios based on search
  const filteredScenarios = scenarios.filter((scenario) =>
    scenario.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  // Sort by name
  const sortedScenarios = [...filteredScenarios].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div>
      {/* Search toolbar */}
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem variant="search-filter">
            <SearchInput
              placeholder="Search scenarios..."
              value={searchValue}
              onChange={(_event, value) => setSearchValue(value)}
              onClear={() => setSearchValue('')}
            />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {/* Scenarios list */}
      {sortedScenarios.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon icon={FileCodeIcon} />
          <Title headingLevel="h4" size="lg">
            No Matching Scenarios
          </Title>
          <EmptyStateBody>
            No scenarios match your search criteria. Try a different search term.
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <DataList
          aria-label="Scenarios list"
          selectedDataListItemId={selectedScenario || undefined}
          onSelectDataListItem={(_event, id) => onSelectScenario(id)}
          isCompact
        >
          {sortedScenarios.map((scenario) => (
            <DataListItem
              key={scenario.name}
              id={scenario.name}
              style={{
                cursor: 'pointer',
                backgroundColor:
                  selectedScenario === scenario.name
                    ? 'var(--pf-v5-global--BackgroundColor--200)'
                    : undefined,
              }}
            >
              <DataListItemRow>
                <DataListItemCells
                  dataListCells={[
                    <DataListCell key="name" width={3}>
                      <div>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                          {scenario.name}
                        </div>
                        <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)', color: 'var(--pf-v5-global--Color--200)' }}>
                          Size: {formatBytes(scenario.size)}
                        </div>
                      </div>
                    </DataListCell>,
                    <DataListCell key="digest" width={2}>
                      {scenario.digest && (
                        <div
                          style={{
                            fontSize: 'var(--pf-v5-global--FontSize--sm)',
                            fontFamily: 'var(--pf-v5-global--FontFamily--monospace)',
                            color: 'var(--pf-v5-global--Color--200)',
                          }}
                        >
                          {scenario.digest.substring(0, 19)}...
                        </div>
                      )}
                    </DataListCell>,
                  ]}
                />
              </DataListItemRow>
            </DataListItem>
          ))}
        </DataList>
      )}
    </div>
  );
}
