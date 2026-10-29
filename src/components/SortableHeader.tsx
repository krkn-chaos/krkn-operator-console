import { Button, Flex, FlexItem } from '@patternfly/react-core';
import { ArrowsAltVIcon, LongArrowAltDownIcon, LongArrowAltUpIcon } from '@patternfly/react-icons';
import './SortableHeader.css';

interface SortableHeaderProps {
  label: string;
  isActive: boolean;
  isAscending: boolean;
  onSort: () => void;
}

export function SortableHeader({ label, isActive, isAscending, onSort }: SortableHeaderProps) {
  const nextDirection = isAscending ? 'descending' : 'ascending';
  const sortIcon = !isActive
    ? <ArrowsAltVIcon aria-hidden="true" />
    : isAscending
      ? <LongArrowAltUpIcon aria-hidden="true" />
      : <LongArrowAltDownIcon aria-hidden="true" />;

  return (
    <Flex
      className="sortable-header"
      alignItems={{ default: 'alignItemsCenter' }}
      flexWrap={{ default: 'nowrap' }}
    >
      <FlexItem>{label}</FlexItem>
      <FlexItem>
        <Button
          variant="plain"
          className="sortable-header__button"
          onClick={onSort}
          aria-label={isActive ? `Sort ${label} ${nextDirection}` : `Sort by ${label}`}
          aria-pressed={isActive}
          title={isActive ? `Sorted ${isAscending ? 'ascending' : 'descending'}` : `Sort by ${label}`}
        >
          {sortIcon}
        </Button>
      </FlexItem>
    </Flex>
  );
}
