# krkn-operator-console

![test](https://github.com/krkn-chaos/krkn-operator-console/actions/workflows/test.yml/badge.svg)
![pr-checks](https://github.com/krkn-chaos/krkn-operator-console/actions/workflows/pr-checks.yml/badge.svg)
![coverage](https://krkn-chaos.github.io/krkn-lib-docs/coverage_badge_krkn-operator-console.svg)

Web console for krkn-operator. React-based user interface using PatternFly design system to manage chaos engineering scenarios, select target clusters, and monitor chaos orchestration workflows.

## Documentation

📖 **[Official Documentation](https://krkn-chaos.dev/docs/krkn-operator)**

## Running Locally

### Prerequisites

- Node.js 18+
- npm
- krkn-operator running at `http://localhost:8080` (see [krkn-operator README](https://github.com/krkn-chaos/krkn-operator#running-locally))

### Setup

```bash
cd krkn-operator-console

# Install dependencies (first time or after package.json changes)
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Vite proxies all `/api` requests to `http://localhost:8080`, so the console talks directly to your locally running operator with no extra configuration.

### Environment variables

Copy `.env.example` to `.env.local` to override defaults:

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `/api/v1` | API base path |
| `VITE_POLL_INTERVAL` | `3000` | Status poll interval (ms) |
| `VITE_POLL_TIMEOUT` | `60000` | Poll timeout (ms) |
| `VITE_DEBUG_MODE` | `false` | Enable debug logging |

### Other commands

```bash
npm run test          # Run tests in watch mode
npm run test:run      # Run tests once (CI mode)
npm run lint          # Lint
npm run build         # Production build
```

## License

Copyright 2025 krkn-chaos

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.
