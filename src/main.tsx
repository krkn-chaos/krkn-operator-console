import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './AppRouter';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import '@patternfly/react-core/dist/styles/base.css';
import './index.css';

async function enablePreviewMode() {
  if (!import.meta.env.VITE_PREVIEW_MODE) return;

  localStorage.setItem('jwt_token', 'mock-preview-jwt-token');
  localStorage.setItem('user_email', 'admin@preview.local');
  localStorage.setItem('user_role', 'admin');
  localStorage.setItem('user_name', 'Preview');
  localStorage.setItem('user_surname', 'User');
  localStorage.setItem('user_organization', 'Krkn');
  localStorage.setItem(
    'token_expires_at',
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  );

  try {
    const { worker } = await import('./mocks/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    });
  } catch (e) {
    console.warn('MSW failed to start:', e);
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
});
