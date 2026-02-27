/**
 * @file Login page - redirects to Keycloak for authentication.
 * Provides branded "Sign In" and "Create Account" buttons that
 * redirect to Keycloak's login/registration pages respectively.
 */
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1>BillProMax</h1>
        <h2>Scaffolding Rental Management</h2>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => login()}
        >
          Sign In
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => login({ registrationHint: true })}
        >
          Create Account
        </button>

        <div className={styles.footer}>
          <p>Sign in with your email or Google account</p>
        </div>
      </div>
    </div>
  );
}
