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

Cancel remains in the action row on each target, configuration, and review step.

The run list, creation wizard, and result views expand to the available page width.

Baseline appears first among generation-0 scenario results and in ascending scenario-ID order; its row opens standard result details.

The wizard's Components section provides Select all and Disable all controls for
namespaces. Each namespace toggle sits beside its accordion title and applies
the disabled state to all of that namespace's descendants.

Run lists and details read persisted operator resources and typed artifact
results. While a visible list or detail contains an active run, the console
refreshes status and partial results on a non-overlapping 10-second timer; it
stops when runs become terminal or the page is hidden. A `503
artifact_updating` preserves the last good result and retries on the next active
poll. The result-uploader sidecar commits artifacts every 10 seconds.

Scenario child-job logs use
`/api/v2/ws/scenarios/run/{scenarioRunName}/jobs/{jobID}/logs`; orchestrator
logs use `/api/v2/ws/krkn-ai/runs/{name}/logs`. Both authenticate the WebSocket
handshake with `Sec-WebSocket-Protocol: access_token.<JWT>`. No status
WebSocket is used for Krkn-AI runs.

### Temporary GitHub Pages preview

`.github/workflows/deploy-main-preview.yml` builds preview mode from `main` and publishes `dist/` to the `gh-pages` branch. In repository **Settings → Pages**, select **Deploy from a branch**, then choose `gh-pages` and `/ (root)`. The preview is available at `https://<owner>.github.io/<repository>/`; direct SPA routes are handled by the generated `404.html`.

The workflow also supports manual runs from the Actions tab. Remove the workflow when sharing is complete; disable Pages as well if PR previews are no longer needed.

### Other Commands

```bash
npm run test       # Run tests in watch mode
npm run test:run   # Run tests once (CI mode)
npm run lint       # Lint
npm run build      # Production build
```

## License

Licensed under the [Apache License 2.0](LICENSE).

