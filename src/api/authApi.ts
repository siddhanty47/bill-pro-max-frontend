/**
 * @file Auth API for Keycloak OIDC Authorization Code + PKCE flow
 *
 * Configure in .env:
 * - VITE_KEYCLOAK_URL: Full Keycloak base URL for production (e.g. https://auth.billpromax.in).
 *   Leave empty in development to use the Vite /auth proxy.
 * - VITE_KEYCLOAK_REALM: Keycloak realm name
 * - VITE_KEYCLOAK_CLIENT_ID: Client ID (public client for SPA)
 */

import type { TokenResponse } from '../types';

/**
 * Keycloak base URL.
 * - Production: full URL from VITE_KEYCLOAK_URL (e.g. https://auth.billpromax.in)
 * - Development: defaults to localhost:8080
 */
const KEYCLOAK_BASE = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'billpromax';
const KEYCLOAK_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'billpromax-frontend';

const REDIRECT_URI = `${window.location.origin}/auth/callback`;
const POST_LOGOUT_REDIRECT_URI = window.location.origin;

/**
 * Build the OpenID Connect endpoint URL for the configured realm.
 * @param endpoint - The OIDC endpoint path (e.g. 'token', 'logout', 'auth')
 * @returns Full URL to the Keycloak OIDC endpoint
 */
function getOidcUrl(endpoint: string): string {
  return `${KEYCLOAK_BASE}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/${endpoint}`;
}

/**
 * Generate a cryptographically random string for PKCE code verifier.
 * @param length - Length of the random string (default 64)
 * @returns Random string suitable for PKCE
 */
function generateRandomString(length = 64): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(36).padStart(2, '0'))
    .join('')
    .substring(0, length);
}

/**
 * Generate a SHA-256 code challenge from a code verifier (PKCE S256 method).
 * @param verifier - The PKCE code verifier string
 * @returns Base64url-encoded SHA-256 hash
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Initiate OIDC login by redirecting to Keycloak's authorization endpoint.
 * Generates PKCE code verifier/challenge and stores verifier in sessionStorage.
 * @param options - Optional parameters for the login redirect
 * @param options.registrationHint - If true, redirects to Keycloak's registration page instead
 * @param options.invitationToken - Invitation token to preserve across the auth flow
 */
export async function initiateLogin(options?: {
  registrationHint?: boolean;
  invitationToken?: string;
}): Promise<void> {
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(32);

  sessionStorage.setItem('pkce_code_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', state);

  if (options?.invitationToken) {
    sessionStorage.setItem('invitation_token', options.invitationToken);
  }

  const params = new URLSearchParams({
    client_id: KEYCLOAK_CLIENT_ID,
    response_type: 'code',
    scope: 'openid profile email',
    redirect_uri: REDIRECT_URI,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const endpoint = options?.registrationHint ? 'registrations' : 'auth';
  window.location.href = `${getOidcUrl(endpoint)}?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens using PKCE.
 * Retrieves the code verifier from sessionStorage.
 * @param code - Authorization code from the callback URL
 * @returns Token response with access_token, refresh_token, etc.
 * @throws Error if code verifier is missing or token exchange fails
 */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
  if (!codeVerifier) {
    throw new Error('PKCE code verifier not found. Please try logging in again.');
  }

  const tokenUrl = getOidcUrl('token');
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: KEYCLOAK_CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  sessionStorage.removeItem('pkce_code_verifier');
  sessionStorage.removeItem('oauth_state');

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error_description || 'Token exchange failed');
  }

  return response.json();
}

/**
 * Refresh an existing access token using the refresh token.
 * @param currentRefreshToken - The refresh token from a previous login/refresh
 * @returns New token response with fresh access_token
 */
export async function refreshToken(currentRefreshToken: string): Promise<TokenResponse> {
  const tokenUrl = getOidcUrl('token');

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: KEYCLOAK_CLIENT_ID,
    refresh_token: currentRefreshToken,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  return response.json();
}

/**
 * Logout from Keycloak by redirecting to the OIDC logout endpoint.
 * This ends the Keycloak session and redirects back to the app.
 * @param idTokenHint - Optional ID token to pass as a hint for logout
 */
export function logoutFromKeycloak(idTokenHint?: string): void {
  const params = new URLSearchParams({
    client_id: KEYCLOAK_CLIENT_ID,
    post_logout_redirect_uri: POST_LOGOUT_REDIRECT_URI,
  });

  if (idTokenHint) {
    params.append('id_token_hint', idTokenHint);
  }

  window.location.href = `${getOidcUrl('logout')}?${params.toString()}`;
}

/**
 * Validate the OAuth state parameter from the callback URL.
 * @param returnedState - The state parameter from the callback URL
 * @returns True if the state matches the stored value
 */
export function validateOAuthState(returnedState: string): boolean {
  const storedState = sessionStorage.getItem('oauth_state');
  return storedState === returnedState;
}

/**
 * Get any stored invitation token from the auth flow.
 * @returns The invitation token if present, or null
 */
export function getStoredInvitationToken(): string | null {
  const token = sessionStorage.getItem('invitation_token');
  sessionStorage.removeItem('invitation_token');
  return token;
}
