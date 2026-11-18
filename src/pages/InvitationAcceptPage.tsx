/**
 * @file Invitation accept/decline page.
 * Public route (with optional auth). Shows invitation details and
 * lets authenticated users accept or decline. Unauthenticated users
 * are prompted to sign in or create an account.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useAuth } from '../hooks/useAuth';
import {
  useVerifyInvitationQuery,
  useAcceptInvitationMutation,
  useDeclineInvitationMutation,
} from '../api/invitationApi';
import { baseApi, getErrorMessage } from '../api/baseApi';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Button, Notice, Spinner } from '../components/ui';
import styles from '../components/auth/AuthForm.module.css';

export function InvitationAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated } = useAuth();
  const [actionDone, setActionDone] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: verifyResponse,
    isLoading,
    error: verifyError,
  } = useVerifyInvitationQuery(token!, { skip: !token });

  const [acceptInvitation, { isLoading: accepting }] = useAcceptInvitationMutation();
  const [declineInvitation, { isLoading: declining }] = useDeclineInvitationMutation();

  const invitation = verifyResponse?.data;

  useEffect(() => {
    if (actionDone) {
      const timer = setTimeout(() => navigate('/', { replace: true }), 2000);
      return () => clearTimeout(timer);
    }
  }, [actionDone, navigate]);

  const handleAccept = async () => {
    if (!token) return;
    setActionError(null);
    try {
      await acceptInvitation(token).unwrap();

      // Invalidate business cache so the new business appears
      dispatch(baseApi.util.invalidateTags(['Business']));

      setActionDone(true);
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    setActionError(null);
    try {
      await declineInvitation(token).unwrap();
      setActionDone(true);
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  const handleSignIn = () => {
    navigate(`/login?invitation=${token}`);
  };

  const handleCreateAccount = () => {
    navigate(`/register?invitation=${token}`);
  };

  if (isLoading) {
    return (
      <AuthLayout title="Loading invitation…">
        <Spinner message="" />
      </AuthLayout>
    );
  }

  if (verifyError || !invitation) {
    return (
      <AuthLayout title="Invalid or expired invitation">
        <Button
          size="lg"
          variant="primary"
          className={styles.full}
          onClick={() => navigate('/login')}
        >
          Go to sign in
        </Button>
      </AuthLayout>
    );
  }

  if (actionDone) {
    return <AuthLayout title="Done. Redirecting…" />;
  }

  return (
    <AuthLayout title="You're invited">
      <p>
        You have been invited to join <strong>{invitation.businessName}</strong> as{' '}
        <strong>{invitation.role}</strong>.
      </p>

      <div className={styles.form}>
        {actionError && <Notice tone="danger">{actionError}</Notice>}
        {isAuthenticated ? (
          <>
            <Button
              size="lg"
              variant="primary"
              className={styles.full}
              onClick={handleAccept}
              loading={accepting}
              disabled={declining}
            >
              {accepting ? 'Accepting…' : 'Accept invitation'}
            </Button>
            <Button
              size="lg"
              className={styles.full}
              onClick={handleDecline}
              loading={declining}
              disabled={accepting}
            >
              {declining ? 'Declining…' : 'Decline'}
            </Button>
          </>
        ) : (
          <>
            <Button size="lg" variant="primary" className={styles.full} onClick={handleSignIn}>
              Sign in to accept
            </Button>
            <Button size="lg" className={styles.full} onClick={handleCreateAccount}>
              Create account to accept
            </Button>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
