import { useState } from 'react';
import {
  Card,
  CardTitle,
  CardBody,
  PageSection,
  Title,
  Tabs,
  Tab,
  TabTitleText,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
  Button,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import { UserIcon } from '@patternfly/react-icons';
import { useAppContext } from '../context/AppContext';
import { TargetsList } from './TargetsList';

export function Settings() {
  const { dispatch } = useAppContext();
  const [activeTabKey, setActiveTabKey] = useState<string | number>(0);

  const handleBack = () => {
    dispatch({ type: 'GO_BACK' });
  };

  return (
    <PageSection isFilled>
      <Card>
        <CardTitle>
          <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
            <FlexItem>
              <Title headingLevel="h1" size="lg">
                Settings
              </Title>
            </FlexItem>
            <FlexItem>
              <Button variant="link" onClick={handleBack}>
                ← Back to Jobs
              </Button>
            </FlexItem>
          </Flex>
        </CardTitle>
        <CardBody>
          <Tabs
            activeKey={activeTabKey}
            onSelect={(_event, tabIndex) => setActiveTabKey(tabIndex)}
          >
            <Tab eventKey={0} title={<TabTitleText>Cluster Targets</TabTitleText>}>
              <div style={{ marginTop: '1.5rem' }}>
                <TargetsList />
              </div>
            </Tab>
            <Tab eventKey={1} title={<TabTitleText>User Settings</TabTitleText>}>
              <div style={{ marginTop: '1.5rem' }}>
                <EmptyState>
                  <EmptyStateIcon icon={UserIcon} />
                  <Title headingLevel="h2" size="lg">
                    User Settings
                  </Title>
                  <EmptyStateBody>
                    User settings configuration will be available soon.
                  </EmptyStateBody>
                </EmptyState>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </PageSection>
  );
}
