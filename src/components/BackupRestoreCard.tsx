import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  Button,
  Flex,
  FlexItem,
  Modal,
  ModalVariant,
  Alert,
  AlertVariant,
  Spinner,
  Split,
  SplitItem,
} from '@patternfly/react-core';
import { DownloadIcon, UploadIcon } from '@patternfly/react-icons';
import { useNotifications } from '../hooks/useNotifications';
import { backupRestoreApi } from '../services/backupRestoreApi';
import type { RestoreResponse } from '../services/backupRestoreApi';

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Admin-only card for downloading and uploading operator configuration backups.
 * Backup creates and downloads a tar.gz archive directly.
 * Restore accepts a file upload, enabling cross-cluster migration.
 *
 * @example
 * ```tsx
 * {isAdmin && <BackupRestoreCard />}
 * ```
 */
export function BackupRestoreCard() {
  const { showSuccess, showError } = useNotifications();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<RestoreResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
    };
  }, []);

  const handleDownloadBackup = async () => {
    setIsDownloading(true);
    try {
      await backupRestoreApi.downloadBackup();
      showSuccess('Backup Downloaded', 'Backup archive saved to your downloads folder.');
    } catch (error) {
      showError(
        'Backup Failed',
        error instanceof Error ? error.message : 'Failed to download backup'
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const handleOpenRestoreModal = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsRestoreModalOpen(true);
  };

  const pollRestoreStatus = useCallback(
    async (jobId: string) => {
      pollAbortRef.current?.abort();
      const controller = new AbortController();
      pollAbortRef.current = controller;

      const maxAttempts = 60;
      const interval = 3000;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, interval));
        if (controller.signal.aborted) return;
        try {
          const status = await backupRestoreApi.getRestoreStatus(jobId);
          if (controller.signal.aborted) return;
          setRestoreStatus(status);
          if (status.status === 'completed') {
            showSuccess(
              'Restore Completed',
              'Configuration restored successfully. Please restart the operator pod to apply credential changes.',
              0
            );
            return;
          }
          if (status.status === 'failed') {
            showError('Restore Failed', status.message || 'Restore job failed');
            return;
          }
        } catch {
          break;
        }
      }
    },
    [showSuccess, showError]
  );

  const handleRestoreConfirm = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      const response = await backupRestoreApi.uploadRestore(selectedFile);
      setIsRestoreModalOpen(false);
      setSelectedFile(null);
      setRestoreStatus(response);
      showSuccess(
        'Restore Started',
        `Job ID: ${response.jobId}. Monitoring progress...`,
        8000
      );
      void pollRestoreStatus(response.jobId);
    } catch (error) {
      showError(
        'Restore Failed',
        error instanceof Error ? error.message : 'Failed to upload backup'
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <Card>
        <CardTitle>Backup & Restore</CardTitle>
        <CardBody>
          <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsLg' }}>
            <FlexItem>
              <p>
                Download a backup of all configuration data including users, targets, providers, and
                credentials. Upload a backup archive to restore configuration, including cross-cluster
                migration.
              </p>
            </FlexItem>

            <FlexItem>
              <Split hasGutter>
                <SplitItem>
                  <Button
                    variant="primary"
                    icon={<DownloadIcon />}
                    onClick={handleDownloadBackup}
                    isLoading={isDownloading}
                    isDisabled={isUploading}
                  >
                    Download Backup
                  </Button>
                </SplitItem>
                <SplitItem>
                  <Button
                    variant="secondary"
                    icon={<UploadIcon />}
                    onClick={handleOpenRestoreModal}
                    isDisabled={isDownloading || isUploading}
                  >
                    Upload &amp; Restore
                  </Button>
                </SplitItem>
              </Split>
            </FlexItem>

            {restoreStatus && restoreStatus.status === 'in_progress' && (
              <FlexItem>
                <Alert variant={AlertVariant.info} title="Restore in progress" isInline>
                  <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
                    <FlexItem>
                      <Spinner size="sm" />
                    </FlexItem>
                    <FlexItem>Restore job {restoreStatus.jobId} is running...</FlexItem>
                  </Flex>
                </Alert>
              </FlexItem>
            )}
          </Flex>
        </CardBody>
      </Card>

      {/* Restore Upload Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Upload & Restore"
        isOpen={isRestoreModalOpen}
        onClose={() => !isUploading && setIsRestoreModalOpen(false)}
        actions={[
          <Button
            key="restore"
            variant="danger"
            onClick={handleRestoreConfirm}
            isLoading={isUploading}
            isDisabled={!selectedFile}
          >
            Upload &amp; Restore
          </Button>,
          <Button
            key="cancel"
            variant="link"
            onClick={() => setIsRestoreModalOpen(false)}
            isDisabled={isUploading}
          >
            Cancel
          </Button>,
        ]}
      >
        <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
          <FlexItem>
            <Alert variant={AlertVariant.warning} title="This will replace all configuration" isInline>
              All current users, groups, targets, providers, file types, secrets, and credentials
              will be replaced with the backed-up versions. A pod restart is required after restore.
            </Alert>
          </FlexItem>
          <FlexItem>
            <label htmlFor="restore-file" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              Select Backup Archive
            </label>
            <input
              id="restore-file"
              ref={fileInputRef}
              type="file"
              accept=".tar.gz,.gz"
              onChange={handleFileChange}
              disabled={isUploading}
              data-testid="restore-file-input"
            />
            {selectedFile && (
              <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--pf-v5-global--Color--200)' }}>
                Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
              </small>
            )}
          </FlexItem>
        </Flex>
      </Modal>
    </>
  );
}
