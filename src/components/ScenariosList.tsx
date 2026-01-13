import { useState } from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  Button,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Badge,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
  Title,
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { CubesIcon } from '@patternfly/react-icons';
import { useAppContext } from '../context/AppContext';
import type { ScenarioTag } from '../types/api';

export function ScenariosList() {
  const { state, dispatch } = useAppContext();
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);

  if (!state.scenarios || state.scenarios.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState>
            <EmptyStateIcon icon={CubesIcon} />
            <Title headingLevel="h4" size="lg">
              No Scenarios Found
            </Title>
            <EmptyStateBody>
              No chaos scenarios were found in the registry. Please check your registry configuration.
            </EmptyStateBody>
          </EmptyState>
        </CardBody>
      </Card>
    );
  }

  const handleSelectScenario = (scenarioName: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedScenarios([...selectedScenarios, scenarioName]);
    } else {
      setSelectedScenarios(selectedScenarios.filter((s) => s !== scenarioName));
    }
  };

  const handleSelectAll = () => {
    if (!state.scenarios) return;

    if (selectedScenarios.length === state.scenarios.length) {
      setSelectedScenarios([]);
    } else {
      setSelectedScenarios(state.scenarios.map((s) => s.name));
    }
  };

  const handleProceed = () => {
    dispatch({
      type: 'SELECT_SCENARIOS',
      payload: { scenarios: selectedScenarios },
    });
  };

  const handleBack = () => {
    dispatch({ type: 'GO_BACK' });
  };

  const formatBytes = (bytes?: number): string => {
    if (!bytes) return 'N/A';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    if (kb >= 1) return `${kb.toFixed(2)} KB`;
    return `${bytes} B`;
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  const isAllSelected = selectedScenarios.length === state.scenarios.length;

  return (
    <Card>
      <CardTitle>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            Select Chaos Scenarios
            {selectedScenarios.length > 0 && (
              <Badge isRead style={{ marginLeft: '8px' }}>
                {selectedScenarios.length} selected
              </Badge>
            )}
          </div>
          <Button variant="link" onClick={handleBack}>
            ← Back to Registry Config
          </Button>
        </div>
      </CardTitle>
      <CardBody>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <Button variant="link" onClick={handleSelectAll}>
                {isAllSelected ? 'Deselect All' : 'Select All'}
              </Button>
            </ToolbarItem>
            <ToolbarItem align={{ default: 'alignRight' }}>
              <Button
                variant="primary"
                onClick={handleProceed}
                isDisabled={selectedScenarios.length === 0}
              >
                Proceed with {selectedScenarios.length} scenario{selectedScenarios.length !== 1 ? 's' : ''}
              </Button>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        <Table variant="compact" borders>
          <Thead>
            <Tr>
              <Th width={10}>Select</Th>
              <Th width={30}>Scenario Name</Th>
              <Th width={25}>Digest</Th>
              <Th width={15}>Size</Th>
              <Th width={20}>Last Modified</Th>
            </Tr>
          </Thead>
          <Tbody>
            {state.scenarios.map((scenario: ScenarioTag, index: number) => {
              const isSelected = selectedScenarios.includes(scenario.name);
              return (
                <Tr key={scenario.name}>
                  <Td
                    select={{
                      rowIndex: index,
                      onSelect: (_event: React.FormEvent, isSelecting: boolean) =>
                        handleSelectScenario(scenario.name, isSelecting),
                      isSelected,
                    }}
                  />
                  <Td dataLabel="Scenario Name">
                    <code>{scenario.name}</code>
                  </Td>
                  <Td dataLabel="Digest">
                    <code style={{ fontSize: '0.85em' }}>
                      {scenario.digest ? scenario.digest.substring(0, 20) + '...' : 'N/A'}
                    </code>
                  </Td>
                  <Td dataLabel="Size">{formatBytes(scenario.size)}</Td>
                  <Td dataLabel="Last Modified">{formatDate(scenario.lastModified)}</Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>

        {selectedScenarios.length > 0 && (
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
            <strong>Selected scenarios:</strong>{' '}
            {selectedScenarios.map((name, idx) => (
              <span key={name}>
                <code>{name}</code>
                {idx < selectedScenarios.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
