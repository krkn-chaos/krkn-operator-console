import {
  Button,
  FlexItem,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
} from '@patternfly/react-core';
import type { ElasticsearchFieldFilter } from '../utils/elasticsearchFieldFilters';

export interface ElasticsearchFilterOption {
  key: string;
  label: string;
}

interface ElasticsearchFilterControlsProps {
  draftFilter: ElasticsearchFieldFilter;
  options: ElasticsearchFilterOption[];
  idPrefix: string;
  onDraftChange: (filter: ElasticsearchFieldFilter) => void;
  onAddFilter: () => void;
}

/** Shared field/value filter editor used by the Telemetry and Alerts tabs. */
export function ElasticsearchFilterControls({
  draftFilter,
  options,
  idPrefix,
  onDraftChange,
  onAddFilter,
}: ElasticsearchFilterControlsProps) {
  return (
    <>
      <FlexItem>
        <FormGroup label="Filter" fieldId={`${idPrefix}-filter-key`}>
          <FormSelect
            id={`${idPrefix}-filter-key`}
            value={draftFilter.key}
            onChange={(_event, value) => onDraftChange({ ...draftFilter, key: value })}
          >
            <FormSelectOption value="" label="Select field…" />
            {options.map(option => <FormSelectOption key={option.key} value={option.key} label={option.label} />)}
          </FormSelect>
        </FormGroup>
      </FlexItem>
      <FlexItem>
        <FormGroup label="Value" fieldId={`${idPrefix}-filter-value`}>
          <TextInput
            id={`${idPrefix}-filter-value`}
            value={draftFilter.value}
            onChange={(_event, value) => onDraftChange({ ...draftFilter, value })}
            isDisabled={!draftFilter.key}
          />
        </FormGroup>
      </FlexItem>
      <FlexItem>
        <Button variant="link" onClick={onAddFilter} isDisabled={!draftFilter.key}>Add filter</Button>
      </FlexItem>
    </>
  );
}
