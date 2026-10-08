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
  values?: string[];
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
        <FormGroup label="Filter category" fieldId={`${idPrefix}-filter-key`} style={{ width: '15em' }}>
          <FormSelect
            id={`${idPrefix}-filter-key`}
            value={draftFilter.key}
              onChange={(_event, value) => onDraftChange({ key: value, value: '' })}
          >
            <FormSelectOption value="" label="Select field…" />
            {options.map(option => <FormSelectOption key={option.key} value={option.key} label={option.label} />)}
          </FormSelect>
        </FormGroup>
      </FlexItem>
      <FlexItem>
          <FormGroup label="Filter values" fieldId={`${idPrefix}-filter-value`}>
          {options.find(option => option.key === draftFilter.key)?.values ? (
            <FormSelect
              id={`${idPrefix}-filter-value`}
              value={draftFilter.value}
              style={{ width: '18em' }}
              onChange={(_event, value) => onDraftChange({ ...draftFilter, value })}
              isDisabled={!draftFilter.key}
            >
              <FormSelectOption value="" label="Select value…" />
              {options.find(option => option.key === draftFilter.key)?.values?.map(value => (
                <FormSelectOption key={value} value={value} label={value} />
              ))}
            </FormSelect>
          ) : (
            <TextInput
              id={`${idPrefix}-filter-value`}
              value={draftFilter.value}
              style={{ width: '18em' }}
              onChange={(_event, value) => onDraftChange({ ...draftFilter, value })}
              isDisabled={!draftFilter.key}
            />
          )}
        </FormGroup>
      </FlexItem>
      <FlexItem>
        <Button variant="link" isInline onClick={onAddFilter} isDisabled={!draftFilter.key}>Add filter</Button>
      </FlexItem>
    </>
  );
}
