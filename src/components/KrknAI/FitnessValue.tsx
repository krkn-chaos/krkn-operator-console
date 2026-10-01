import { Spinner } from '@patternfly/react-core';

export function FitnessValue({
  value,
  calculatingGeneration,
}: {
  value: number | null | undefined;
  calculatingGeneration: number | null;
}) {
  if (value != null) return <>{value.toLocaleString(undefined, { maximumFractionDigits: 4 })}</>;
  if (calculatingGeneration === null) return <>Not available yet</>;
  return (
    <span className="krkn-ai-fitness-calculating" role="status">
      <Spinner size="sm" aria-label="Calculating fitness" />
      <span>Calculating generation {calculatingGeneration + 1} fitness…</span>
    </span>
  );
}
