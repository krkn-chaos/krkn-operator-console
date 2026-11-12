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
  TextInput,
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
 * Backup creates and downloads an archive directly or through a presigned URL.
 * Restore accepts a file upload or a remote HTTPS/S3 source, enabling
 * cross-cluster migration without exposing S3 credentials to the browser.
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
  const [restoreRemoteSource, setRestoreRemoteSource] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<RestoreResponse | null>(null);
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [backupPassphraseConfirm, setBackupPassphraseConfirm] = useState('');
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restorePassphraseConfirm, setRestorePassphraseConfirm] = useState('');
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
      await backupRestoreApi.downloadBackup(backupPassphrase || undefined);
      const suffix = backupPassphrase ? ' (encrypted)' : '';
      showSuccess('Backup Downloaded', `Backup archive${suffix} saved to your downloads folder. This archive contains sensitive data — store it securely.`);
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
    if (file) setRestoreRemoteSource('');
  };

  const handleRemoteSourceChange = (value: string) => {
    setRestoreRemoteSource(value);
    if (value.trim()) {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOpenRestoreModal = () => {
    setSelectedFile(null);
    setRestoreRemoteSource('');
    setRestorePassphrase('');
    setRestorePassphraseConfirm('');
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
              'Configuration restored successfully. Refresh the page if the restored settings are not visible.',
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
    const remoteSource = restoreRemoteSource.trim();
    if (!selectedFile && !remoteSource) return;
    setIsUploading(true);
    try {
      const response = selectedFile
        ? await backupRestoreApi.uploadRestore(selectedFile, restorePassphrase || undefined)
        : await backupRestoreApi.restoreFromURL(remoteSource, restorePassphrase || undefined);
      setIsRestoreModalOpen(false);
      setSelectedFile(null);
      setRestoreRemoteSource('');
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
        error instanceof Error ? error.message : 'Failed to start restore'
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
                Download a backup of all configuration data including users, user groups, targets, and
                secrets. Upload a backup archive to restore configuration, including cross-cluster
                migration.
              </p>
            </FlexItem>

            <FlexItem>
              <Alert variant={AlertVariant.warning} title="Sensitive data" isInline isPlain>
                The backup archive contains secrets and should be treated as sensitive information.
                Store it securely.
              </Alert>
            </FlexItem>

            <FlexItem>
              <label htmlFor="backup-passphrase" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Encrypt backup (optional)
              </label>
              <TextInput
                id="backup-passphrase"
                type="password"
                placeholder="Passphrase"
                value={backupPassphrase}
                onChange={(_event, value) => setBackupPassphrase(value)}
                isDisabled={isDownloading || isUploading}
                style={{ maxWidth: '300px' }}
              />
              {backupPassphrase && (
                <>
                  <TextInput
                    id="backup-passphrase-confirm"
                    type="password"
                    placeholder="Confirm passphrase"
                    value={backupPassphraseConfirm}
                    onChange={(_event, value) => setBackupPassphraseConfirm(value)}
                    isDisabled={isDownloading || isUploading}
                    validated={backupPassphraseConfirm && backupPassphrase !== backupPassphraseConfirm ? 'error' : 'default'}
                    style={{ maxWidth: '300px', marginTop: '0.5rem' }}
                  />
                  {backupPassphraseConfirm && backupPassphrase !== backupPassphraseConfirm && (
                    <small style={{ color: 'var(--pf-v5-global--danger-color--100)', display: 'block', marginTop: '0.25rem' }}>
                      Passphrases do not match
                    </small>
                  )}
                </>
              )}
            </FlexItem>

            <FlexItem>
              <Split hasGutter>
                <SplitItem>
                  <Button
                    variant="primary"
                    icon={<DownloadIcon />}
                    onClick={handleDownloadBackup}
                    isLoading={isDownloading}
                    isDisabled={isUploading || (!!backupPassphrase && backupPassphrase !== backupPassphraseConfirm)}
                  >
                    {backupPassphrase ? 'Download Encrypted Backup' : 'Download Backup'}
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
            isDisabled={(!selectedFile && !restoreRemoteSource.trim()) || (!!restorePassphrase && restorePassphrase !== restorePassphraseConfirm)}
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
            <Alert variant={AlertVariant.warning} title="This will replace backed-up configuration" isInline>
              Current users, user groups, targets, and secrets included in the backup
              will be replaced with the backed-up versions. Restore runs asynchronously.
            </Alert>
          </FlexItem>
          <FlexItem>
            <label htmlFor="restore-remote-source" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              Remote backup URL or S3 URI (optional)
            </label>
            <TextInput
              id="restore-remote-source"
              type="text"
              placeholder="https://... or s3://bucket/key"
              value={restoreRemoteSource}
              onChange={(_event, value) => handleRemoteSourceChange(value)}
              isDisabled={isUploading}
            />
            <small style={{ display: 'block', marginTop: '0.5rem' }}>
              Use either a remote source or a local archive file. S3 restore uses the operator&apos;s configured bucket and credentials.
            </small>
          </FlexItem>
          <FlexItem>
            <label htmlFor="restore-file" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              Or select a local backup archive
            </label>
            <input
              id="restore-file"
              ref={fileInputRef}
              type="file"
              accept=".tar.gz,.tar.gz.enc"
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
          <FlexItem>
            <label htmlFor="restore-passphrase" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              Passphrase (required for encrypted archives)
            </label>
            <TextInput
              id="restore-passphrase"
              type="password"
              placeholder="Passphrase"
              value={restorePassphrase}
              onChange={(_event, value) => setRestorePassphrase(value)}
              isDisabled={isUploading}
            />
            {restorePassphrase && (
              <>
                <TextInput
                  id="restore-passphrase-confirm"
                  type="password"
                  placeholder="Confirm passphrase"
                  value={restorePassphraseConfirm}
                  onChange={(_event, value) => setRestorePassphraseConfirm(value)}
                  isDisabled={isUploading}
                  validated={restorePassphraseConfirm && restorePassphrase !== restorePassphraseConfirm ? 'error' : 'default'}
                  style={{ marginTop: '0.5rem' }}
                />
                {restorePassphraseConfirm && restorePassphrase !== restorePassphraseConfirm && (
                  <small style={{ color: 'var(--pf-v5-global--danger-color--100)', display: 'block', marginTop: '0.25rem' }}>
                    Passphrases do not match
                  </small>
                )}
              </>
            )}
          </FlexItem>
        </Flex>
      </Modal>
    </>
  );
}
