/**
 * Auth slice for managing authentication state
 */
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { User, AuthState } from '../types';

/**
 * Parse JWT token to extract user info
 */
function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Extract user from Keycloak token payload
 */
function extractUserFromToken(token: string): User | null {
  const payload = parseJwt(token);
  if (!payload) return null;

  return {
    id: (payload.sub as string) || '',
    username: (payload.preferred_username as string) || '',
    email: (payload.email as string) || '',
    name: (payload.name as string) || '',
    firstName: (payload.given_name as string) || '',
    lastName: (payload.family_name as string) || '',
    roles: ((payload.realm_access as { roles?: string[] })?.roles || []),
    businessIds: (payload.businessIds as string[]) || [],
  };
}

/**
 * Load auth state from localStorage
 */
function loadAuthState(): Partial<AuthState> {
  try {
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    const idToken = localStorage.getItem('idToken');
    const currentBusinessId = localStorage.getItem('currentBusinessId');
    if (token) {
      const user = extractUserFromToken(token);
      return {
        token,
        refreshToken,
        idToken,
        user,
        isAuthenticated: !!user,
        currentBusinessId,
      };
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
  refreshToken: null,
  idToken: null,
  isAuthenticated: false,
  isLoading: false,
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
      action: PayloadAction<{ token: string; refreshToken: string; idToken?: string }>
    ) => {
      const { token, refreshToken, idToken } = action.payload;
      state.token = token;
      state.refreshToken = refreshToken;
      if (idToken) {
        state.idToken = idToken;
        localStorage.setItem('idToken', idToken);
      }
      state.user = extractUserFromToken(token);
      state.isAuthenticated = true;
      state.error = null;
      
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
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
      state.refreshToken = null;
      state.idToken = null;
      state.isAuthenticated = false;
      state.error = null;
      state.currentBusinessId = null;
      
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('idToken');
      localStorage.removeItem('currentBusinessId');

      sessionStorage.removeItem('pkce_code_verifier');
      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('invitation_token');
    },

    setCurrentBusiness: (state, action: PayloadAction<string>) => {
      state.currentBusinessId = action.payload;
      // Also persist to localStorage
      localStorage.setItem('currentBusinessId', action.payload);
    },
  },
});

export const { setCredentials, setLoading, setError, logout, setCurrentBusiness } = authSlice.actions;
export default authSlice.reducer;
