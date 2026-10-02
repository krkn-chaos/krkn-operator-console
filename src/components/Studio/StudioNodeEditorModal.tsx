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
import type { StudioNode, ScenariosRequest, ScenarioFormValues, TouchedFields, SignatureStatus } from '../../types/api';

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
  const {
    scenarios,
    loading: loadingScenarios,
    error: scenariosError,
    fetchScenarios,
    resetScenarios,
  } = useScenariosFetch();

  // Step 1: Registry selection
  const [registryType, setRegistryType] = useState<'public' | 'private'>('public');
  const [registryName, setRegistryName] = useState<string>('');

  // Step 2: Scenario selection
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [selectedSignatureStatus, setSelectedSignatureStatus] = useState<SignatureStatus | undefined>();
  const [scenarioImage, setScenarioImage] = useState<string>('');
  const [scenarioConfigStatus, setScenarioConfigStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

  // Step 3: Scenario configuration
  const [formValues, setFormValues] = useState<ScenarioFormValues>({});
  const [globalFormValues, setGlobalFormValues] = useState<ScenarioFormValues>({});
  const [globalTouchedFields, setGlobalTouchedFields] = useState<TouchedFields>({});
  const [scenarioDefaultValues, setScenarioDefaultValues] = useState<ScenarioFormValues>({});
  const [cloudCredentialRef, setCloudCredentialRef] = useState('');
  const [volumes, setVolumes] = useState<{ [fileId: string]: string }>({});
  const [resiliencyWeight, setResiliencyWeight] = useState(1);

  // Step 4: Node metadata
  const [newNodeId, setNewNodeId] = useState<string>('');
  const [nodeIdError, setNodeIdError] = useState<string | undefined>(undefined);
  const [hasPendingFileInput, setHasPendingFileInput] = useState(false);
  const [pendingFileWarningShown, setPendingFileWarningShown] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // Track if we've initialized to prevent repeated initialization
  const hasInitialized = useRef(false);

  // Initialize when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Reset initialization flag when modal closes
      hasInitialized.current = false;
      setScenarioConfigStatus('idle');
      return;
    }

    if (!node || hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;
    resetScenarios();
    setScenarioConfigStatus('idle');

    // Initialize from node data
    if (node.config) {
      setRegistryType(node.config.registryType);
      setRegistryName(node.config.registryConfig?.registryName || '');
      setSelectedScenario(node.config.scenarioName);
      setSelectedSignatureStatus(node.config.signature_status);
      setScenarioImage(node.config.scenarioImage);
      setFormValues(node.config.scenarioFormValues || {});
      setGlobalFormValues(node.config.globalFormValues || {});
      setGlobalTouchedFields(node.config.globalTouchedFields || {});
      setCloudCredentialRef(node.config.cloudCredentialRef || '');
      setVolumes(node.config.volumes || {});
      setResiliencyWeight(node.config.resiliencyWeight ?? 1);
      setScenarioDefaultValues({}); // Will be repopulated when scenario loads
      setNewNodeId(node.nodeId);
    } else {
      setRegistryType('public');
      setRegistryName('');
      setSelectedScenario(null);
      setSelectedSignatureStatus(undefined);
      setScenarioImage('');
      setFormValues({});
      setGlobalFormValues({});
      setGlobalTouchedFields({});
      setCloudCredentialRef('');
      setVolumes({});
      setResiliencyWeight(1);
      setScenarioDefaultValues({});
      setNewNodeId(node.nodeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, resetScenarios]); // Only trigger on isOpen changes, ignore node reference changes

  // Handle registry type change
  const handleRegistryTypeChange = useCallback((type: 'public' | 'private') => {
    setRegistryType(type);
    if (type === 'public') {
      // Public registry - clear the private registry selection.
      setRegistryName('');
    } else {
      // Private registry - reset to trigger auto-select
      setRegistryName('');
    }
    // Clear scenario, form values and defaults when registry changes
    setSelectedScenario(null);
    setSelectedSignatureStatus(undefined);
    setFormValues({});
    setScenarioDefaultValues({});
    setCloudCredentialRef('');
    setScenarioConfigStatus('idle');
    resetScenarios();
  }, [resetScenarios]);

  // Handle registry name change
  const handleRegistryNameChange = useCallback((name: string) => {
    setRegistryName(name);
    // Clear scenario, form values and defaults when registry name changes
    setSelectedScenario(null);
    setSelectedSignatureStatus(undefined);
    setFormValues({});
    setScenarioDefaultValues({});
    setCloudCredentialRef('');
    setScenarioConfigStatus('idle');
    resetScenarios();
  }, [resetScenarios]);

  const getSelectedRegistryConfig = useCallback((): ScenariosRequest => (
    registryType === 'private' && registryName ? { registryName } : {}
  ), [registryType, registryName]);

  const loadScenariosForSelectedRegistry = useCallback(() => {
    setScenarioConfigStatus('idle');
    if (registryType === 'private' && !registryName) {
      resetScenarios();
      return;
    }
    void fetchScenarios(getSelectedRegistryConfig());
  }, [fetchScenarios, getSelectedRegistryConfig, registryName, registryType, resetScenarios]);

  const retryFetchScenarios = useCallback(() => {
    loadScenariosForSelectedRegistry();
  }, [loadScenariosForSelectedRegistry]);

  // Validate node ID
  const handleNodeIdChange = useCallback((value: string) => {
    setNewNodeId(value);
    const validation = validateNodeId(value, node?.nodeId);
    setNodeIdError(validation.valid ? undefined : validation.error);
  }, [validateNodeId, node?.nodeId]);

  // Wizard step callbacks
  const handleScenarioSelect = useCallback((scenarioName: string, signatureStatus?: SignatureStatus) => {
    setSelectedScenario(scenarioName);
    setSelectedSignatureStatus(signatureStatus);
    setScenarioConfigStatus('idle');

    // Build image URL
    const registry = registryType === 'private' && registryName
      ? registryName
      : 'quay.io/krkn-chaos/krkn-hub';

    setScenarioImage(`${registry}:${scenarioName}`);

    // Reset form values and defaults immediately when scenario changes
    // Prevents stale values from previous scenario being saved
    setFormValues({});
    setScenarioDefaultValues({});
    setCloudCredentialRef('');
  }, [registryType, registryName]);

  const handleScenarioConfigLoadStatusChange = useCallback((status: 'loading' | 'loaded' | 'error') => {
    setScenarioConfigStatus(status);
  }, []);

  const startScenarioConfigLoad = useCallback(() => {
    setScenarioConfigStatus('loading');
  }, []);

  // Reset warning when pending input is cleared
  useEffect(() => {
    if (!hasPendingFileInput && pendingFileWarningShown) {
      setPendingFileWarningShown(false);
      setValidationWarnings([]);
    }
  }, [hasPendingFileInput, pendingFileWarningShown]);

  const handleSave = () => {
    if (!node || !selectedScenario || nodeIdError || scenarioConfigStatus !== 'loaded') return;
    if (registryType === 'private' && !registryName) return;
    if (!scenarios.some((scenario) => scenario.name === selectedScenario)) return;

    if (!Number.isFinite(resiliencyWeight) || resiliencyWeight <= 0) {
      setValidationWarnings(['Resiliency weight must be greater than 0.']);
      return;
    }

    // Check for pending file input (file selected or path typed but not added)
    if (hasPendingFileInput && !pendingFileWarningShown) {
      setValidationWarnings([
        'You have unsaved changes in the Managed Files section. Click "Add" to include the file, or clear the selection to proceed without it.',
      ]);
      setPendingFileWarningShown(true);
      return;
    }

    // Build registryConfig from primitive
    const registryConfig = getSelectedRegistryConfig();

    // Merge default values for optional fields that weren't touched
    const finalFormValues = { ...scenarioDefaultValues, ...formValues };

    const updates: Partial<StudioNode> = {
      status: 'configured',
      config: {
        registryType,
        registryConfig,
        scenarioName: selectedScenario,
        scenarioImage,
        signature_status: selectedSignatureStatus,
        scenarioFormValues: finalFormValues,
        globalFormValues,
        globalTouchedFields,
        volumes: Object.keys(volumes).length > 0 ? volumes : undefined,
        resiliencyWeight,
        cloudCredentialRef: cloudCredentialRef || undefined,
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

  const selectedScenarioIsAvailable = !!selectedScenario && scenarios.some(
    (scenario) => scenario.name === selectedScenario,
  );
  const scenarioListIsReady = !loadingScenarios && !scenariosError && selectedScenarioIsAvailable;

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
      isNextDisabled: registryType === 'private' && !registryName,
    },
    {
      id: 'scenario-step',
      name: 'Scenario',
      component: (
        <ScenariosListStep
          scenarios={scenarios}
          selectedScenario={selectedScenario}
          onSelectScenario={handleScenarioSelect}
          loading={loadingScenarios}
          error={scenariosError}
          onRetry={retryFetchScenarios}
        />
      ),
      isNextDisabled: !scenarioListIsReady,
      isStepDisabled: registryType === 'private' && !registryName,
      onEnter: loadScenariosForSelectedRegistry,
    },
    {
      id: 'configuration-step',
      name: 'Configuration',
      isStepDisabled: !scenarioListIsReady,
      isNextDisabled: scenarioConfigStatus !== 'loaded',
      onEnter: startScenarioConfigLoad,
      component: selectedScenario ? (
        <ScenarioConfigStep
          key={`${selectedScenario}-${registryType === 'private' ? registryName : 'public'}`}
          scenarioName={selectedScenario}
          registryName={registryType === 'private' ? registryName : ''}
          formValues={formValues}
          globalFormValues={globalFormValues}
          globalTouchedFields={globalTouchedFields}
          onFormChange={setFormValues}
          onGlobalFormChange={handleGlobalFormChange}
          onDefaultValuesLoad={handleDefaultValuesLoad}
          onLoadStatusChange={handleScenarioConfigLoadStatusChange}
          cloudCredentialRef={cloudCredentialRef}
          onCloudCredentialRefChange={setCloudCredentialRef}
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
          volumes={volumes}
          onVolumesChange={(vols) => {
            setVolumes(vols);
            setPendingFileWarningShown(false);
            setValidationWarnings([]);
          }}
           onPendingChange={setHasPendingFileInput}
           resiliencyWeight={resiliencyWeight}
           onResiliencyWeightChange={setResiliencyWeight}
         />
      ),
      isStepDisabled: !scenarioListIsReady || scenarioConfigStatus !== 'loaded',
      isNextDisabled: !!nodeIdError || !newNodeId,
    },
  ];

  return (
    <WizardStepper
      isOpen={isOpen}
      title="Configure Chaos Scenario"
      description={`Configure node: ${node.nodeId}`}
      steps={steps}
      validationWarnings={validationWarnings}
      onClose={handleClose}
      onSave={handleSave}
    />
  );
}

export const StudioNodeEditorModal = memo(StudioNodeEditorModalComponent);
