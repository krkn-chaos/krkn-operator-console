/**
 * FileSelector - Component for selecting centrally-managed files for ScenarioRun
 *
 * Allows users to:
 * - Select files from available centrally-managed files (filtered by user permissions)
 * - Specify mount path for each file
 * - Add multiple file references
 * - Remove file references
 * - Display selected files as chips
 */

import { useState, useEffect } from 'react';
import {
  FormGroup,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  MenuToggleElement,
  TextInput,
  Button,
  Chip,
  ChipGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import { FiPlus } from 'react-icons/fi';
import { operatorApi } from '../services/operatorApi';
import type { FileReference, FileInfo } from '../types/api';

interface FileSelectorProps {
  /** Current file references */
  value: FileReference[];
  /** Callback when file references change */
  onChange: (fileReferences: FileReference[]) => void;
  /** Optional label for the form group */
  label?: string;
}

export function FileSelector({ value, onChange, label = 'Managed Files' }: FileSelectorProps) {
  const [availableFiles, setAvailableFiles] = useState<FileInfo[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [isFileSelectOpen, setIsFileSelectOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [mountPath, setMountPath] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');

  // Load available files
  useEffect(() => {
    async function loadFiles() {
      setLoadingFiles(true);
      setError(null);
      try {
        const response = await operatorApi.getAvailableFiles();
        setAvailableFiles(response.files || []);
      } catch (err) {
        console.error('[FileSelector] Error loading files:', err);
        setError(err instanceof Error ? err.message : 'Failed to load files');
      } finally {
        setLoadingFiles(false);
      }
    }

    loadFiles();
  }, []);

  // Add file reference
  const handleAddFile = () => {
    // Validate
    if (!selectedFileId) {
      setValidationError('Please select a file');
      return;
    }
    if (!mountPath.trim()) {
      setValidationError('Mount path is required');
      return;
    }
    if (!mountPath.startsWith('/')) {
      setValidationError('Mount path must be absolute (start with /)');
      return;
    }

    // Check if file already added
    if (value.some(ref => ref.fileId === selectedFileId)) {
      setValidationError('This file is already added');
      return;
    }

    // Add to list
    onChange([...value, { fileId: selectedFileId, mountPath: mountPath.trim() }]);

    // Reset form
    setSelectedFileId('');
    setMountPath('');
    setValidationError('');
  };

  // Remove file reference
  const handleRemoveFile = (fileId: string) => {
    onChange(value.filter(ref => ref.fileId !== fileId));
  };

  // Get file name by ID
  const getFileName = (fileId: string): string => {
    const file = availableFiles.find(f => f.fileId === fileId);
    return file?.fileName || fileId;
  };

  // Filter out already selected files from dropdown
  const selectableFiles = availableFiles.filter(
    file => !value.some(ref => ref.fileId === file.fileId)
  );

  return (
    <FormGroup label={label} fieldId="file-selector">
      {/* Selected files display */}
      {value.length > 0 && (
        <ChipGroup categoryName="Selected files" style={{ marginBottom: '1rem' }}>
          {value.map(ref => (
            <Chip
              key={ref.fileId}
              onClick={() => handleRemoveFile(ref.fileId)}
            >
              {getFileName(ref.fileId)} → {ref.mountPath}
            </Chip>
          ))}
        </ChipGroup>
      )}

      {/* Add file section */}
      <Flex gap={{ default: 'gapSm' }} alignItems={{ default: 'alignItemsFlexStart' }}>
        <FlexItem flex={{ default: 'flex_1' }}>
          <Select
            id="file-select"
            isOpen={isFileSelectOpen}
            selected={selectedFileId}
            onSelect={(_event, selection) => {
              setSelectedFileId(selection as string);
              setIsFileSelectOpen(false);
              setValidationError('');
            }}
            onOpenChange={(isOpen) => setIsFileSelectOpen(isOpen)}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle
                ref={toggleRef}
                onClick={() => setIsFileSelectOpen(!isFileSelectOpen)}
                isExpanded={isFileSelectOpen}
                isDisabled={loadingFiles || selectableFiles.length === 0}
                style={{ width: '100%' }}
              >
                {selectedFileId
                  ? getFileName(selectedFileId)
                  : loadingFiles
                  ? 'Loading files...'
                  : selectableFiles.length === 0
                  ? 'No files available'
                  : 'Select a file'}
              </MenuToggle>
            )}
          >
            <SelectList>
              {selectableFiles.map(file => (
                <SelectOption key={file.fileId} value={file.fileId}>
                  <div>
                    <strong>{file.fileName}</strong>
                    {file.description && (
                      <div style={{ fontSize: '0.875rem', color: 'var(--pf-v5-global--Color--200)' }}>
                        {file.description}
                      </div>
                    )}
                  </div>
                </SelectOption>
              ))}
            </SelectList>
          </Select>
        </FlexItem>

        <FlexItem flex={{ default: 'flex_1' }}>
          <TextInput
            id="mount-path-input"
            value={mountPath}
            onChange={(_event, value) => {
              setMountPath(value);
              setValidationError('');
            }}
            placeholder="/path/to/mount/file.yaml"
            validated={validationError ? 'error' : 'default'}
          />
        </FlexItem>

        <FlexItem>
          <Button
            variant="secondary"
            icon={<FiPlus />}
            onClick={handleAddFile}
            isDisabled={loadingFiles || selectableFiles.length === 0}
          >
            Add
          </Button>
        </FlexItem>
      </Flex>

      {/* Validation error */}
      {validationError && (
        <FormHelperText>
          <HelperText>
            <HelperTextItem variant="error">{validationError}</HelperTextItem>
          </HelperText>
        </FormHelperText>
      )}

      {/* Loading/Error state */}
      {error && (
        <FormHelperText>
          <HelperText>
            <HelperTextItem variant="error">{error}</HelperTextItem>
          </HelperText>
        </FormHelperText>
      )}

      {/* Help text */}
      {!error && (
        <FormHelperText>
          <HelperText>
            <HelperTextItem>
              Select managed files to mount in pods. Files are filtered based on your group permissions.
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      )}
    </FormGroup>
  );
}
