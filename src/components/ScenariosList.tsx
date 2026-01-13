import {
  Card,
  CardBody,
  CardTitle,
  Button,
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

  const handleBack = () => {
    dispatch({ type: 'GO_BACK' });
  };

  const handleConfigureScenario = (scenarioName: string) => {
    dispatch({
      type: 'SELECT_SCENARIO_FOR_DETAIL',
      payload: { scenarioName },
    });
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

  return (
    <Card>
      <CardTitle>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Available Chaos Scenarios</span>
          <Button variant="link" onClick={handleBack}>
            ← Back to Registry Config
          </Button>
        </div>
      </CardTitle>
      <CardBody>

        <Table variant="compact" borders>
          <Thead>
            <Tr>
              <Th width={30}>Scenario Name</Th>
              <Th width={25}>Digest</Th>
              <Th width={15}>Size</Th>
              <Th width={20}>Last Modified</Th>
              <Th width={10}>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {state.scenarios.map((scenario: ScenarioTag) => (
              <Tr key={scenario.name}>
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
                <Td dataLabel="Actions">
                  <Button
                    variant="link"
                    onClick={() => handleConfigureScenario(scenario.name)}
                  >
                    Configure
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </CardBody>
    </Card>
  );
}
