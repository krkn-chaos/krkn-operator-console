import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './AppRouter';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { authService } from './services/authService';
import '@patternfly/react-core/dist/styles/base.css';
import './index.css';

async function enablePreviewMode() {
  if (import.meta.env.VITE_PREVIEW_MODE !== 'true') return;

  authService.setSession({
    userId: 'admin@preview.local',
    role: 'admin',
    name: 'Preview',
    surname: 'User',
    organization: 'Krkn',
  }, 'mock-preview-jwt-token', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

  try {
    const { worker } = await import('./mocks/browser');
    await worker.start({
      onUnhandledRequest(request, print) {
        if (new URL(request.url).pathname.startsWith('/api/')) print.error();
      },
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    });
  } catch (e) {
    throw new Error(`Preview mock data could not start: ${e instanceof Error ? e.message : String(e)}`);
  }
}

enablePreviewMode().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/+$/, '')}>
        <AuthProvider>
          <AppProvider>
            <AppRouter />
          </AppProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
}).catch((error) => {
  console.error(error);
  const root = document.getElementById('root');
  if (root) {
    root.setAttribute('role', 'alert');
    root.textContent = 'Preview mock data could not start. Reload the page to try again.';
  }
});
