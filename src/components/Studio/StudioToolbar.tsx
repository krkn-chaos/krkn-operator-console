/**
 * StudioToolbar - Toolbar with workflow actions
 *
 * Provides:
 * - Add Scenario button
 * - Export to JSON
 * - Save to Cluster (mock)
 * - Clear All
 */

import {
  Button,
  Flex,
  FlexItem,
  Divider,
} from '@patternfly/react-core';
import { PlusCircleIcon, DownloadIcon, SaveIcon, TrashIcon } from '@patternfly/react-icons';
import { useStudioContext } from './StudioContext';

export function StudioToolbar() {
  const { addNode, exportWorkflow, clearWorkflow, workflow } = useStudioContext();

  const handleExport = () => {
    const result = exportWorkflow();

    if ('error' in result) {
      alert(result.error); // TODO: Replace with toast notification
      return;
    }

    const blob = new Blob([JSON.stringify(result.graph, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chaos-workflow-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToCluster = async () => {
    // Mock - will implement later
    await new Promise(r => setTimeout(r, 1000));
    alert('Save to cluster functionality will be implemented in a future phase');
  };

  const handleClearAll = () => {
    if (workflow.nodes.length === 0) return;

    if (confirm('Are you sure you want to clear the entire workflow? This cannot be undone.')) {
      clearWorkflow();
    }
  };

  return (
    <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
      <FlexItem>
        <Button
          variant="primary"
          icon={<PlusCircleIcon />}
          onClick={addNode}
        >
          Add Scenario
        </Button>
      </FlexItem>

      <FlexItem>
        <Button
          variant="secondary"
          icon={<DownloadIcon />}
          onClick={handleExport}
          isDisabled={workflow.nodes.length === 0}
        >
          Export JSON
        </Button>
      </FlexItem>

      <FlexItem>
        <Button
          variant="secondary"
          icon={<SaveIcon />}
          onClick={handleSaveToCluster}
          isDisabled={workflow.nodes.length === 0}
        >
          Save to Cluster
        </Button>
      </FlexItem>

      <Divider orientation={{ default: 'vertical' }} />

      <FlexItem>
        <Button
          variant="danger"
          icon={<TrashIcon />}
          onClick={handleClearAll}
          isDisabled={workflow.nodes.length === 0}
        >
          Clear All
        </Button>
      </FlexItem>
    </Flex>
  );
}
