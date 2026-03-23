/**
 * @file Auth hook using Supabase Auth
 * Provides login, register, Google OAuth, password reset, and logout.
 */
import { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  setCredentials,
  setUser,
  setLoading,
  setError,
  logout as logoutAction,
} from '../store/authSlice';
import {
  signIn,
  signUp,
  signInWithGoogle,
  resetPassword,
  signOut,
} from '../api/authApi';
import type { User } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * Sync user with backend and update Redux state
 */
async function syncWithBackend(token: string): Promise<User | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.ok) {
      const json = await res.json();
      return json.data?.user ?? null;
    }
  } catch {
    // Non-fatal
  }
  return null;
}

export function useAuth() {
  const dispatch = useDispatch();
  const { user, token, isAuthenticated, isLoading, error } = useSelector(
    (state: RootState) => state.auth
  );

  /**
   * Login with email and password
   */
  const login = useCallback(
    async (email: string, password: string) => {
      dispatch(setLoading(true));
      dispatch(setError(null));
      try {
        const data = await signIn(email, password);
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error('No session returned');

        dispatch(setCredentials({ token: accessToken }));

        const syncedUser = await syncWithBackend(accessToken);
        if (syncedUser) {
          dispatch(setUser(syncedUser));
        }

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        dispatch(setError(message));
        return { success: false, error: message };
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch]
  );

  /**
   * Register with email and password
   */
  const register = useCallback(
    async (email: string, password: string, firstName: string, lastName: string) => {
      dispatch(setLoading(true));
      dispatch(setError(null));
      try {
        const data = await signUp(email, password, firstName, lastName);
        const accessToken = data.session?.access_token;
        if (!accessToken) {
          // Email confirmation required — user needs to verify before login
          return { success: true, needsConfirmation: true };
        }

        dispatch(setCredentials({ token: accessToken }));

        const syncedUser = await syncWithBackend(accessToken);
        if (syncedUser) {
          dispatch(setUser(syncedUser));
        }

        return { success: true, needsConfirmation: false };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        dispatch(setError(message));
        return { success: false, error: message };
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch]
  );

  /**
   * Login with Google (redirect-based)
   */
  const loginWithGoogle = useCallback(
    async (invitationToken?: string) => {
      if (invitationToken) {
        localStorage.setItem('invitation_token', invitationToken);
      }
      try {
        await signInWithGoogle();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Google login failed';
        dispatch(setError(message));
      }
    },
    [dispatch]
  );

  /**
   * Send password reset email
   */
  const forgotPassword = useCallback(
    async (email: string) => {
      dispatch(setLoading(true));
      dispatch(setError(null));
      try {
        await resetPassword(email);
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Password reset failed';
        dispatch(setError(message));
        return { success: false, error: message };
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch]
  );

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    try {
      await signOut();
    } catch {
      // Ignore sign out errors
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
    register,
    loginWithGoogle,
    forgotPassword,
    logout,
  };
}
