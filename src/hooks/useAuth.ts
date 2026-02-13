/**
 * Auth hook for authentication utilities
 */
import { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setCredentials, setLoading, setError, logout as logoutAction } from '../store/authSlice';
import { login as loginApi, logoutFromKeycloak } from '../api/authApi';
import type { LoginCredentials } from '../types';

/**
 * Hook for authentication operations
 */
export function useAuth() {
  const dispatch = useDispatch();
  const { user, token, isAuthenticated, isLoading, error } = useSelector(
    (state: RootState) => state.auth
  );

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      dispatch(setLoading(true));
      dispatch(setError(null));

      try {
        const response = await loginApi(credentials);
        dispatch(
          setCredentials({
            token: response.access_token,
            refreshToken: response.refresh_token,
          })
        );
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        dispatch(setError(message));
        return false;
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch]
  );

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        await logoutFromKeycloak(refreshToken);
      } catch {
        // Ignore logout errors
      }
    }
    dispatch(logoutAction());
  }, [dispatch]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
  };
}
