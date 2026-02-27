/**
 * @file Auth hook for OIDC-based authentication
 * Provides login (redirect to Keycloak), callback handling, token refresh, and logout.
 */
import { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setCredentials, setLoading, setError, logout as logoutAction } from '../store/authSlice';
import {
  initiateLogin,
  exchangeCode,
  validateOAuthState,
  logoutFromKeycloak,
  getStoredInvitationToken,
} from '../api/authApi';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * Hook for authentication operations using Keycloak OIDC redirect flow.
 */
export function useAuth() {
  const dispatch = useDispatch();
  const { user, token, idToken, isAuthenticated, isLoading, error } = useSelector(
    (state: RootState) => state.auth
  );

  /**
   * Redirect to Keycloak login page.
   */
  const login = useCallback((options?: { registrationHint?: boolean; invitationToken?: string }) => {
    initiateLogin(options);
  }, []);

  /**
   * Handle the OAuth callback after Keycloak redirects back.
   * Validates state, exchanges code for tokens, syncs with backend.
   * @returns Object with success flag and optional invitation token
   */
  const handleCallback = useCallback(
    async (code: string, state: string): Promise<{ success: boolean; invitationToken?: string | null }> => {
      dispatch(setLoading(true));
      dispatch(setError(null));

      try {
        if (!validateOAuthState(state)) {
          throw new Error('Invalid OAuth state. Please try logging in again.');
        }

        const tokenResponse = await exchangeCode(code);

        dispatch(
          setCredentials({
            token: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            idToken: tokenResponse.id_token,
          })
        );

        try {
          await fetch(`${API_BASE}/auth/sync`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`,
              'Content-Type': 'application/json',
            },
          });
        } catch {
          // Non-fatal: user sync can fail gracefully
        }

        const invitationToken = getStoredInvitationToken();
        return { success: true, invitationToken };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        dispatch(setError(message));
        return { success: false };
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch]
  );

  /**
   * Logout: clear local state and redirect to Keycloak logout.
   */
  const logout = useCallback(() => {
    const currentIdToken = idToken;
    dispatch(logoutAction());
    logoutFromKeycloak(currentIdToken ?? undefined);
  }, [dispatch, idToken]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    handleCallback,
    logout,
  };
}
