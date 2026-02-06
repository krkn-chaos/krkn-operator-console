import { useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import type { NotificationVariant } from '../types/api';

export function useNotifications() {
  const { dispatch } = useAppContext();

  const showNotification = useCallback(
    (variant: NotificationVariant, title: string, message?: string, autoDismiss: number = 3000) => {
      const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: {
          notification: {
            id,
            variant,
            title,
            message,
          },
        },
      });

      // Auto-dismiss after specified time (default 3 seconds)
      if (autoDismiss > 0) {
        setTimeout(() => {
          dispatch({
            type: 'HIDE_NOTIFICATION',
            payload: { id },
          });
        }, autoDismiss);
      }

      return id;
    },
    [dispatch]
  );

  const showSuccess = useCallback(
    (title: string, message?: string, autoDismiss?: number) => {
      return showNotification('success', title, message, autoDismiss);
    },
    [showNotification]
  );

  const showError = useCallback(
    (title: string, message?: string, autoDismiss?: number) => {
      return showNotification('danger', title, message, autoDismiss);
    },
    [showNotification]
  );

  const showWarning = useCallback(
    (title: string, message?: string, autoDismiss?: number) => {
      return showNotification('warning', title, message, autoDismiss);
    },
    [showNotification]
  );

  const showInfo = useCallback(
    (title: string, message?: string, autoDismiss?: number) => {
      return showNotification('info', title, message, autoDismiss);
    },
    [showNotification]
  );

  const hideNotification = useCallback(
    (id: string) => {
      dispatch({
        type: 'HIDE_NOTIFICATION',
        payload: { id },
      });
    },
    [dispatch]
  );

  return {
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    hideNotification,
  };
}
