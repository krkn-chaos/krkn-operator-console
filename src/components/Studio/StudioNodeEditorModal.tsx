/**
 * StudioNodeEditorModal - Multi-step wizard for node configuration
 *
 * Steps:
 * 1. Registry selection (public/private)
 * 2. Scenario selection
 * 3. Scenario configuration (DynamicFormBuilder)
 * 4. Node metadata (nodeId, volumes, files)
 */

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { WizardStepper, WizardStepConfig } from './WizardStepper';
import { RegistrySelectorStep } from './RegistrySelectorStep';
import { ScenariosListStep } from './ScenariosListStep';
import { ScenarioConfigStep } from './ScenarioConfigStep';
import { NodeMetadataStep } from './NodeMetadataStep';
import { useStudioContext } from './StudioContext';
import { useScenariosFetch } from '../../hooks';
import type { StudioNode, ScenariosRequest, ScenarioFormValues, TouchedFields } from '../../types/api';

interface StudioNodeEditorModalProps {
  isOpen: boolean;
  node: StudioNode | null;
  onClose: () => void;
  onSave: (nodeId: string, updates: Partial<StudioNode>) => void;
}

function StudioNodeEditorModalComponent({
  isOpen,
  node,
  onClose,
  onSave,
}: StudioNodeEditorModalProps) {
  const { validateNodeId } = useStudioContext();
  const { scenarios, loading: loadingScenarios, fetchScenarios } = useScenariosFetch();

  // Step 1: Registry selection
  const [registryType, setRegistryType] = useState<'public' | 'private'>('public');
  const [registryName, setRegistryName] = useState<string>('');

  // Step 2: Scenario selection
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [scenarioImage, setScenarioImage] = useState<string>('');

  // Step 3: Scenario configuration
  const [formValues, setFormValues] = useState<ScenarioFormValues>({});
  const [globalFormValues, setGlobalFormValues] = useState<ScenarioFormValues>({});
  const [globalTouchedFields, setGlobalTouchedFields] = useState<TouchedFields>({});
  const [scenarioDefaultValues, setScenarioDefaultValues] = useState<ScenarioFormValues>({});

  // Step 4: Node metadata
  const [newNodeId, setNewNodeId] = useState<string>('');
  const [nodeIdError, setNodeIdError] = useState<string | undefined>(undefined);

  // Track if we've initialized to prevent repeated initialization
  const hasInitialized = useRef(false);

  // Initialize when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Reset initialization flag when modal closes
      hasInitialized.current = false;
      return;
    }

    if (!node || hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;

    // Initialize from node data
    if (node.config) {
      setRegistryType(node.config.registryType);
      setRegistryName(node.config.registryConfig.registryName || '');
      setSelectedScenario(node.config.scenarioName);
      setScenarioImage(node.config.scenarioImage);
      setFormValues(node.config.scenarioFormValues || {});
      setGlobalFormValues(node.config.globalFormValues || {});
      setGlobalTouchedFields(node.config.globalTouchedFields || {});
      setScenarioDefaultValues({}); // Will be repopulated when scenario loads
      setNewNodeId(node.nodeId);
      fetchScenarios(node.config.registryConfig);
    } else {
      setRegistryType('public');
      setRegistryName('');
      setSelectedScenario(null);
      setScenarioImage('');
      setFormValues({});
      setGlobalFormValues({});
      setGlobalTouchedFields({});
      setScenarioDefaultValues({});
      setNewNodeId(node.nodeId);
      fetchScenarios({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Only trigger on isOpen changes, ignore node reference changes

  // Handle registry type change
  const handleRegistryTypeChange = useCallback((type: 'public' | 'private') => {
    setRegistryType(type);
    if (type === 'public') {
      // Public registry - clear registry name and fetch
      setRegistryName('');
      fetchScenarios({});
    } else {
      // Private registry - reset to trigger auto-select
      setRegistryName('');
    }
    // Clear scenario, form values and defaults when registry changes
    setSelectedScenario(null);
    setFormValues({});
    setScenarioDefaultValues({});
  }, [fetchScenarios]);

  // Handle registry name change
  const handleRegistryNameChange = useCallback((name: string) => {
    setRegistryName(name);
    const config: ScenariosRequest = name ? { registryName: name } : {};
    fetchScenarios(config);
    // Clear scenario, form values and defaults when registry name changes
    setSelectedScenario(null);
    setFormValues({});
    setScenarioDefaultValues({});
  }, [fetchScenarios]);

  // Validate node ID
  const handleNodeIdChange = useCallback((value: string) => {
    setNewNodeId(value);
    const validation = validateNodeId(value, node?.nodeId);
    setNodeIdError(validation.valid ? undefined : validation.error);
  }, [validateNodeId, node?.nodeId]);

  // Wizard step callbacks
  const handleScenarioSelect = useCallback((scenarioName: string) => {
    setSelectedScenario(scenarioName);

    // Build image URL
    const registry = registryType === 'private' && registryName
      ? registryName
      : 'quay.io/krkn-chaos/krkn-hub';

    setScenarioImage(`${registry}:${scenarioName}`);

    // Reset form values and defaults immediately when scenario changes
    // Prevents stale values from previous scenario being saved
    setFormValues({});
    setScenarioDefaultValues({});
  }, [registryType, registryName]);

  const handleSave = () => {
    if (!node || !selectedScenario || nodeIdError) return;

    // Build registryConfig from primitive
    const registryConfig: ScenariosRequest = registryName ? { registryName } : {};

    // Merge default values for optional fields that weren't touched
    const finalFormValues = { ...scenarioDefaultValues, ...formValues };

    const updates: Partial<StudioNode> = {
      status: 'configured',
      config: {
        registryType,
        registryConfig,
        scenarioName: selectedScenario,
        scenarioImage,
        scenarioFormValues: finalFormValues,
        globalFormValues,
        globalTouchedFields,
      },
    };

    // Update nodeId if changed
    if (newNodeId !== node.nodeId) {
      updates.nodeId = newNodeId;
    }

    onSave(node.nodeId, updates);
    onClose();
  };

  const handleGlobalFormChange = useCallback((values: ScenarioFormValues, touchedFields: TouchedFields) => {
    setGlobalFormValues(values);
    setGlobalTouchedFields(touchedFields);
  }, []);

  const handleDefaultValuesLoad = useCallback((defaults: ScenarioFormValues) => {
    setScenarioDefaultValues(defaults);
  }, []);

  const handleClose = () => {
    onClose();
  };

  if (!node) return null;

  const steps: WizardStepConfig[] = [
    {
      id: 'registry-step',
      name: 'Registry',
      component: (
        <RegistrySelectorStep
          registryType={registryType}
          registryName={registryName}
          onRegistryTypeChange={handleRegistryTypeChange}
          onRegistryNameChange={handleRegistryNameChange}
        />
      ),
      isNextDisabled: loadingScenarios,
    },
    {
      id: 'scenario-step',
      name: 'Scenario',
      component: (
        <ScenariosListStep
          scenarios={scenarios}
          selectedScenario={selectedScenario}
          onSelectScenario={handleScenarioSelect}
        />
      ),
      isNextDisabled: !selectedScenario,
    },
    {
      id: 'configuration-step',
      name: 'Configuration',
      component: selectedScenario ? (
        <ScenarioConfigStep
          key={`${selectedScenario}-${registryName || 'public'}`}
          scenarioName={selectedScenario}
          registryName={registryName}
          formValues={formValues}
          globalFormValues={globalFormValues}
          globalTouchedFields={globalTouchedFields}
          onFormChange={setFormValues}
          onGlobalFormChange={handleGlobalFormChange}
          onDefaultValuesLoad={handleDefaultValuesLoad}
        />
      ) : null,
    },
    {
      id: 'node-metadata-step',
      name: 'Node Settings',
      component: (
        <NodeMetadataStep
          nodeId={newNodeId}
          onNodeIdChange={handleNodeIdChange}
          nodeIdError={nodeIdError}
          currentNodeId={node.nodeId}
        />
      ),
      isNextDisabled: !!nodeIdError || !newNodeId,
    },
  ];

  return (
    <WizardStepper
      isOpen={isOpen}
      title="Configure Chaos Scenario"
      description={`Configure node: ${node.nodeId}`}
      steps={steps}
      onClose={handleClose}
      onSave={handleSave}
    />
  );
}

export const StudioNodeEditorModal = memo(StudioNodeEditorModalComponent);
