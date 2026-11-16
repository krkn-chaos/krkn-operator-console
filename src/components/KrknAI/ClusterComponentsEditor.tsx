import { Button, Checkbox } from '@patternfly/react-core';
import { BoxIcon, CubeIcon, CubesIcon, DatabaseIcon, ServerIcon, ServiceIcon } from '@patternfly/react-icons';
import type { ClusterComponents } from './types';

interface ClusterComponentsEditorProps {
  components: ClusterComponents;
  onChange: (components: ClusterComponents) => void;
}

type ComponentLocation =
  | { kind: 'namespace'; namespaceIndex: number }
  | { kind: 'pod'; namespaceIndex: number; podIndex: number }
  | { kind: 'container'; namespaceIndex: number; podIndex: number; containerIndex: number }
  | { kind: 'service'; namespaceIndex: number; componentIndex: number }
  | { kind: 'pvc'; namespaceIndex: number; componentIndex: number }
  | { kind: 'vmi'; namespaceIndex: number; componentIndex: number }
  | { kind: 'node'; componentIndex: number };

type NamespaceComponent = ClusterComponents['namespaces'][number];

function withNamespaceDisabled(namespace: NamespaceComponent, disabled: boolean): NamespaceComponent {
  return {
    ...namespace,
    disabled,
    pods: namespace.pods.map((pod) => ({
      ...pod,
      disabled,
      containers: pod.containers.map((container) => ({ ...container, disabled })),
    })),
    services: namespace.services.map((service) => ({ ...service, disabled })),
    pvcs: namespace.pvcs.map((pvc) => ({ ...pvc, disabled })),
    ...(namespace.vmis ? { vmis: namespace.vmis.map((vmi) => ({ ...vmi, disabled })) } : {}),
  };
}

function withDisabledFlag(components: ClusterComponents, location: ComponentLocation, disabled: boolean): ClusterComponents {
  if (location.kind === 'node') {
    return {
      ...components,
      nodes: components.nodes.map((node, index) => index === location.componentIndex ? { ...node, disabled } : node),
    };
  }

  return {
    ...components,
    namespaces: components.namespaces.map((namespace, namespaceIndex) => {
      if (namespaceIndex !== location.namespaceIndex) return namespace;
      if (location.kind === 'namespace') return withNamespaceDisabled(namespace, disabled);
      if (location.kind === 'pod') {
        return {
          ...namespace,
          pods: namespace.pods.map((pod, podIndex) => podIndex === location.podIndex ? { ...pod, disabled } : pod),
        };
      }
      if (location.kind === 'container') {
        return {
          ...namespace,
          pods: namespace.pods.map((pod, podIndex) => podIndex === location.podIndex
            ? {
              ...pod,
              containers: pod.containers.map((container, containerIndex) => containerIndex === location.containerIndex ? { ...container, disabled } : container),
            }
            : pod),
        };
      }
      if (location.kind === 'service') {
        return {
          ...namespace,
          services: namespace.services.map((service, index) => index === location.componentIndex ? { ...service, disabled } : service),
        };
      }
      if (location.kind === 'vmi') {
        return {
          ...namespace,
          vmis: namespace.vmis?.map((vmi, index) => index === location.componentIndex ? { ...vmi, disabled } : vmi),
        };
      }
      return {
        ...namespace,
        pvcs: namespace.pvcs.map((pvc, index) => index === location.componentIndex ? { ...pvc, disabled } : pvc),
      };
    }),
  };
}

export function ClusterComponentsEditor({ components, onChange }: ClusterComponentsEditorProps) {
  const toggleEnabled = (location: ComponentLocation, enabled: boolean) => {
    onChange(withDisabledFlag(components, location, !enabled));
  };

  const setAllNamespacesEnabled = (enabled: boolean) => {
    onChange({
      ...components,
      namespaces: components.namespaces.map((namespace) => withNamespaceDisabled(namespace, !enabled)),
    });
  };

  return (
    <div className="krkn-ai-component-editor">
      <div className="krkn-ai-component-actions">
        <Button
          variant="secondary"
          isDisabled={components.namespaces.length === 0}
          onClick={() => setAllNamespacesEnabled(true)}
        >
          Select all namespaces
        </Button>
        <Button
          variant="secondary"
          isDisabled={components.namespaces.length === 0}
          onClick={() => setAllNamespacesEnabled(false)}
        >
          Disable all namespaces
        </Button>
      </div>
      <div className="krkn-ai-component-namespaces">
        {components.namespaces.map((namespace, namespaceIndex) => (
          <details key={namespace.name} className="krkn-ai-component-namespace" open={namespaceIndex === 0}>
            <summary className="krkn-ai-component-namespace__summary">
              <span onClick={(event) => event.stopPropagation()}>
                <Checkbox
                  id={`krkn-ai-enable-namespace-${namespaceIndex}`}
                  label={(
                    <span className="krkn-ai-component-label">
                      <CubesIcon aria-hidden="true" />
                      {namespace.name}
                    </span>
                  )}
                  isChecked={!namespace.disabled}
                  onChange={(_event, checked) => toggleEnabled({ kind: 'namespace', namespaceIndex }, checked)}
                />
              </span>
              <span className="krkn-ai-component-namespace__state">{namespace.disabled ? 'Disabled' : 'Enabled'}</span>
            </summary>
            <div className="krkn-ai-component-namespace-content">
              <fieldset className="krkn-ai-component-group">
                <legend>Pods and containers</legend>
                {namespace.pods.length === 0 && <p className="krkn-ai-muted">No pods were returned by discovery.</p>}
                {namespace.pods.map((pod, podIndex) => (
                  <div key={pod.name} className="krkn-ai-component-pod">
                    <Checkbox
                      id={`krkn-ai-enable-pod-${namespaceIndex}-${podIndex}`}
                      label={(
                        <span className="krkn-ai-component-label">
                          <CubeIcon aria-hidden="true" />
                          {pod.name}
                        </span>
                      )}
                      isChecked={!pod.disabled}
                      isDisabled={namespace.disabled}
                      onChange={(_event, checked) => toggleEnabled({ kind: 'pod', namespaceIndex, podIndex }, checked)}
                    />
                    <div className="krkn-ai-component-children">
                      <span>Containers</span>
                      {pod.containers.length === 0 && <p className="krkn-ai-muted">No containers were returned by discovery.</p>}
                      {pod.containers.map((container, containerIndex) => (
                        <Checkbox
                          key={containerIndex}
                          id={`krkn-ai-enable-container-${namespaceIndex}-${podIndex}-${containerIndex}`}
                          label={(
                            <span className="krkn-ai-component-label">
                              <BoxIcon aria-hidden="true" />
                              {container.name}
                            </span>
                          )}
                          aria-label={`Container ${container.name} in pod ${pod.name} in namespace ${namespace.name}`}
                          isChecked={!container.disabled}
                          isDisabled={namespace.disabled || pod.disabled}
                          onChange={(_event, checked) => toggleEnabled({ kind: 'container', namespaceIndex, podIndex, containerIndex }, checked)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </fieldset>
              <fieldset className="krkn-ai-component-group">
                <legend>Services</legend>
                {namespace.services.length === 0 && <p className="krkn-ai-muted">No services were returned by discovery.</p>}
                {namespace.services.map((service, componentIndex) => (
                  <Checkbox
                    key={service.name}
                    id={`krkn-ai-enable-service-${namespaceIndex}-${componentIndex}`}
                    label={(
                      <span className="krkn-ai-component-label">
                        <ServiceIcon aria-hidden="true" />
                        {service.name}
                      </span>
                    )}
                    isChecked={!service.disabled}
                    isDisabled={namespace.disabled}
                    onChange={(_event, checked) => toggleEnabled({ kind: 'service', namespaceIndex, componentIndex }, checked)}
                  />
                ))}
              </fieldset>
              <fieldset className="krkn-ai-component-group">
                <legend>Persistent volume claims</legend>
                {namespace.pvcs.length === 0 && <p className="krkn-ai-muted">No PVCs were returned by discovery.</p>}
                {namespace.pvcs.map((pvc, componentIndex) => (
                  <Checkbox
                    key={pvc.name}
                    id={`krkn-ai-enable-pvc-${namespaceIndex}-${componentIndex}`}
                    label={(
                      <span className="krkn-ai-component-label">
                        <DatabaseIcon aria-hidden="true" />
                        {pvc.name}
                      </span>
                    )}
                    isChecked={!pvc.disabled}
                    isDisabled={namespace.disabled}
                    onChange={(_event, checked) => toggleEnabled({ kind: 'pvc', namespaceIndex, componentIndex }, checked)}
                  />
                ))}
              </fieldset>
              {namespace.vmis && namespace.vmis.length > 0 && (
                <fieldset className="krkn-ai-component-group">
                  <legend>Virtual machine instances (VMIs)</legend>
                  {namespace.vmis.map((vmi, componentIndex) => (
                    <Checkbox
                      key={vmi.name}
                      id={`krkn-ai-enable-vmi-${namespaceIndex}-${componentIndex}`}
                      label={(
                        <span className="krkn-ai-component-label">
                          <ServerIcon aria-hidden="true" />
                          {vmi.name}
                        </span>
                      )}
                      aria-label={`VMI ${vmi.name} in namespace ${namespace.name}`}
                      isChecked={!vmi.disabled}
                      isDisabled={namespace.disabled}
                      onChange={(_event, checked) => toggleEnabled({ kind: 'vmi', namespaceIndex, componentIndex }, checked)}
                    />
                  ))}
                </fieldset>
              )}
            </div>
          </details>
        ))}
      </div>
      <fieldset className="krkn-ai-component-group krkn-ai-node-group">
        <legend>Nodes</legend>
        {components.nodes.length === 0 && <p className="krkn-ai-muted">No nodes were returned by discovery.</p>}
        {components.nodes.map((node, componentIndex) => (
          <Checkbox
            key={node.name}
            id={`krkn-ai-enable-node-${componentIndex}`}
            label={(
              <span className="krkn-ai-component-label">
                <ServerIcon aria-hidden="true" />
                {node.name}
              </span>
            )}
            isChecked={!node.disabled}
            onChange={(_event, checked) => toggleEnabled({ kind: 'node', componentIndex }, checked)}
          />
        ))}
      </fieldset>
    </div>
  );
}
