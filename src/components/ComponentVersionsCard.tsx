import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  Label,
  Spinner,
  Title,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { CubesIcon, ExclamationCircleIcon } from '@patternfly/react-icons';
import { componentsApi } from '../services/componentsApi';
import { consoleComponentManifest, consoleComponentName } from '../componentManifest';
import type { ComponentManifest } from '../services/componentsApi';

/** Lists operator versions from the API and the console's own bundled version. */
export function ComponentVersionsCard() {
  const [components, setComponents] = useState<Record<string, ComponentManifest>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    componentsApi.listComponents(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setComponents(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  const entries = Object.entries({
    ...components,
    [consoleComponentName]: consoleComponentManifest,
  }).sort(([a], [b]) => a.localeCompare(b));
  const hasOperatorVersions = Object.keys(components).some((name) => name !== consoleComponentName);

  return (
    <Card>
      <CardTitle>Installed components</CardTitle>
      <CardBody>
        {loading && <Spinner size="md" aria-label="Loading component versions" />}
        {!loading && error && (
          <EmptyState>
            <EmptyStateIcon icon={ExclamationCircleIcon} />
            <Title headingLevel="h2" size="lg">Unable to load component versions</Title>
            <EmptyStateBody>Check the operator API and try again.</EmptyStateBody>
            <Button variant="primary" onClick={() => setAttempt((value) => value + 1)}>Retry</Button>
          </EmptyState>
        )}
        {!loading && !error && !hasOperatorVersions && (
          <EmptyState>
            <EmptyStateIcon icon={CubesIcon} />
            <Title headingLevel="h2" size="lg">No operator versions available</Title>
            <EmptyStateBody>Operator versions appear here after they register with the cluster.</EmptyStateBody>
            <Button variant="primary" onClick={() => setAttempt((value) => value + 1)}>Refresh</Button>
          </EmptyState>
        )}
        {entries.map(([name, manifest]) => (
          <Card key={name} isCompact>
            <CardTitle>
              {name} <Label color="blue">{manifest.version}</Label>
            </CardTitle>
            <CardBody>
              <Table aria-label={`${name} components`} variant="compact">
                <Thead><Tr><Th>Component</Th><Th>Description</Th></Tr></Thead>
                <Tbody>
                  {manifest.components.map((item) => (
                    <Tr key={item.component}>
                      <Td>{item.component}</Td>
                      <Td>{item.description}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </CardBody>
          </Card>
        ))}
      </CardBody>
    </Card>
  );
}
