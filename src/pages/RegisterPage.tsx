/**
 * @file Register page with sign-up form and Google OAuth.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import styles from './LoginPage.module.css';

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get('invitation');
  const { register: registerUser, loginWithGoogle, isAuthenticated, isLoading, error } = useAuth();
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const onSubmit = async (data: RegisterForm) => {
    if (invitationToken) {
      localStorage.setItem('invitation_token', invitationToken);
    }
    const result = await registerUser(data.email, data.password, data.firstName, data.lastName);
    if (result.success) {
      if (result.needsConfirmation) {
        setSuccess(true);
      } else {
        const storedInvitation = localStorage.getItem('invitation_token');
        if (storedInvitation) {
          localStorage.removeItem('invitation_token');
          navigate(`/invitations/${storedInvitation}`, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    }
  };

  if (success) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <h1>BillProMax</h1>
          <h2>Check your email</h2>
          <div className={styles.success}>
            A confirmation link has been sent to your email. Please verify your email to continue.
          </div>
          <div className={styles.links}>
            <Link to="/login">Back to Sign In</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1>BillProMax</h1>
        <h2>Create Account</h2>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.field}>
            <input
              type="text"
              placeholder="First Name"
              autoComplete="given-name"
              {...register('firstName', { required: 'First name is required' })}
            />
            {errors.firstName && <span className={styles.fieldError}>{errors.firstName.message}</span>}
          </div>

          <div className={styles.field}>
            <input
              type="text"
              placeholder="Last Name"
              autoComplete="family-name"
              {...register('lastName', { required: 'Last name is required' })}
            />
            {errors.lastName && <span className={styles.fieldError}>{errors.lastName.message}</span>}
          </div>

          <div className={styles.field}>
            <input
              type="email"
              placeholder="Email"
              autoComplete="email"
              {...register('email', { required: 'Email is required' })}
            />
            {errors.email && <span className={styles.fieldError}>{errors.email.message}</span>}
          </div>

          <div className={styles.field}>
            <input
              type="password"
              placeholder="Password"
              autoComplete="new-password"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' },
              })}
            />
            {errors.password && <span className={styles.fieldError}>{errors.password.message}</span>}
          </div>

          <div className={styles.field}>
            <input
              type="password"
              placeholder="Confirm Password"
              autoComplete="new-password"
              {...register('confirmPassword', { required: 'Please confirm your password' })}
            />
            {errors.confirmPassword && (
              <span className={styles.fieldError}>{errors.confirmPassword.message}</span>
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <button
          type="button"
          className={`btn btn-secondary ${styles.googleBtn}`}
          onClick={() => loginWithGoogle(invitationToken ?? undefined)}
        >
          <svg className={styles.googleIcon} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign up with Google
        </button>

        <div className={styles.links}>
          <Link to={invitationToken ? `/login?invitation=${invitationToken}` : '/login'}>
            Already have an account? Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
