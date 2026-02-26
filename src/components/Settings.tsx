import { useState, useEffect } from 'react';
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
  Spinner,
  Alert,
  Accordion,
  AccordionItem,
  AccordionContent,
  AccordionToggle,
  Badge,
  Switch,
} from '@patternfly/react-core';
import { UserIcon, CubesIcon } from '@patternfly/react-icons';
import { useAppContext } from '../context/AppContext';
import { useProviderConfigPoller } from '../hooks/useProviderConfigPoller';
import { useNotifications } from '../hooks/useNotifications';
import { providersApi } from '../services/providersApi';
import { TargetsList } from './TargetsList';
import { ProviderConfigTab } from './ProviderConfigTab';

export function Settings() {
  const { state, dispatch } = useAppContext();
  const { showSuccess, showError } = useNotifications();
  const [activeTabKey, setActiveTabKey] = useState<string | number>(0);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [expandedAccordionItems, setExpandedAccordionItems] = useState<string[]>([]);
  const [togglingProvider, setTogglingProvider] = useState<string | null>(null);

  // Use provider config poller
  useProviderConfigPoller();

  // Fetch providers on mount
  useEffect(() => {
    async function fetchProviders() {
      setIsLoadingProviders(true);
      try {
        const providers = await providersApi.listProviders();
        dispatch({ type: 'PROVIDERS_LOADED', payload: { providers } });
      } catch (error) {
        console.error('Failed to load providers:', error);
      } finally {
        setIsLoadingProviders(false);
      }
    }

    fetchProviders();
  }, [dispatch]);

  // Create provider config request when Provider Configuration tab is opened
  useEffect(() => {
    // Only create request if:
    // 1. Provider Configuration tab is active (eventKey 2)
    // 2. Providers are loaded
    // 3. Config request hasn't been created yet or is idle
    if (
      activeTabKey === 2 &&
      state.providers &&
      state.providers.length > 0 &&
      state.providerConfigStatus === 'idle'
    ) {
      async function createConfigRequest() {
        dispatch({ type: 'PROVIDER_CONFIG_CREATE_START' });
        try {
          const uuid = await providersApi.createProviderConfigRequest();
          dispatch({ type: 'PROVIDER_CONFIG_CREATE_SUCCESS', payload: { uuid } });
        } catch (error) {
          console.error('Failed to create provider config request:', error);
          dispatch({
            type: 'PROVIDER_CONFIG_ERROR',
            payload: { error: error instanceof Error ? error.message : 'Failed to create config request' }
          });
        }
      }

      createConfigRequest();
    }
  }, [activeTabKey, state.providers, state.providerConfigStatus, dispatch]);

  const handleBack = () => {
    dispatch({ type: 'GO_BACK' });
  };

  const handleToggleActive = async (providerName: string, checked: boolean) => {
    setTogglingProvider(providerName);
    try {
      await providersApi.updateProviderStatus(providerName, checked);

      // Update provider status in state
      dispatch({
        type: 'PROVIDER_STATUS_UPDATED',
        payload: { name: providerName, active: checked }
      });

      showSuccess(
        'Provider Updated',
        `${providerName} has been ${checked ? 'activated' : 'deactivated'}`
      );

      // If deactivating, collapse the accordion item
      if (!checked) {
        setExpandedAccordionItems((prev) => prev.filter((name) => name !== providerName));
      }
    } catch (error) {
      showError(
        'Failed to Update Provider',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      setTogglingProvider(null);
    }
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

            {/* Provider Configuration Tab */}
            <Tab eventKey={2} title={<TabTitleText>Provider Configuration</TabTitleText>}>
              <div style={{ marginTop: '1.5rem' }}>
                {isLoadingProviders && (
                  <EmptyState>
                    <EmptyStateIcon icon={() => <Spinner size="xl" />} />
                    <Title headingLevel="h2" size="lg">
                      Loading Providers
                    </Title>
                  </EmptyState>
                )}

                {!isLoadingProviders && (!state.providers || state.providers.length === 0) && (
                  <EmptyState>
                    <EmptyStateIcon icon={CubesIcon} />
                    <Title headingLevel="h2" size="lg">
                      No Providers Available
                    </Title>
                    <EmptyStateBody>
                      No target providers are currently registered with the system.
                    </EmptyStateBody>
                  </EmptyState>
                )}

                {!isLoadingProviders && state.providers && state.providers.length > 0 && (
                  <>
                    {/* Loading config schemas */}
                    {state.providerConfigStatus === 'creating' && (
                      <Alert variant="info" title="Initializing Provider Configuration">
                        Creating configuration request...
                      </Alert>
                    )}

                    {state.providerConfigStatus === 'polling' && (
                      <Alert variant="info" title="Loading Provider Schemas">
                        <Spinner size="md" style={{ marginRight: '0.5rem' }} />
                        Collecting configuration schemas from active providers...
                      </Alert>
                    )}

                    {state.providerConfigStatus === 'error' && (
                      <Alert variant="danger" title="Failed to Load Provider Configuration">
                        An error occurred while loading provider schemas. Please try refreshing the page.
                      </Alert>
                    )}

                    {/* Provider accordion (show when ready or still polling) */}
                    {(state.providerConfigStatus === 'ready' || state.providerConfigStatus === 'polling') && (
                      <Accordion asDefinitionList={false}>
                        {state.providers.map((provider) => {
                          const isExpanded = expandedAccordionItems.includes(provider.name);
                          const canExpand = provider.active;

                          return (
                            <AccordionItem key={provider.name}>
                              <AccordionToggle
                                onClick={() => {
                                  // Only allow expansion if provider is active
                                  if (!canExpand) return;

                                  setExpandedAccordionItems((prev) =>
                                    isExpanded
                                      ? prev.filter((name) => name !== provider.name)
                                      : [...prev, provider.name]
                                  );
                                }}
                                isExpanded={isExpanded}
                                id={`accordion-toggle-${provider.name}`}
                              >
                                <Flex
                                  alignItems={{ default: 'alignItemsCenter' }}
                                  spaceItems={{ default: 'spaceItemsSm' }}
                                  justifyContent={{ default: 'justifyContentSpaceBetween' }}
                                  style={{ width: '100%' }}
                                >
                                  <FlexItem>
                                    <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
                                      <FlexItem>{provider.name}</FlexItem>
                                      <FlexItem>
                                        <Badge isRead={provider.active}>
                                          {provider.active ? 'Active' : 'Inactive'}
                                        </Badge>
                                      </FlexItem>
                                    </Flex>
                                  </FlexItem>
                                  <FlexItem>
                                    <Switch
                                      id={`${provider.name}-active-switch`}
                                      label=""
                                      labelOff=""
                                      isChecked={provider.active}
                                      onChange={(event, checked) => {
                                        event.stopPropagation(); // Prevent accordion toggle
                                        handleToggleActive(provider.name, checked);
                                      }}
                                      isDisabled={togglingProvider === provider.name}
                                    />
                                  </FlexItem>
                                </Flex>
                              </AccordionToggle>
                              <AccordionContent
                                id={`accordion-content-${provider.name}`}
                                isHidden={!isExpanded}
                              >
                                <ProviderConfigTab
                                  provider={provider}
                                  schema={state.providerConfigData?.[provider.name] || null}
                                  uuid={state.providerConfigUuid || ''}
                                />
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    )}
                  </>
                )}
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </PageSection>
  );
}
