/**
 * Auth slice for managing authentication state.
 * With Supabase, the client manages tokens internally.
 * We store the access_token for API calls and user data from /auth/sync.
 */
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { User, AuthState } from '../types';

/**
 * Load auth state from localStorage
 */
function loadAuthState(): Partial<AuthState> {
  try {
    const token = localStorage.getItem('token');
    const currentBusinessId = localStorage.getItem('currentBusinessId');
    const userJson = localStorage.getItem('user');
    if (token && userJson) {
      const user = JSON.parse(userJson) as User;
      return {
        token,
        user,
        isAuthenticated: true,
        currentBusinessId,
      };
    }
    if (token) {
      return { token, currentBusinessId };
    }
    return { currentBusinessId };
  } catch {
    // Ignore errors
  }
  return {};
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  currentBusinessId: null,
  ...loadAuthState(),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ token: string }>
    ) => {
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.error = null;
      localStorage.setItem('token', action.payload.token);
    },

    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      localStorage.setItem('user', JSON.stringify(action.payload));
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      state.currentBusinessId = null;

      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('currentBusinessId');
    },

    setCurrentBusiness: (state, action: PayloadAction<string>) => {
      state.currentBusinessId = action.payload;
      localStorage.setItem('currentBusinessId', action.payload);
    },
  },
});

export const { setCredentials, setUser, setLoading, setError, logout, setCurrentBusiness } = authSlice.actions;
export default authSlice.reducer;
