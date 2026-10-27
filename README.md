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

The question-mark icon in the top bar opens component versions for every signed-in
user. The console includes its own version from `src/component.json` in the list,
even if the operator API is unavailable. Release builds stamp the exact Git tag
into that JSON with `jq` before `npm run build`; development builds use `0.0.0`.

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

### Other Commands

```bash
npm run test       # Run tests in watch mode
npm run test:run   # Run tests once (CI mode)
npm run lint       # Lint
npm run build      # Production build
```

## License

Licensed under the [Apache License 2.0](LICENSE).

