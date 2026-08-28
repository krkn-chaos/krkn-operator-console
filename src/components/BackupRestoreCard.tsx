import { useState } from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  Button,
  Flex,
  FlexItem,
  Modal,
  ModalVariant,
  TextInput,
  Alert,
  AlertVariant,
  Spinner,
  Split,
  SplitItem,
} from '@patternfly/react-core';
import { useNotifications } from '../hooks/useNotifications';
import { backupRestoreApi } from '../services/backupRestoreApi';

export function BackupRestoreCard() {
  const { showSuccess, showError } = useNotifications();
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [restorePath, setRestorePath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);

  const handleBackupClick = () => {
    setBackupName('');
    setLastJobId(null);
    setIsBackupModalOpen(true);
  };

  const handleBackupStart = async () => {
    setIsLoading(true);
    try {
      const defaultName = backupName || `krkn-backup-${new Date().toISOString().split('T')[0]}`;
      const response = await backupRestoreApi.startBackup(
        backupName ? { backupName } : undefined
      );
      setLastJobId(response.jobId);
      setIsBackupModalOpen(false);
      showSuccess(
        'Backup Started',
        `Job ID: ${response.jobId}\n\nBackup File:\nbackups/${defaultName}.tar.gz\n\nTo restore, use this file path in the Restore dialog.`
      );
    } catch (error) {
      showError(
        'Backup Failed',
        error instanceof Error ? error.message : 'Failed to start backup'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreClick = () => {
    setRestorePath('');
    setLastJobId(null);
    setShowConfirmRestore(false);
    setIsRestoreModalOpen(true);
  };

  const handleRestorePathSubmit = () => {
    if (!restorePath.trim()) {
      showError('Invalid Path', 'Please enter a backup file path');
      return;
    }
    setShowConfirmRestore(true);
  };

  const handleRestoreConfirm = async () => {
    setIsLoading(true);
    try {
      const response = await backupRestoreApi.startRestore({ backupPath: restorePath });
      setLastJobId(response.jobId);
      setIsRestoreModalOpen(false);
      setShowConfirmRestore(false);
      showSuccess(
        'Restore Started',
        `Job ID: ${response.jobId}\n\nRestore in progress from: ${restorePath}\n\nRefresh the page once complete to reload configuration.`
      );
    } catch (error) {
      showError(
        'Restore Failed',
        error instanceof Error ? error.message : 'Failed to start restore'
      );
    } finally {
      setIsLoading(false);
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
                Create backups of all configuration data including users, targets, providers, and credentials.
                Use restore to recover from a previous backup.
              </p>
            </FlexItem>

            {lastJobId && (
              <FlexItem>
                <Alert
                  variant={AlertVariant.success}
                  title="Operation Started"
                  isInline
                >
                  Job ID: <code>{lastJobId}</code>
                </Alert>
              </FlexItem>
            )}

            <FlexItem>
              <Split hasGutter>
                <SplitItem>
                  <Button
                    variant="primary"
                    onClick={handleBackupClick}
                    isDisabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Spinner size="sm" />
                        {' '}Creating Backup...
                      </>
                    ) : (
                      'Create Backup'
                    )}
                  </Button>
                </SplitItem>
                <SplitItem>
                  <Button
                    variant="secondary"
                    onClick={handleRestoreClick}
                    isDisabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Spinner size="sm" />
                        {' '}Restoring...
                      </>
                    ) : (
                      'Restore from Backup'
                    )}
                  </Button>
                </SplitItem>
              </Split>
            </FlexItem>
          </Flex>
        </CardBody>
      </Card>

      {/* Backup Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Create Backup"
        isOpen={isBackupModalOpen}
        onClose={() => !isLoading && setIsBackupModalOpen(false)}
        actions={[
          <Button
            key="create"
            variant="primary"
            onClick={handleBackupStart}
            isLoading={isLoading}
          >
            Create Backup
          </Button>,
          <Button key="cancel" variant="link" onClick={() => setIsBackupModalOpen(false)}>
            Cancel
          </Button>,
        ]}
      >
        <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
          <FlexItem>
            <p>
              Create a backup of all configuration data. This includes users, groups, targets,
              providers, file types, credentials, and Elasticsearch configurations.
            </p>
          </FlexItem>
          <FlexItem>
            <label htmlFor="backup-name" style={{ display: 'block', marginBottom: '0.5rem' }}>
              Backup Name (Optional)
            </label>
            <TextInput
              id="backup-name"
              type="text"
              placeholder="e.g., pre-upgrade, prod-backup"
              value={backupName}
              onChange={(_event, val) => setBackupName(val)}
              isDisabled={isLoading}
            />
            <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
              If not provided, a default name with today's date will be used.
            </small>
          </FlexItem>
        </Flex>
      </Modal>

      {/* Restore Modal - Path Input */}
      {isRestoreModalOpen && !showConfirmRestore && (
        <Modal
          variant={ModalVariant.small}
          title="Restore from Backup"
          isOpen={true}
          onClose={() => !isLoading && setIsRestoreModalOpen(false)}
          actions={[
            <Button
              key="next"
              variant="primary"
              onClick={handleRestorePathSubmit}
              isLoading={isLoading}
            >
              Next
            </Button>,
            <Button key="cancel" variant="link" onClick={() => setIsRestoreModalOpen(false)}>
              Cancel
            </Button>,
          ]}
        >
          <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
            <FlexItem>
              <p>
                Restore from a previously created backup. This will replace all users, groups,
                targets, providers, and credentials with the backed-up versions.
              </p>
            </FlexItem>
            <FlexItem>
              <label htmlFor="backup-path" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Backup File Path
              </label>
              <TextInput
                id="backup-path"
                type="text"
                placeholder="e.g., /tmp/krkn-backup-2025-08-28.tar.gz"
                value={restorePath}
                onChange={(_event, val) => setRestorePath(val)}
                isDisabled={isLoading}
              />
              <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
                Full path to the backup tar.gz file
              </small>
            </FlexItem>
          </Flex>
        </Modal>
      )}

      {/* Restore Modal - Confirmation */}
      {isRestoreModalOpen && showConfirmRestore && (
        <Modal
          variant={ModalVariant.small}
          title="Confirm Restore"
          isOpen={true}
          onClose={() => !isLoading && setIsRestoreModalOpen(false)}
          actions={[
            <Button
              key="restore"
              variant="danger"
              onClick={handleRestoreConfirm}
              isLoading={isLoading}
            >
              Yes, Restore Everything
            </Button>,
            <Button key="cancel" variant="secondary" onClick={() => setShowConfirmRestore(false)}>
              Back
            </Button>,
          ]}
        >
          <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
            <FlexItem>
              <Alert variant={AlertVariant.warning} title="This action will replace all data" isInline>
                All current users, groups, targets, providers, file types, secrets, and credentials
                will be permanently replaced with the backed-up versions.
              </Alert>
            </FlexItem>
            <FlexItem>
              <p>
                Backup file: <code>{restorePath}</code>
              </p>
            </FlexItem>
            <FlexItem>
              <p>Are you sure you want to proceed?</p>
            </FlexItem>
          </Flex>
        </Modal>
      )}
    </>
  );
}
