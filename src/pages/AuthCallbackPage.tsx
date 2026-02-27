/**
 * @file Auth callback page - handles the OIDC redirect from Keycloak.
 * Extracts the authorization code and state from the URL,
 * exchanges the code for tokens, and redirects to the dashboard.
 *
 * Uses a module-level set to prevent duplicate token exchanges
 * caused by React 18 StrictMode double-mounting effects.
 */
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import styles from './LoginPage.module.css';

const processedCodes = new Set<string>();

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleCallback, error } = useAuth();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      navigate('/login', { replace: true });
      return;
    }

    if (!code || !state) {
      navigate('/login', { replace: true });
      return;
    }

    if (processedCodes.has(code)) return;
    processedCodes.add(code);

    handleCallback(code, state).then((result) => {
      if (result.success) {
        if (result.invitationToken) {
          navigate(`/invitations/${result.invitationToken}`, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        navigate('/login', { replace: true });
      }
    });
  }, [searchParams, handleCallback, navigate]);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1>BillProMax</h1>
        {error ? (
          <h2>{error}</h2>
        ) : (
          <h2>Completing sign in...</h2>
        )}
      </div>
    </div>
  );
}
