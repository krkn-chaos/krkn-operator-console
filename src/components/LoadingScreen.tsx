import {
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  Spinner,
  Title,
} from '@patternfly/react-core';

interface LoadingScreenProps {
  phase: 'initializing' | 'polling';
  pollAttempts?: number;
}

export function LoadingScreen({ phase, pollAttempts = 0 }: LoadingScreenProps) {
  const getMessage = () => {
    if (phase === 'initializing') {
      return 'Initializing target request...';
    }
    return `Waiting for target data... (attempt ${pollAttempts})`;
  };

  return (
    <EmptyState>
      <EmptyStateIcon icon={Spinner} />
      <Title headingLevel="h1" size="lg">
        {phase === 'initializing' ? 'Initializing' : 'Loading'}
      </Title>
      <EmptyStateBody>
        {getMessage()}
      </EmptyStateBody>
    </EmptyState>
  );
}
