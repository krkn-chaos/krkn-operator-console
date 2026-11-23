/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const proxyTarget = loadEnv(mode, process.cwd(), '').VITE_API_PROXY_TARGET || 'http://localhost:8080';
  const targetUrl = new URL(proxyTarget);
  const localTarget = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(targetUrl.hostname);

  return {
    base: process.env.VITE_BASE_URL || '/',
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: proxyTarget,
          // Local development preserves the browser Host. A remote route needs
          // its own Host and Origin for virtual-host routing and socket checks.
          changeOrigin: !localTarget,
          configure: localTarget ? undefined : (proxy) => {
            proxy.on('proxyReq', (request) => {
              if (request.getHeader('origin')) request.setHeader('origin', targetUrl.origin);
            });
            proxy.on('proxyReqWs', (request) => {
              if (request.getHeader('origin')) request.setHeader('origin', targetUrl.origin);
            });
          },
          ws: true, // Enable WebSocket proxying
          // Pass full path including /api/v1 to backend (no rewrite)
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      // Compact, readable test output - 'dot' for CI, 'verbose' for local debugging
      reporters: process.env.CI ? ['dot', 'json'] : ['verbose'],
      // Output JSON summary for programmatic parsing
      outputFile: {
        json: './test-results.json',
      },
      // Hide passing tests, show only failures and summary
      hideSkippedTests: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'json-summary', 'html'],
        exclude: [
          'node_modules/',
          'src/test/',
          '**/*.test.{ts,tsx}',
          '**/__tests__/',
        ],
      },
    },
  };
});
