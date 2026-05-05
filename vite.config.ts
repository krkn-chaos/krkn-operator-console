/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
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
});
