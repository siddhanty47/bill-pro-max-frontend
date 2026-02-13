/**
 * @file Auth API for Keycloak token endpoint
 *
 * Configure in .env:
 * - VITE_KEYCLOAK_URL: Full Keycloak base URL for production (e.g. https://auth.billpromax.in).
 *   Leave empty in development to use the Vite /auth proxy.
 * - VITE_KEYCLOAK_REALM: Keycloak realm name
 * - VITE_KEYCLOAK_CLIENT_ID: Client ID (public or confidential)
 * - VITE_KEYCLOAK_CLIENT_SECRET: Client secret (for confidential clients only)
 */
import type { TokenResponse, LoginCredentials } from '../types';

/**
 * Keycloak base URL.
 * - Production: full URL from VITE_KEYCLOAK_URL (e.g. https://auth.billpromax.in)
 * - Development: empty string falls back to '/auth' which Vite proxies to localhost:8080
 */
const KEYCLOAK_BASE = import.meta.env.VITE_KEYCLOAK_URL || '/auth';
const KEYCLOAK_REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'billpromax';
const KEYCLOAK_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'billpromax-backend';
const KEYCLOAK_CLIENT_SECRET = import.meta.env.VITE_KEYCLOAK_CLIENT_SECRET || '';

/**
 * Build the OpenID Connect endpoint URL for the configured realm.
 * @param endpoint - The OIDC endpoint path (e.g. 'token', 'logout')
 * @returns Full URL to the Keycloak OIDC endpoint
 */
function getOidcUrl(endpoint: string): string {
  return `${KEYCLOAK_BASE}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/${endpoint}`;
}

/**
 * Get token from Keycloak using password grant.
 * @param credentials - Username and password
 * @returns Token response with access_token, refresh_token, etc.
 */
export async function login(credentials: LoginCredentials): Promise<TokenResponse> {
  const tokenUrl = getOidcUrl('token');

  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('client_id', KEYCLOAK_CLIENT_ID);
  params.append('username', credentials.username);
  params.append('password', credentials.password);
  
  // Add client secret for confidential clients
  if (KEYCLOAK_CLIENT_SECRET) {
    params.append('client_secret', KEYCLOAK_CLIENT_SECRET);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error_description || 'Login failed');
  }

  return response.json();
}

/**
 * Refresh an existing access token using the refresh token.
 * @param refreshToken - The refresh token from a previous login/refresh
 * @returns New token response with fresh access_token
 */
export async function refreshToken(refreshToken: string): Promise<TokenResponse> {
  const tokenUrl = getOidcUrl('token');

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('client_id', KEYCLOAK_CLIENT_ID);
  params.append('refresh_token', refreshToken);
  
  if (KEYCLOAK_CLIENT_SECRET) {
    params.append('client_secret', KEYCLOAK_CLIENT_SECRET);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  return response.json();
}

/**
 * Logout from Keycloak by invalidating the refresh token.
 * @param refreshToken - The refresh token to invalidate
 */
export async function logoutFromKeycloak(refreshToken: string): Promise<void> {
  const logoutUrl = getOidcUrl('logout');

  const params = new URLSearchParams();
  params.append('client_id', KEYCLOAK_CLIENT_ID);
  params.append('refresh_token', refreshToken);
  
  if (KEYCLOAK_CLIENT_SECRET) {
    params.append('client_secret', KEYCLOAK_CLIENT_SECRET);
  }

  await fetch(logoutUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
}
