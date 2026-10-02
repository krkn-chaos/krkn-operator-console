import {
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  Spinner,
  Title,
} from '@patternfly/react-core';

interface LoadingScreenProps {
  phase: 'initializing' | 'polling' | 'loading_scenarios' | 'loading_scenario_detail';
  pollAttempts?: number;
}

export function LoadingScreen({ phase, pollAttempts = 0 }: LoadingScreenProps) {
  const getMessage = () => {
    if (phase === 'initializing') {
      return 'Initializing target request...';
    }
    if (phase === 'loading_scenarios') {
      return 'Loading chaos scenarios from registry...';
    }
    if (phase === 'loading_scenario_detail') {
      return 'Loading scenario configuration details...';
    }
    return `Waiting for target data... (attempt ${pollAttempts})`;
  };

  const getTitle = () => {
    if (phase === 'initializing') return 'Initializing';
    if (phase === 'loading_scenarios') return 'Loading Scenarios';
    if (phase === 'loading_scenario_detail') return 'Loading Scenario Detail';
    return 'Loading';
  };

  return (
    <EmptyState>
      <EmptyStateIcon icon={Spinner} />
      <Title headingLevel="h1" size="lg">
        {getTitle()}
      </Title>
      <EmptyStateBody>
        {getMessage()}
      </EmptyStateBody>
    </EmptyState>
  );
}
