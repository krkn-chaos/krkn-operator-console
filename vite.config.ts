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
});
