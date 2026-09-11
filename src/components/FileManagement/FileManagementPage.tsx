/**
 * FileManagementPage - Main page for file and file types management.
 *
 * Full-page view with Files and File Types tabs. Create and edit actions open
 * focused child modals while the management surface remains a full page.
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
  Tab,
  Tabs,
  TabTitleText,
  Title,
} from '@patternfly/react-core';
import { FilesTable } from './FilesTable';
import { FileFormModal } from './FileFormModal';
import { FileTypesTable } from '../FileTypesManagement/FileTypesTable';
import { FileTypeFormModal } from '../FileTypesManagement/FileTypeFormModal';
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
            Manage ConfigMap-based files and file types
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
            <Tabs activeKey={page.activeTab} onSelect={page.selectTab} aria-label="File management tabs">
              <Tab eventKey="files-list" title={<TabTitleText>Files</TabTitleText>} aria-label="Files list">
                <div style={{ marginTop: '1.5rem' }}>
                  <FilesTable
                    files={page.files}
                    fileTypes={page.fileTypes}
                    isAdmin={page.isAdmin}
                    userGroups={page.userGroups}
                    onCreateClick={page.openCreateFile}
                    onEditClick={page.openEditFile}
                    onDeleteClick={page.handleDeleteFile}
                    onRefresh={page.loadFiles}
                  />
                </div>
              </Tab>
              <Tab eventKey="file-types" title={<TabTitleText>File Types</TabTitleText>} aria-label="File types management">
                <div style={{ marginTop: '1.5rem' }}>
                  <FileTypesTable
                    fileTypes={page.fileTypes}
                    onCreateClick={page.openCreateFileType}
                    onEditClick={page.openEditFileType}
                    onDeleteClick={page.handleDeleteFileType}
                    onRefresh={page.loadFileTypes}
                  />
                </div>
              </Tab>
            </Tabs>
          )}
        </CardBody>
      </Card>
      <FileFormModal
        isOpen={page.fileFormOpen}
        mode={page.fileFormMode}
        initialData={page.selectedFile || undefined}
        availableFileTypes={page.fileTypes}
        onClose={page.closeFileForm}
        onSuccess={page.handleFileFormSuccess}
        onRequestNewFileType={page.handleRequestNewFileType}
      />
      <FileTypeFormModal
        isOpen={page.fileTypeFormOpen}
        mode={page.fileTypeFormMode}
        initialData={page.selectedFileType || undefined}
        onClose={page.closeFileTypeForm}
        onSuccess={page.handleFileTypeFormSuccess}
      />
    </>
  );
}
