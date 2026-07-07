/**
 * ResiliencyScoreModal - Configure resiliency score for GraphRun
 *
 * Allows users to:
 * - Set baseline score (required, float >= 0)
 * - Select file mode: same for all nodes or per-node
 * - Select metrics file(s) from available files
 * - Override mount path (default: /etc/krkn/metrics.yaml)
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  ModalVariant,
  Button,
  Form,
  FormGroup,
  TextInput,
  Radio,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  SelectGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Alert,
  Label,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { operatorApi } from '../services/operatorApi';
import type { ResiliencyScoreConfig, FileInfo, FileTypeResponse } from '../types/api';

interface ResiliencyScoreModalProps {
  isOpen: boolean;
  nodeIds: string[];
  onClose: () => void;
  onConfirm: (config: ResiliencyScoreConfig) => void;
}

export function ResiliencyScoreModal({
  isOpen,
  nodeIds,
  onClose,
  onConfirm,
}: ResiliencyScoreModalProps) {
  const [baseline, setBaseline] = useState<string>('');
  const [mountPath, setMountPath] = useState<string>('/etc/krkn/metrics.yaml');
  const [fileMode, setFileMode] = useState<'same' | 'per-node'>('same');

  // File selection state
  const [availableFiles, setAvailableFiles] = useState<FileInfo[]>([]);
  const [fileTypes, setFileTypes] = useState<FileTypeResponse[]>([]);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [perNodeFileIds, setPerNodeFileIds] = useState<{ [nodeId: string]: string }>({});

  // Select component state
  const [isSelectOpen, setIsSelectOpen] = useState<boolean>(false);
  const [perNodeSelectOpen, setPerNodeSelectOpen] = useState<{ [nodeId: string]: boolean }>({});

  // Validation
  const [baselineError, setBaselineError] = useState<string>('');
  const [mountPathError, setMountPathError] = useState<string>('');

  // Load available files and file types on mount
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoadingFiles(true);
      try {
        const [filesResponse, typesResponse] = await Promise.all([
          operatorApi.getAvailableFiles(),
          operatorApi.getFileTypes(),
        ]);
        setAvailableFiles(filesResponse.files);
        setFileTypes(typesResponse.fileTypes);
      } catch (error) {
        console.error('Failed to load files:', error);
        setAvailableFiles([]);
        setFileTypes([]);
      } finally {
        setLoadingFiles(false);
      }
    };

    fetchData();
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setBaseline('');
      setMountPath('/etc/krkn/metrics.yaml');
      setFileMode('same');
      setSelectedFileId('');
      setPerNodeFileIds({});
      setBaselineError('');
      setMountPathError('');
    }
  }, [isOpen]);

  const validateBaseline = (value: string): boolean => {
    if (!value.trim()) {
      setBaselineError('Baseline score is required');
      return false;
    }
    const num = parseFloat(value);
    if (isNaN(num)) {
      setBaselineError('Must be a valid number');
      return false;
    }
    if (num < 0) {
      setBaselineError('Must be >= 0');
      return false;
    }
    setBaselineError('');
    return true;
  };

  const validateMountPath = (value: string): boolean => {
    if (!value.trim()) {
      setMountPathError('Mount path is required');
      return false;
    }
    if (!value.startsWith('/')) {
      setMountPathError('Must be an absolute path (start with /)');
      return false;
    }
    setMountPathError('');
    return true;
  };

  const handleBaselineChange = (_event: React.FormEvent<HTMLInputElement>, value: string) => {
    setBaseline(value);
    validateBaseline(value);
  };

  const handleMountPathChange = (_event: React.FormEvent<HTMLInputElement>, value: string) => {
    setMountPath(value);
    validateMountPath(value);
  };

  const handleConfirm = () => {
    const baselineValid = validateBaseline(baseline);
    const mountPathValid = validateMountPath(mountPath);

    if (!baselineValid || !mountPathValid) {
      return;
    }

    const config: ResiliencyScoreConfig = {
      baseline: parseFloat(baseline),
      mountPath: mountPath.trim(),
    };

    if (fileMode === 'same') {
      if (selectedFileId) {
        config.fileId = selectedFileId;
      }
    } else {
      // Per-node mode
      config.perNodeFiles = perNodeFileIds;
    }

    onConfirm(config);
  };

  const getFileNameById = (fileId: string): string => {
    const file = availableFiles.find(f => f.fileId === fileId);
    return file?.fileName || fileId;
  };

  const getFileTypeColor = (fileType: string | undefined): string => {
    if (!fileType) return '';
    const type = fileTypes.find(t => t.name === fileType);
    return type?.color || '';
  };

  const groupFilesByType = (): { [type: string]: FileInfo[] } => {
    const grouped: { [type: string]: FileInfo[] } = {};

    availableFiles.forEach(file => {
      const type = file.fileType || 'Other';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(file);
    });

    return grouped;
  };

  const renderFileOption = (file: FileInfo) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span>{file.fileName}</span>
      {file.fileType && (
        <Label color={getFileTypeColor(file.fileType) ? undefined : 'blue'} style={getFileTypeColor(file.fileType) ? { backgroundColor: getFileTypeColor(file.fileType), color: '#fff' } : {}}>
          {file.fileType}
        </Label>
      )}
      {file.description && (
        <span style={{ fontSize: '0.875rem', color: 'var(--pf-v5-global--Color--200)' }}>
          - {file.description}
        </span>
      )}
    </div>
  );

  return (
    <Modal
      variant={ModalVariant.medium}
      title="Configure Resiliency Score"
      isOpen={isOpen}
      onClose={onClose}
      actions={[
        <Button key="confirm" variant="primary" onClick={handleConfirm}>
          Confirm
        </Button>,
        <Button key="cancel" variant="link" onClick={onClose}>
          Cancel
        </Button>,
      ]}
    >
      <Form>
        <Alert
          variant="info"
          isInline
          title="Resiliency Score Calculation"
          style={{ marginBottom: '1rem' }}
        >
          Configure baseline score and metrics file for resiliency calculation during this GraphRun.
        </Alert>

        <FormGroup label="Baseline Score" isRequired>
          <TextInput
            value={baseline}
            type="number"
            step="0.01"
            onChange={handleBaselineChange}
            validated={baselineError ? 'error' : baseline ? 'success' : 'default'}
            aria-label="Baseline score"
            placeholder="e.g., 100.0"
          />
          {baselineError ? (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error" icon={<ExclamationCircleIcon />}>
                  {baselineError}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          ) : (
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  Reference score value for comparison (must be &gt;= 0)
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>

        <FormGroup label="Mount Path" isRequired>
          <TextInput
            value={mountPath}
            onChange={handleMountPathChange}
            validated={mountPathError ? 'error' : 'success'}
            aria-label="Mount path"
            placeholder="/etc/krkn/metrics.yaml"
          />
          {mountPathError ? (
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant="error" icon={<ExclamationCircleIcon />}>
                  {mountPathError}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          ) : (
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  Path where metrics file will be mounted in container
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>

        <FormGroup label="File Selection Mode">
          <Radio
            id="file-mode-same"
            name="file-mode"
            label="Same file for all nodes"
            isChecked={fileMode === 'same'}
            onChange={() => setFileMode('same')}
          />
          <Radio
            id="file-mode-per-node"
            name="file-mode"
            label="Per-node file selection"
            isChecked={fileMode === 'per-node'}
            onChange={() => setFileMode('per-node')}
            style={{ marginTop: '0.5rem' }}
          />
        </FormGroup>

        {fileMode === 'same' ? (
          <FormGroup label="Metrics File">
            <Select
              isOpen={isSelectOpen}
              selected={selectedFileId}
              onSelect={(_event, selection) => {
                setSelectedFileId(selection as string);
                setIsSelectOpen(false);
              }}
              onOpenChange={(isOpen) => setIsSelectOpen(isOpen)}
              toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                <MenuToggle
                  ref={toggleRef}
                  onClick={() => setIsSelectOpen(!isSelectOpen)}
                  isExpanded={isSelectOpen}
                  isDisabled={loadingFiles}
                  style={{ width: '100%' }}
                >
                  {selectedFileId
                    ? getFileNameById(selectedFileId)
                    : loadingFiles
                    ? 'Loading files...'
                    : 'Select a file'}
                </MenuToggle>
              )}
            >
              <SelectList>
                {Object.entries(groupFilesByType()).map(([type, files]) => (
                  <SelectGroup key={type} label={type}>
                    {files.map(file => (
                      <SelectOption key={file.fileId} value={file.fileId}>
                        {renderFileOption(file)}
                      </SelectOption>
                    ))}
                  </SelectGroup>
                ))}
              </SelectList>
            </Select>
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  This file will be used for all nodes in the graph
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        ) : (
          <FormGroup label="Per-Node Metrics Files">
            {nodeIds.length === 0 ? (
              <Alert variant="warning" isInline title="No nodes available">
                Add nodes to the graph before selecting per-node files
              </Alert>
            ) : (
              nodeIds.map(nodeId => (
                <FormGroup key={nodeId} label={`Node: ${nodeId}`} style={{ marginBottom: '1rem' }}>
                  <Select
                    isOpen={perNodeSelectOpen[nodeId] || false}
                    selected={perNodeFileIds[nodeId]}
                    onSelect={(_event, selection) => {
                      setPerNodeFileIds(prev => ({ ...prev, [nodeId]: selection as string }));
                      setPerNodeSelectOpen(prev => ({ ...prev, [nodeId]: false }));
                    }}
                    onOpenChange={(isOpen) => setPerNodeSelectOpen(prev => ({ ...prev, [nodeId]: isOpen }))}
                    toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={() => setPerNodeSelectOpen(prev => ({ ...prev, [nodeId]: !prev[nodeId] }))}
                        isExpanded={perNodeSelectOpen[nodeId] || false}
                        isDisabled={loadingFiles}
                        style={{ width: '100%' }}
                      >
                        {perNodeFileIds[nodeId]
                          ? getFileNameById(perNodeFileIds[nodeId])
                          : loadingFiles
                          ? 'Loading files...'
                          : 'Select a file'}
                      </MenuToggle>
                    )}
                  >
                    <SelectList>
                      {Object.entries(groupFilesByType()).map(([type, files]) => (
                        <SelectGroup key={type} label={type}>
                          {files.map(file => (
                            <SelectOption key={file.fileId} value={file.fileId}>
                              {renderFileOption(file)}
                            </SelectOption>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectList>
                  </Select>
                  {perNodeFileIds[nodeId] && (
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem>
                          Selected: {getFileNameById(perNodeFileIds[nodeId])}
                        </HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  )}
                </FormGroup>
              ))
            )}
          </FormGroup>
        )}
      </Form>
    </Modal>
  );
}
