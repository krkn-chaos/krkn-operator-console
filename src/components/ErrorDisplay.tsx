import {
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  Button,
  Title,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import type { AppError } from '../types/api';

interface ErrorDisplayProps {
  error: AppError;
  onRetry: () => void;
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  const getErrorTitle = () => {
    switch (error.type) {
      case 'network':
        return 'Network Error';
      case 'timeout':
        return 'Request Timeout';
      case 'not_found':
        return 'Not Found';
      case 'api_error':
        return 'API Error';
      default:
        return 'Error';
    }
  };

  return (
    <EmptyState>
      <EmptyStateIcon icon={ExclamationCircleIcon} color="var(--pf-v5-global--danger-color--100)" />
      <Title headingLevel="h1" size="lg">
        {getErrorTitle()}
      </Title>
      <EmptyStateBody>
        {error.message}
      </EmptyStateBody>
      <Button variant="primary" onClick={onRetry}>
        Retry
      </Button>
    </EmptyState>
  );
}
