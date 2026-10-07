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

Enable `krknAI.enabled: true` in the operator chart and deploy matching
Krkn-AI service, orchestrator, and operator images.

The wizard configures discovered components and settings, with an editable YAML
preview before creation. VMI controls appear only when discovery finds VMIs.
Run details include searchable scenarios, fitness and health charts, live logs,
and downloadable ZIPs with complete results.
Run metadata appears before summaries finish. Summaries and scenario pages load
independently; the operator filters, sorts, and paginates the complete result and
child-job index. The console fetches only the requested page and loads scenario
details when selected.

### Mock development and PR previews

```bash
npm run dev:preview       # Run with mock HTTP APIs and WebSocket streams
npm run build:preview     # Build a backend-free preview
```

Preview mode uses mock APIs and logs without a backend, including workflow replay
and Krkn-AI run creation and results. Data is simulated and resets on reload.
Normal builds do not enable mocks.

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

