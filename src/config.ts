// Application configuration

export const config = {
  // API base URL - '/api/v1' uses nginx proxy in production, vite proxy in dev
  apiBaseUrl: import.meta.env.VITE_API_URL || '/api/v1',

  // Polling configuration
  pollInterval: parseInt(import.meta.env.VITE_POLL_INTERVAL || '3000'), // 3 seconds
  pollTimeout: parseInt(import.meta.env.VITE_POLL_TIMEOUT || '60000'),  // 60 seconds

  // Feature flags
  showNodes: import.meta.env.VITE_SHOW_NODES === 'true',
  debugMode: import.meta.env.VITE_DEBUG_MODE === 'true',
};
