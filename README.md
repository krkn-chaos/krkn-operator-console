# krkn-operator-console

![test](https://github.com/krkn-chaos/krkn-operator-console/actions/workflows/test.yml/badge.svg)
![pr-checks](https://github.com/krkn-chaos/krkn-operator-console/actions/workflows/pr-checks.yml/badge.svg)
![coverage](https://krkn-chaos.github.io/krkn-lib-docs/coverage_badge_krkn-operator-console.svg)


**Web console and Chaos Studio for [Krkn Operator](https://github.com/krkn-chaos/krkn-operator).**

Krkn Operator Console is the web interface for the Krkn Operator platform, providing a graphical experience to manage chaos engineering across Kubernetes and OpenShift environments.

It enables users to compose and execute chaos workflows, manage target clusters, and monitor experiment execution from a centralized interface.

📖 **[Official Documentation](https://krkn-chaos.gateway.scarf.sh/krkn-operator/docs?source=github-console)**

## Development

### Prerequisites

* Node.js 18+
* npm
* [krkn-operator](https://github.com/krkn-chaos/krkn-operator) running at `http://localhost:8080`

### Setup

```bash
cd krkn-operator-console

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open `http://localhost:3000`.

Vite proxies `/api` requests to `http://localhost:8080`, allowing the console to communicate directly with the locally running operator.

### Environment Variables

Copy `.env.example` to `.env.local` to override the defaults:

```bash
cp .env.example .env.local
```

| Variable             | Default   | Description               |
| -------------------- | --------- | ------------------------- |
| `VITE_API_URL`       | `/api/v1` | API base path             |
| `VITE_POLL_INTERVAL` | `3000`    | Status poll interval (ms) |
| `VITE_POLL_TIMEOUT`  | `60000`   | Poll timeout (ms)         |
| `VITE_DEBUG_MODE`    | `false`   | Enable debug logging      |

### Krkn-AI run integration

The Krkn-AI console uses the authenticated operator API; it no longer creates
client-only runs or synthetic discovery data. Enable `krknAI.enabled: true` in
the operator chart and deploy matching Krkn-AI service, orchestrator, and
operator images before using the workflow.

The wizard creates the legacy operator target request, waits for completion,
loads permission-filtered clusters, and requests Krkn-AI discovery without
sending kubeconfig or service credentials to the browser. It edits the returned
YAML, validates it against the Krkn-AI schema, saves a target-bound config, and
launches only after the operator returns a `201` `KrknAIRun`.

The discovery step lists namespaces from the selected cluster for exploratory testing. Selected names are escaped and joined into Krkn AI's comma-separated namespace pattern; pod and node label-key filters are not exposed.

Genetic settings use the Krkn-AI model defaults and grouped descriptions. The algorithm is fixed to `genetic`; population injection values remain at their model defaults, and tournament size appears only for tournament selection. A legacy single fitness query is migrated into the fitness item list.

Cancel remains in the action row on each target, configuration, and review step.

The run list and result views expand to the available page width. Run creation
uses a centered 72rem layout with bounded settings inputs and wider PromQL/URL
rows that stack on small screens. Fitness items and health checks are summarized
in tables with Add/Edit modals; changes apply only on Save, and Cancel/Escape
discard them. Removal requires confirmation, and the last fitness item is protected.
Include score components are configured in Run Settings. Filename overrides are
omitted from generated YAML so Krkn-AI supplies its output defaults.
Run metadata uses aligned label/value rows grouped into Run, Progress, and
Fitness panels, with the normalized fitness scale shown once. The panels stack
on smaller screens without hiding values or calculation status. The run phase
appears as Status in the Run panel rather than beside the page title.

Baseline appears first among generation-0 scenario results and in ascending scenario-ID order; its row opens standard result details.

Krkn-AI run and scenario tables provide explicit **View run** and **View details**
actions alongside row navigation. In Jobs, scenarios triggered by Krkn-AI show
a **Krkn-AI · run name** link that opens the parent run. The console resolves
origins using the operator's `krkn.dev/ai-run` label selector (one lookup per
authorized AI run when the displayed scenario jobs change); no operator API
change is required. Lookup failures show a retry action, and unavailable parent
runs show an error instead of opening an unrelated run.

The wizard's Components section provides Select all and Disable all controls for
namespaces. Each namespace toggle sits beside its accordion title and applies
the disabled state to all of that namespace's descendants.

Run lists and details read persisted operator resources and typed artifact
results. While a visible list or detail contains an active run, the console
refreshes status and partial results on a non-overlapping 10-second timer; it
stops when runs become terminal or the page is hidden. A `503
artifact_updating` preserves the last good result and retries on the next active
poll. The result-uploader sidecar commits artifacts every 10 seconds.

Krkn-AI fitness totals are withheld until the entire generation is complete and
the scenario result is finalized. Final totals and generation best/average
scores use the 0–100 scale; per-item normalized scores remain on the 0–1 scale,
with raw scores also shown. Scenario details include the run-specific PromQL
query and query type for each item; old artifacts without persisted queries do
not display a fabricated query.
Run summaries and scenario results show calculation indicators for unfinished
active generations. Completed generation scores stay visible while later
generations run; an open scenario modal refreshes when its generation completes.
Failed or cancelled incomplete results stop calculating and remain unfinalized.
Initial run and scenario detail requests show loading indicators before rendering
their content; later refreshes retain committed results. Scenario metadata shares
the run's metric panels. Scenario parameters and the PromQL-first fitness
breakdown precede scenario logs and health charts; the command and raw health
record table are not displayed. Fitness progression follows scenario executions.

Run details and list actions offer **Download results ZIP** via
`GET /api/v1/krkn-ai/runs/{name}/results/download`. The operator authorizes target
access and archives every file in the committed manifest, checking its size and
SHA-256 before serving the ZIP. Active runs download their last committed
snapshot; uploads in progress can return `503 artifact_updating`. Deploy matching
operator and console versions to use this endpoint.

Health-check response-time charts leave gaps for `-1`, missing, or nonfinite
latency measurements and resume when measurements return; there are no crosses.
HTTP errors with measured latency remain on the line, while failure counts in
the legend and red outcome cells distinguish failed checks from missing responses.
The latency axis scales to measured values rather than a fixed one-second floor.
Outcome cells are adjacent and ordered per service, without a heatmap time axis.
Every record is retained, with readable minimum cell sizes and scrolling for dense
rows. Hover or keyboard focus reveals timestamp, status, outcome, latency, and error.

Scenario child-job logs use
`/api/v2/ws/scenarios/run/{scenarioRunName}/jobs/{jobID}/logs`; orchestrator
logs use `/api/v2/ws/krkn-ai/runs/{name}/logs`. Both authenticate the WebSocket
handshake with `Sec-WebSocket-Protocol: access_token.<JWT>`. No status
WebSocket is used for Krkn-AI runs.
The orchestrator log's **Follow** checkbox enables auto-scrolling, matching the
scenario log control; unchecking it leaves the live stream connected.
While active, orchestrator logs stream with a 200-line initial tail. After a run
finishes, the console reconnects without a tail limit to fetch the complete
available pod log from its beginning.

### Mock development and PR previews

```bash
npm run dev:preview       # Run with mock HTTP APIs and WebSocket streams
npm run build:preview     # Build a backend-free preview
```

Preview mode requires `VITE_PREVIEW_MODE=true`; normal builds do not start MSW.
Unhandled preview API requests fail instead of reaching a real backend, and a
mock-startup failure blocks the app with a reload notice.

Krkn-AI includes completed and running examples, namespace/component discovery,
editable configurations, validation/save/launch, accelerated generation progress,
scenario results and health charts, full/streaming logs, linked child jobs, and
valid ZIP downloads. Seeded measurements are sanitized Robot Shop examples;
aggregate and normalized scores are simulations. No credentials, private
endpoints, original cluster selectors, or original run logs are published.
Created preview runs and saved configs live only in memory and reset on reload.

`.github/workflows/deploy-preview.yml` builds previews for opened, updated, and
reopened PRs. `.github/workflows/deploy-preview-publish.yml` publishes the artifact
to `gh-pages` and updates the PR's preview comment at:

`https://<owner>.github.io/<repository>/pr-preview/pr-<number>/`

The build sets `VITE_BASE_URL` to that PR-specific path so assets, navigation, and
the service worker remain scoped to the preview. Updating the PR branch triggers
publication; local uncommitted changes do not update the hosted preview.

### Other Commands

```bash
npm run test       # Run tests in watch mode
npm run test:run   # Run tests once (CI mode)
npm run lint       # Lint
npm run build      # Production build
```

## License

Licensed under the [Apache License 2.0](LICENSE).

