import { useState, useEffect, useRef } from 'react';
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
  Bullseye,
} from '@patternfly/react-core';
import { RegistryIcon } from '@patternfly/react-icons';
import { useAppContext } from '../context/AppContext';
import { useProviderConfigPoller } from '../hooks/useProviderConfigPoller';
import { useNotifications } from '../hooks/useNotifications';
import { useRole } from '../hooks/useRole';
import { providersApi } from '../services/providersApi';
import { TargetsList } from './TargetsList';
import { ProviderConfigTab } from './ProviderConfigTab';
import { UserManagement } from './UserManagement';

export function Settings() {
  const { state, dispatch } = useAppContext();
  const { showSuccess, showError } = useNotifications();
  const { isAdmin } = useRole();
  const [activeTabKey, setActiveTabKey] = useState<string | number>(0);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [expandedAccordionItems, setExpandedAccordionItems] = useState<string[]>([]);
  const [togglingProvider, setTogglingProvider] = useState<string | null>(null);
  const previousTabKeyRef = useRef<string | number>(0);

  // Use provider config poller
  useProviderConfigPoller();

  // Reset provider config when entering Provider Configuration tab (eventKey 2)
  useEffect(() => {
    const previousTabKey = previousTabKeyRef.current;

    // If we're switching TO tab 2 (from any other tab)
    if (activeTabKey === 2 && previousTabKey !== 2) {
      console.log('Provider Configuration tab accessed, resetting state');
      dispatch({ type: 'PROVIDER_CONFIG_RESET' });
    }

    // Update previous tab key for next comparison
    previousTabKeyRef.current = activeTabKey;
  }, [activeTabKey, dispatch]);

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
      <Card style={{ position: 'relative' }}>
        {/* Loading Overlay - Covers entire Card */}
        {(isLoadingProviders || state.providerConfigStatus === 'creating' || state.providerConfigStatus === 'polling') && activeTabKey === 2 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
            }}
          >
            <Bullseye>
              <div style={{ textAlign: 'center', color: 'white' }}>
                <Spinner size="xl" />
                <Title headingLevel="h3" size="lg" style={{ marginTop: '1rem', color: 'white' }}>
                  Loading...
                </Title>
              </div>
            </Bullseye>
          </div>
        )}

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
            {isAdmin && (
              <Tab eventKey={0} title={<TabTitleText>Cluster Targets</TabTitleText>}>
                <div style={{ marginTop: '1.5rem' }}>
                  <TargetsList />
                </div>
              </Tab>
            )}
            <Tab eventKey={1} title={<TabTitleText>Users & Groups</TabTitleText>}>
              <div style={{ marginTop: '1.5rem' }}>
                <UserManagement />
              </div>
            </Tab>

            {/* Provider Configuration Tab - Admin Only */}
            {isAdmin && (
              <Tab eventKey={2} title={<TabTitleText>Provider Configuration</TabTitleText>}>
              <div style={{ marginTop: '1.5rem' }}>
                {!isLoadingProviders && (!state.providers || state.providers.length === 0) && (
                  <EmptyState>
                    <EmptyStateIcon icon={RegistryIcon} />
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
                    {/* Error Alert */}
                    {state.providerConfigStatus === 'error' && (
                      <Alert variant="danger" title="Failed to Load Provider Configuration" style={{ marginBottom: '1rem' }}>
                        An error occurred while loading provider schemas. Please try refreshing the page.
                      </Alert>
                    )}

                    {/* Provider accordion */}
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
            )}
          </Tabs>
        </CardBody>
      </Card>
    </PageSection>
  );
}
