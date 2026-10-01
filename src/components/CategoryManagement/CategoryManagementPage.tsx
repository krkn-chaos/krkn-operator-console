import {
  Alert,
  AlertActionCloseButton,
  Button,
  Card,
  CardBody,
  CardTitle,
  Flex,
  FlexItem,
  Spinner,
  Title,
} from '@patternfly/react-core';
import { CategoriesTable } from './CategoriesTable';
import { CategoryFormModal } from './CategoryFormModal';
import { useCategoryManagementPage } from './useCategoryManagementPage';

/** Full-page category listing with create, edit, and delete actions. */
export function CategoryManagementPage() {
  const page = useCategoryManagementPage();

  return (
    <>
      <Card style={{ width: '100%' }}>
        <CardTitle>
          <Flex alignItems={{ default: 'alignItemsCenter' }}>
            <FlexItem>
              <Title headingLevel="h1" size="lg">Categories</Title>
            </FlexItem>
          </Flex>
        </CardTitle>
        <CardBody>
          <p style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--pf-v5-global--Color--200)' }}>
            Manage categories and their visibility
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
              {page.categories.length === 0 && (
                <div>
                  <Button variant="link" onClick={page.retryLoadCategories}>Retry</Button>
                </div>
              )}
            </Alert>
          )}
          {page.loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Spinner size="lg" aria-label="Loading categories" />
            </div>
          ) : page.error && page.categories.length === 0 ? null : (
            <div style={{ marginTop: '1.5rem' }}>
              <CategoriesTable
                categories={page.categories}
                currentUserId={page.currentUserId}
                isAdmin={page.isAdmin}
                onCreateClick={page.openCreateCategory}
                onEditClick={page.openEditCategory}
                onDeleteClick={page.handleDeleteCategory}
                onRefresh={page.loadCategories}
              />
            </div>
          )}
        </CardBody>
      </Card>
      <CategoryFormModal
        isOpen={page.formOpen}
        mode={page.formMode}
        initialData={page.selectedCategory || undefined}
        onClose={page.closeForm}
        onSuccess={page.handleFormSuccess}
      />
    </>
  );
}
