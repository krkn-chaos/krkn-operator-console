/**
 * FileManagementPage - Main page for file management.
 *
 * File create and edit actions open focused child modals while the management
 * surface remains a full page.
 *
 * @example
 * import { PageSection } from '@patternfly/react-core';
 * import { FileManagementPage } from './components/FileManagement';
 *
 * function FilesRoute() {
 *   return (
 *     <PageSection isFilled>
 *       <FileManagementPage />
 *     </PageSection>
 *   );
 * }
 */

import {
  Alert,
  AlertActionCloseButton,
  Card,
  CardBody,
  CardTitle,
  Flex,
  FlexItem,
  Spinner,
  Title,
} from '@patternfly/react-core';
import { FilesTable } from './FilesTable';
import { FileFormModal } from './FileFormModal';
import { useFileManagementPage } from './useFileManagementPage';

export function FileManagementPage() {
  const page = useFileManagementPage();

  return (
    <>
      <Card style={{ width: '100%' }}>
        <CardTitle>
          <Flex alignItems={{ default: 'alignItemsCenter' }}>
            <FlexItem>
              <Title headingLevel="h1" size="lg">File Management</Title>
            </FlexItem>
          </Flex>
        </CardTitle>
        <CardBody>
          <p style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--pf-v5-global--Color--200)' }}>
            Manage ConfigMap-based files
          </p>
          {page.error && (
            <Alert
              variant="danger"
              isInline
              title="Error"
              style={{ marginBottom: '1rem' }}
              actionClose={<AlertActionCloseButton onClose={page.clearError} />}
            >
              {page.error}
            </Alert>
          )}
          {page.loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Spinner size="lg" aria-label="Loading" />
            </div>
          ) : (
            <div style={{ marginTop: '1.5rem' }}>
              <FilesTable
                files={page.files}
                isAdmin={page.isAdmin}
                userGroups={page.userGroups}
                onCreateClick={page.openCreateFile}
                onEditClick={page.openEditFile}
                onDeleteClick={page.handleDeleteFile}
                onRefresh={page.loadFiles}
              />
            </div>
          )}
        </CardBody>
      </Card>
      <FileFormModal
        isOpen={page.fileFormOpen}
        mode={page.fileFormMode}
        initialData={page.selectedFile || undefined}
        onClose={page.closeFileForm}
        onSuccess={page.handleFileFormSuccess}
      />
    </>
  );
}
