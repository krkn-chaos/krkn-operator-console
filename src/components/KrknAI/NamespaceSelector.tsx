import { Alert, Button, Card, CardBody, CardTitle, Checkbox } from '@patternfly/react-core';
import { CubesIcon } from '@patternfly/react-icons';

interface NamespaceSelectorProps {
  namespaces: string[];
  selectedNamespaces: string[];
  loading: boolean;
  error: string | null;
  onToggle: (namespace: string, enabled: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onRetry: () => void;
}

export function NamespaceSelector({
  namespaces,
  selectedNamespaces,
  loading,
  error,
  onToggle,
  onSelectAll,
  onClear,
  onRetry,
}: NamespaceSelectorProps) {
  return (
    <Card className="krkn-ai-namespace-selector">
      <CardTitle>
        <div className="krkn-ai-config-wizard__title">
          <span className="krkn-ai-config-wizard__title-icon" aria-hidden="true"><CubesIcon /></span>
          <span>Namespaces to discover</span>
        </div>
      </CardTitle>
      <CardBody>
        <p className="krkn-ai-muted">Select one or more namespaces to include. Nothing is selected by default.</p>
        {loading && <p role="status">Loading namespaces from the selected cluster…</p>}
        {error && (
          <Alert variant="danger" title="Unable to load namespaces" isInline>
            <p>{error}</p>
            <Button variant="link" onClick={onRetry}>Retry namespace listing</Button>
          </Alert>
        )}
        {!loading && !error && namespaces.length === 0 && (
          <p className="krkn-ai-not-available">No namespaces were returned for this cluster.</p>
        )}
        {namespaces.length > 0 && (
          <>
            <div className="krkn-ai-namespace-selector__toolbar">
              <span>{selectedNamespaces.length} of {namespaces.length} selected</span>
              <div>
                <Button variant="link" isDisabled={loading} onClick={onSelectAll}>Select all</Button>
                <Button variant="link" isDisabled={loading || selectedNamespaces.length === 0} onClick={onClear}>Clear</Button>
              </div>
            </div>
            <fieldset className="krkn-ai-namespace-selector__list" disabled={loading}>
              <legend>Available namespaces</legend>
              {namespaces.map((namespace) => (
                <Checkbox
                  key={namespace}
                  id={`krkn-ai-namespace-${namespace}`}
                  label={namespace}
                  isChecked={selectedNamespaces.includes(namespace)}
                  onChange={(_event, checked) => onToggle(namespace, checked)}
                />
              ))}
            </fieldset>
          </>
        )}
      </CardBody>
    </Card>
  );
}
