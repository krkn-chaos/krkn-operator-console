import { useRef, useState, type KeyboardEvent } from 'react';
import {
  Button,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from '@patternfly/react-core';
import { TimesIcon } from '@patternfly/react-icons';
import type { ClusterFieldOptionState } from '../utils/clusterParameterOptions';

interface ClusterOptionInputProps {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  validated?: 'default' | 'error';
  isDisabled?: boolean;
  optionState: ClusterFieldOptionState;
  onChange: (value: string) => void;
  onOptionsOpen?: () => void;
}

const CREATE_CUSTOM = '__create_custom_value__';

export function ClusterOptionInput({
  id,
  label,
  value,
  placeholder,
  validated = 'default',
  isDisabled = false,
  optionState,
  onChange,
  onOptionsOpen,
}: ClusterOptionInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const query = search.trim();
  const options = optionState.options.filter((option) =>
    option.toLowerCase().includes(query.toLowerCase()),
  );
  const canCreate = query !== '' && !optionState.options.some((option) =>
    option.toLowerCase() === query.toLowerCase(),
  );
  const choices = [...options, ...(canCreate ? [CREATE_CUSTOM] : [])];
  const listId = `${id}-cluster-options`;

  const closeOptions = (clearSearch = false) => {
    setIsOpen(false);
    if (clearSearch) setSearch('');
    setFocusedIndex(-1);
  };

  const openOptions = () => {
    if (isDisabled || isOpen) return;
    setIsOpen(true);
    if (optionState.status === 'idle') onOptionsOpen?.();
  };

  const selectedListNames = (): string[] => {
    const trimmed = value.trimStart();
    const closingBracket = trimmed.indexOf(']');
    if (trimmed.startsWith('[') && closingBracket >= 0) {
      try {
        const parsed: unknown = JSON.parse(trimmed.slice(0, closingBracket + 1));
        if (Array.isArray(parsed) && parsed.every((name) => typeof name === 'string')) return parsed;
      } catch {
        return trimmed.slice(1, closingBracket).split(',')
          .map((name) => name.trim().replace(/^(['"])(.*)\1$/, '$2')).filter(Boolean);
      }
    }
    const names = value.split(',').map((name) => name.trim()).filter(Boolean);
    if (search) names.pop();
    return names;
  };

  const chooseOption = (selected: string) => {
    if (selected !== CREATE_CUSTOM) {
      if (optionState.selectionMode === 'list') {
        onChange(JSON.stringify([...new Set([...selectedListNames(), selected])]));
      } else if (optionState.selectionMode === 'comma') {
        const names = value.split(',').map((name) => name.trim());
        if (search) names.pop();
        onChange([...new Set([...names.filter(Boolean), selected])].join(','));
      } else {
        onChange(selected);
      }
    } else if (optionState.selectionMode === 'list' && !value.trimStart().startsWith('[')) {
      onChange(JSON.stringify(value.split(',').map((name) => name.trim()).filter(Boolean)));
    }
    closeOptions(true);
  };

  const handleInputChange = (nextValue: string) => {
    onChange(nextValue);
    if (optionState.selectionMode === 'list' && nextValue.trimStart().startsWith('[') && nextValue.includes(']')) {
      setSearch(nextValue.slice(nextValue.lastIndexOf(']') + 1).replace(/^,/, ''));
    } else {
      setSearch(optionState.selectionMode === 'comma' || optionState.selectionMode === 'list'
        ? nextValue.split(',').pop() ?? '' : nextValue);
    }
    setFocusedIndex(-1);
    openOptions();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      openOptions();
      if (choices.length > 0) {
        setFocusedIndex((previous) => {
          if (previous < 0) return event.key === 'ArrowDown' ? 0 : choices.length - 1;
          return (previous + (event.key === 'ArrowDown' ? 1 : choices.length - 1)) % choices.length;
        });
      }
    } else if (event.key === 'Enter' && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      if (focusedIndex >= 0) {
        const selected = choices[focusedIndex];
        if (selected) chooseOption(selected);
      } else {
        closeOptions();
      }
    }
  };

  return (
    <Select
      variant="typeahead"
      isOpen={isOpen}
      selected={value}
      onOpenChange={(nextIsOpen) => { if (!nextIsOpen) closeOptions(); }}
      onSelect={(_event, selected) => { if (selected !== undefined) chooseOption(String(selected)); }}
      isScrollable
      maxMenuHeight="16rem"
      popperProps={{ width: 'trigger', enableFlip: true, preventOverflow: true, appendTo: () => document.body }}
      style={{ width: '100%' }}
      toggle={(toggleRef) => (
        <MenuToggle
          ref={toggleRef}
          variant="typeahead"
          aria-label={`Show ${label} options`}
          isDisabled={isDisabled}
          isExpanded={isOpen}
          isFullWidth
          status={validated === 'error' ? 'danger' : undefined}
          onClick={() => {
            if (isOpen) closeOptions();
            else openOptions();
          }}
        >
          <TextInputGroup isPlain isDisabled={isDisabled}>
            <TextInputGroupMain
              innerRef={inputRef}
              inputId={id}
              aria-label={label}
              role="combobox"
              isExpanded={isOpen}
              aria-controls={listId}
              aria-activedescendant={focusedIndex >= 0 ? `${listId}-${focusedIndex}` : undefined}
              value={value}
              placeholder={placeholder}
              onClick={() => { if (!isOpen) openOptions(); }}
              onChange={(_event, nextValue) => handleInputChange(nextValue)}
              onKeyDown={handleInputKeyDown}
            />
            {optionState.clearable && value && !isDisabled && (
              <TextInputGroupUtilities>
                <Button
                  type="button"
                  variant="plain"
                  aria-label={`Clear ${label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange('');
                    closeOptions(true);
                    inputRef.current?.focus();
                  }}
                >
                  <TimesIcon aria-hidden />
                </Button>
              </TextInputGroupUtilities>
            )}
          </TextInputGroup>
        </MenuToggle>
      )}
    >
      {optionState.status === 'loading' && optionState.options.length === 0 ? (
        <div role="status">Loading cluster options…</div>
      ) : optionState.status === 'error' ? (
        <div role="status">
          {optionState.error || 'Unable to load cluster options.'}
          <Button variant="link" onClick={onOptionsOpen}>Retry</Button>
        </div>
      ) : (
        <>
          {optionState.status === 'loading' && <div role="status">Refreshing cluster options…</div>}
          <SelectList id={listId}>
            {options.map((option, index) => (
              <SelectOption key={option} id={`${listId}-${index}`} isFocused={focusedIndex === index} value={option}>
                {option}
              </SelectOption>
            ))}
            {canCreate && (
              <SelectOption id={`${listId}-${options.length}`} isFocused={focusedIndex === options.length} value={CREATE_CUSTOM}>
                Use &quot;{query}&quot;
              </SelectOption>
            )}
            {choices.length === 0 && (
              <SelectOption isDisabled value="__empty__">No cluster options. Type custom value.</SelectOption>
            )}
          </SelectList>
          {optionState.status === 'ready' && onOptionsOpen && (
            <Button variant="link" aria-label={`Refresh ${label} options`} onClick={onOptionsOpen}>
              Refresh options
            </Button>
          )}
        </>
      )}
    </Select>
  );
}
