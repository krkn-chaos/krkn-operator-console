/**
 * Main router for krkn-operator-console
 *
 * Defines all routes and handles authentication flow:
 * - Public routes: /login, /register, /
 * - Protected routes: /app (main application)
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { RegistrationCheck } from './pages/RegistrationCheck';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ProtectedRoute } from './components/ProtectedRoute';
import App from './App';

export function AppRouter() {
  return (
    <Routes>
      {/* Root - check registration status */}
      <Route path="/" element={<RegistrationCheck />} />

      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected routes */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        }
      />

      {/* Catch all - redirect to root */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
