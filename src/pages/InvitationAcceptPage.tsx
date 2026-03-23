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
import { useVerifyInvitationQuery, useAcceptInvitationMutation, useDeclineInvitationMutation } from '../api/invitationApi';
import { baseApi } from '../api/baseApi';
import styles from './LoginPage.module.css';
import invStyles from './InvitationAcceptPage.module.css';

export function InvitationAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated } = useAuth();
  const [actionDone, setActionDone] = useState(false);

  const { data: verifyResponse, isLoading, error: verifyError } = useVerifyInvitationQuery(
    token!,
    { skip: !token }
  );

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
    try {
      await acceptInvitation(token).unwrap();

      // Invalidate business cache so the new business appears
      dispatch(baseApi.util.invalidateTags(['Business']));

      setActionDone(true);
    } catch {
      // Error handled by RTK Query
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    try {
      await declineInvitation(token).unwrap();
      setActionDone(true);
    } catch {
      // Error handled by RTK Query
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
      <div className={styles.page}>
        <div className={styles.container}>
          <h1>BillProMax</h1>
          <h2>Loading invitation...</h2>
        </div>
      </div>
    );
  }

  if (verifyError || !invitation) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <h1>BillProMax</h1>
          <h2>Invalid or expired invitation</h2>
          <button className="btn btn-primary" onClick={() => navigate('/login')}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (actionDone) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <h1>BillProMax</h1>
          <h2>Done! Redirecting...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1>BillProMax</h1>
        <h2>You&apos;re invited!</h2>

        <div className={invStyles.centerText}>
          <p>
            You have been invited to join <strong>{invitation.businessName}</strong> as{' '}
            <strong>{invitation.role}</strong>.
          </p>
        </div>

        {isAuthenticated ? (
          <>
            <button
              className="btn btn-primary"
              onClick={handleAccept}
              disabled={accepting || declining}
            >
              {accepting ? 'Accepting...' : 'Accept Invitation'}
            </button>
            <button
              className={`btn btn-secondary ${invStyles.marginTop12}`}
              onClick={handleDecline}
              disabled={accepting || declining}
            >
              {declining ? 'Declining...' : 'Decline'}
            </button>
          </>
        ) : (
          <>
            <button
              className="btn btn-primary"
              onClick={handleSignIn}
            >
              Sign In to Accept
            </button>
            <button
              className={`btn btn-secondary ${invStyles.marginTop12}`}
              onClick={handleCreateAccount}
            >
              Create Account to Accept
            </button>
          </>
        )}
      </div>
    </div>
  );
}
