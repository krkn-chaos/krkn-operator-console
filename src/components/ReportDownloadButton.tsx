import React from 'react';
import {
  Button,
  Spinner,
  Alert,
  Flex,
  FlexItem,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  ExpandableSection,
  Modal,
  ModalVariant,
} from '@patternfly/react-core';
import { useReportActions } from '../hooks/useReportActions';

interface ReportDownloadButtonProps {
  runId: string;
  runName: string;
  runPhase?: string;
}

/**
 * @example
 * <ReportDownloadButton
 *   runId={run.scenarioRunName}
 *   runName={run.scenarioRunName}
 *   runPhase={run.phase}
 * />
 */
export const ReportDownloadButton: React.FC<ReportDownloadButtonProps> = ({ runId, runName, runPhase }) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isErrorExpanded, setIsErrorExpanded] = React.useState(false);

  const {
    isLoading,
    error,
    hasHtml,
    hasPdf,
    hasReports,
    preview,
    isDownloading,
    isPreviewing,
    handleDownload,
    handlePreview,
    closePreview,
    retry,
  } = useReportActions({ runId, runName, runPhase });

  if (error) {
    return (
      <ExpandableSection
        toggleContent={
          <span style={{ color: 'var(--pf-v5-global--danger-color--100)' }}>
            Report Error
          </span>
        }
        isExpanded={isErrorExpanded}
        onToggle={(_event, expanded) => setIsErrorExpanded(expanded)}
      >
        <Alert variant="danger" isInline title="Report Error">
          <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapMd' }}>
            <FlexItem>{error}</FlexItem>
            <FlexItem>
              <Button variant="secondary" size="sm" onClick={retry}>
                Retry
              </Button>
            </FlexItem>
          </Flex>
        </Alert>
      </ExpandableSection>
    );
  }

  if (isLoading) {
    return (
      <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
        <FlexItem>
          <Spinner size="sm" />
        </FlexItem>
        <FlexItem>Checking for reports...</FlexItem>
      </Flex>
    );
  }

  if (!hasReports) {
    return (
      <span style={{ color: 'var(--pf-v5-global--Color--200)', fontStyle: 'italic' }}>
        No reports available
      </span>
    );
  }

  return (
    <>
      <Flex>
        <Dropdown
          isOpen={isMenuOpen}
          onOpenChange={setIsMenuOpen}
          toggle={(toggleRef) => (
            <MenuToggle
              ref={toggleRef}
              variant="secondary"
              onClick={() => setIsMenuOpen((open) => !open)}
              isExpanded={isMenuOpen}
              isDisabled={isDownloading !== null || isPreviewing !== null}
            >
              Reports
            </MenuToggle>
          )}
        >
          <DropdownList>
            {hasHtml && (
              <>
                <DropdownItem
                  onClick={() => {
                    setIsMenuOpen(false);
                    void handlePreview('html');
                  }}
                >
                  Preview HTML
                </DropdownItem>
                <DropdownItem
                  onClick={() => {
                    setIsMenuOpen(false);
                    void handleDownload('html');
                  }}
                >
                  Download HTML
                </DropdownItem>
              </>
            )}
            {hasPdf && (
              <>
                <DropdownItem
                  onClick={() => {
                    setIsMenuOpen(false);
                    void handlePreview('pdf');
                  }}
                >
                  Preview PDF
                </DropdownItem>
                <DropdownItem
                  onClick={() => {
                    setIsMenuOpen(false);
                    void handleDownload('pdf');
                  }}
                >
                  Download PDF
                </DropdownItem>
              </>
            )}
          </DropdownList>
        </Dropdown>
      </Flex>
      <Modal
        title={(preview?.format.toUpperCase() || '') + ' report preview'}
        variant={ModalVariant.large}
        isOpen={preview !== null}
        onClose={closePreview}
      >
        {preview && (
          <iframe
            src={preview.url}
            title={preview.format.toUpperCase() + ' report preview'}
            style={{ width: '100%', height: '70vh', border: 0 }}
            sandbox={preview.format === 'html' ? '' : undefined}
          />
        )}
      </Modal>
    </>
  );
};
