export interface ClusterComponent {
  name: string;
  disabled: boolean;
  labels?: Record<string, string>;
  [field: string]: unknown;
}

export interface PodComponent extends ClusterComponent {
  labels: Record<string, string>;
  containers: ClusterComponent[];
}

export interface NamespaceComponent extends ClusterComponent {
  pods: PodComponent[];
  services: ClusterComponent[];
  pvcs: ClusterComponent[];
  vmis?: ClusterComponent[];
}

export interface ClusterComponents {
  namespaces: NamespaceComponent[];
  nodes: ClusterComponent[];
  [field: string]: unknown;
}
