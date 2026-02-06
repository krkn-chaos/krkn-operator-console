import { useState } from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  Button,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
  Title,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  Flex,
  FlexItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Dropdown,
  DropdownList,
  DropdownItem,
  MenuToggle,
  MenuToggleElement,
  SearchInput,
} from '@patternfly/react-core';
import { CubesIcon, SortAmountDownIcon, CopyIcon } from '@patternfly/react-icons';
import { useAppContext } from '../context/AppContext';
import { useNotifications } from '../hooks';
import type { ScenarioTag } from '../types/api';

type SortOption = 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc';

export function ScenariosList() {
  const { state, dispatch } = useAppContext();
  const { showSuccess } = useNotifications();
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [copiedDigest, setCopiedDigest] = useState<string | null>(null);

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

  const sortOptions = {
    'name-asc': 'Name (A-Z)',
    'name-desc': 'Name (Z-A)',
    'date-asc': 'Date (Oldest First)',
    'date-desc': 'Date (Newest First)',
  };

  const onSortSelect = (_event: React.MouseEvent | undefined, value: string | undefined) => {
    if (value) {
      setSortBy(value as SortOption);
      setIsSortOpen(false);
    }
  };

  const handleCopyDigest = async (digest: string, scenarioName: string) => {
    try {
      await navigator.clipboard.writeText(digest);
      setCopiedDigest(scenarioName);
      showSuccess('Digest copied to clipboard');
      setTimeout(() => {
        setCopiedDigest(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy digest:', error);
    }
  };

  // Filter and sort scenarios
  const filteredAndSortedScenarios = [...state.scenarios]
    .filter((scenario) => {
      if (!searchValue) return true;
      return scenario.name.toLowerCase().includes(searchValue.toLowerCase());
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        case 'name-desc':
          return b.name.toLowerCase().localeCompare(a.name.toLowerCase());
        case 'date-asc': {
          const aDate = a.lastModified ? new Date(a.lastModified).getTime() : 0;
          const bDate = b.lastModified ? new Date(b.lastModified).getTime() : 0;
          return aDate - bDate;
        }
        case 'date-desc': {
          const aDate = a.lastModified ? new Date(a.lastModified).getTime() : 0;
          const bDate = b.lastModified ? new Date(b.lastModified).getTime() : 0;
          return bDate - aDate;
        }
        default:
          return 0;
      }
    });

  return (
    <Card>
      <CardTitle>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            <Title headingLevel="h1" size="lg">
              Available Chaos Scenarios
            </Title>
          </FlexItem>
          <FlexItem>
            <Button variant="link" onClick={handleBack}>
              ← Back to Registry Config
            </Button>
          </FlexItem>
        </Flex>
      </CardTitle>
      <CardBody>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem variant="search-filter">
              <SearchInput
                placeholder="Search by scenario name..."
                value={searchValue}
                onChange={(_event, value) => setSearchValue(value)}
                onClear={() => setSearchValue('')}
                style={{ width: '400px' }}
              />
            </ToolbarItem>
            <ToolbarItem>
              <Dropdown
                isOpen={isSortOpen}
                onOpenChange={(isOpen) => setIsSortOpen(isOpen)}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle
                    ref={toggleRef}
                    onClick={() => setIsSortOpen(!isSortOpen)}
                    isExpanded={isSortOpen}
                    icon={<SortAmountDownIcon />}
                  >
                    Sort: {sortOptions[sortBy]}
                  </MenuToggle>
                )}
              >
                <DropdownList>
                  {Object.entries(sortOptions).map(([value, label]) => (
                    <DropdownItem
                      key={value}
                      value={value}
                      onClick={(event) => onSortSelect(event, value)}
                    >
                      {label}
                    </DropdownItem>
                  ))}
                </DropdownList>
              </Dropdown>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        {filteredAndSortedScenarios.length === 0 ? (
          <EmptyState>
            <EmptyStateIcon icon={CubesIcon} />
            <Title headingLevel="h4" size="lg">
              No Scenarios Found
            </Title>
            <EmptyStateBody>
              {searchValue
                ? `No scenarios match "${searchValue}". Try a different search term.`
                : 'No chaos scenarios were found in the registry.'}
            </EmptyStateBody>
            {searchValue && (
              <Button variant="link" onClick={() => setSearchValue('')}>
                Clear search
              </Button>
            )}
          </EmptyState>
        ) : (
          <DataList aria-label="Scenarios list" isCompact>
            {filteredAndSortedScenarios.map((scenario: ScenarioTag) => (
              <DataListItem key={scenario.name}>
                <DataListItemRow>
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell key="name" width={3}>
                        <div>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <strong>Scenario:</strong>
                          </div>
                          <code style={{ fontSize: 'var(--pf-v5-global--FontSize--md)' }}>
                            {scenario.name}
                          </code>
                        </div>
                      </DataListCell>,
                      <DataListCell key="digest" width={2}>
                        <div>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <strong>Digest:</strong>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <code style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                              {scenario.digest ? scenario.digest.substring(0, 16) + '...' : 'N/A'}
                            </code>
                            {scenario.digest && (
                              <Button
                                variant="plain"
                                aria-label="Copy digest"
                                onClick={() => handleCopyDigest(scenario.digest!, scenario.name)}
                                icon={<CopyIcon />}
                                style={{
                                  minWidth: 'auto',
                                  padding: '0.25rem',
                                  color: copiedDigest === scenario.name
                                    ? 'var(--pf-v5-global--success-color--100)'
                                    : 'var(--pf-v5-global--Color--200)'
                                }}
                              />
                            )}
                          </div>
                        </div>
                      </DataListCell>,
                      <DataListCell key="size" width={1}>
                        <div>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <strong>Size:</strong>
                          </div>
                          <div>{formatBytes(scenario.size)}</div>
                        </div>
                      </DataListCell>,
                      <DataListCell key="modified" width={2}>
                        <div>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <strong>Last Modified:</strong>
                          </div>
                          <div style={{ fontSize: 'var(--pf-v5-global--FontSize--sm)' }}>
                            {formatDate(scenario.lastModified)}
                          </div>
                        </div>
                      </DataListCell>,
                      <DataListCell key="actions" width={1}>
                        <Button
                          variant="primary"
                          onClick={() => handleConfigureScenario(scenario.name)}
                        >
                          Configure
                        </Button>
                      </DataListCell>,
                    ]}
                  />
                </DataListItemRow>
              </DataListItem>
            ))}
          </DataList>
        )}
      </CardBody>
    </Card>
  );
}
