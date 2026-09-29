import { useEffect, useId, useState } from 'react';
import type { FocusEvent } from 'react';
import { graphRunsApi } from '../../services/graphRunsApi';
import { operatorApi } from '../../services/operatorApi';
import type { CreateGraphRunRequest, GraphScenarioNode, JobConfigResponse } from '../../types/api';
import { cacheSet, configCache } from '../scenarioConfigCache';

type ConfigurationRunType = 'scenario-runs' | 'graph-runs';
type RunConfiguration = CreateGraphRunRequest | JobConfigResponse;

const SENSITIVE_FIELD = /PASSWORD|SECRET|TOKEN|KEY|CREDENTIAL|AUTH/i;

function displayValue(key: string, value: string): string {
  return SENSITIVE_FIELD.test(key) ? '••••••••' : value;
}

function ConfigRows({ entries }: { entries: Record<string, string> }) {
  const sortedEntries = Object.entries(entries).sort(([left], [right]) => left.localeCompare(right));
  if (sortedEntries.length === 0) {
    return <p className="resiliency-history__config-empty">No values configured</p>;
  }

  return (
    <dl className="resiliency-history__config-rows">
      {sortedEntries.map(([key, value]) => (
        <div className="resiliency-history__config-row" key={key}>
          <dt>{key}</dt>
          <dd>{displayValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function TargetClusters({ clusters }: { clusters: Record<string, string[]> }) {
  const providers = Object.entries(clusters);
  if (providers.length === 0) return <p className="resiliency-history__config-empty">No target clusters recorded</p>;

  return (
    <ul className="resiliency-history__config-targets">
      {providers.map(([provider, names]) => (
        <li key={provider}>
          <strong>{provider}</strong>
          <span>{names.join(', ') || 'No clusters'}</span>
        </li>
      ))}
    </ul>
  );
}

function ScenarioConfiguration({ config }: { config: JobConfigResponse }) {
  const scenarioName = config.scenario?.name || config.scenarioName || 'Scenario run';
  return (
    <>
      <section className="resiliency-history__config-section">
        <h4>Scenario</h4>
        <dl className="resiliency-history__config-summary">
          <div><dt>Name</dt><dd>{scenarioName}</dd></div>
          {config.scenarioImage && <div><dt>Image</dt><dd>{config.scenarioImage}</dd></div>}
        </dl>
      </section>
      <section className="resiliency-history__config-section">
        <h4>Target clusters</h4>
        <TargetClusters clusters={config.targetClusters || {}} />
      </section>
      <section className="resiliency-history__config-section">
        <h4>Scenario variables</h4>
        <ConfigRows entries={config.environment || {}} />
      </section>
    </>
  );
}

function GraphNode({ nodeId, node }: { nodeId: string; node: GraphScenarioNode }) {
  const scenarioName = node.scenario?.name || node.name || node.image || 'Scenario';
  const volumes = Object.entries(node.volumes || {});
  return (
    <article className="resiliency-history__config-node">
      <div className="resiliency-history__config-node-heading">
        <strong>{nodeId}</strong>
        <span>{scenarioName}</span>
      </div>
      {node.depends_on && <p className="resiliency-history__config-dependency">Runs after <code>{node.depends_on}</code></p>}
      <ConfigRows entries={node.env || {}} />
      {volumes.length > 0 && (
        <div className="resiliency-history__config-volumes">
          <span className="resiliency-history__config-label">Volumes</span>
          {volumes.map(([name, path]) => (
            <span key={name}><code>{name}</code> → {displayValue(name, path)}</span>
          ))}
        </div>
      )}
    </article>
  );
}

function GraphConfiguration({ config }: { config: CreateGraphRunRequest }) {
  const nodes = Object.entries(config.graph || {});
  return (
    <>
      <section className="resiliency-history__config-section">
        <h4>Target clusters</h4>
        <TargetClusters clusters={config.targetClusters || {}} />
      </section>
      <section className="resiliency-history__config-section">
        <h4>Workflow nodes <span>{nodes.length}</span></h4>
        {nodes.length > 0 ? (
          <div className="resiliency-history__config-nodes">
            {nodes.map(([nodeId, node]) => <GraphNode key={nodeId} nodeId={nodeId} node={node} />)}
          </div>
        ) : <p className="resiliency-history__config-empty">No workflow nodes recorded</p>}
      </section>
      {(config.maxRetries !== undefined || config.cloudCredentialRef) && (
        <section className="resiliency-history__config-section">
          <h4>Workflow settings</h4>
          <dl className="resiliency-history__config-summary">
            {config.maxRetries !== undefined && <div><dt>Retries</dt><dd>{config.maxRetries}</dd></div>}
            {config.cloudCredentialRef && <div><dt>Cloud credential</dt><dd>Configured</dd></div>}
          </dl>
        </section>
      )}
    </>
  );
}

/** Shows the saved representative run configuration in a readable hover card. */
export function ResiliencyHistoryConfigurationTooltip({
  configurationGroupId,
  runType,
  runId,
}: {
  configurationGroupId: string;
  runType: ConfigurationRunType;
  runId: string;
}) {
  const tooltipId = useId();
  const cacheKey = `${runType === 'graph-runs' ? 'graph' : 'scenario'}:${runId}`;
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [config, setConfig] = useState<RunConfiguration | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    const cached = configCache.get(cacheKey);
    if (cached) {
      setConfig(cached);
      setError(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError(false);
    const request = runType === 'graph-runs'
      ? graphRunsApi.getGraphRunConfig(runId)
      : operatorApi.getScenarioRunConfig(runId);
    request.then((result) => {
      cacheSet(cacheKey, result);
      if (active) setConfig(result);
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [cacheKey, isOpen, runId, runType]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (!isFocused) setIsOpen(false);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setIsOpen(true);
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsFocused(false);
    if (!isHovered) setIsOpen(false);
  };

  const handleClick = () => setIsOpen(true);

  return (
    <div
      className="resiliency-history__config-anchor"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <button
        type="button"
        className="resiliency-history__config-badge"
        aria-label={`Show compared configuration ${configurationGroupId}`}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipId : undefined}
        onClick={handleClick}
      >
        {configurationGroupId}
      </button>
      {isOpen && (
        <div className="resiliency-history__config-tooltip" id={tooltipId} role="tooltip">
          <div className="resiliency-history__config-tooltip-header">
            <div>
              <span>Effective configuration</span>
              <code>{configurationGroupId}</code>
            </div>
            <span className="resiliency-history__config-type">
              {runType === 'graph-runs' ? 'Workflow' : 'Scenario'}
            </span>
          </div>
          {loading && <p className="resiliency-history__config-state">Loading configuration…</p>}
          {error && <p className="resiliency-history__config-state is-error">Configuration details are unavailable.</p>}
          {config && ('graph' in config
            ? <GraphConfiguration config={config} />
            : <ScenarioConfiguration config={config} />)}
        </div>
      )}
    </div>
  );
}
