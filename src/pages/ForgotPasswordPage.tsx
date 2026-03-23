/**
 * @file Forgot password page - sends password reset email via Supabase.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../hooks/useAuth';
import styles from './LoginPage.module.css';

interface ForgotPasswordForm {
  email: string;
}

export function ForgotPasswordPage() {
  const { forgotPassword, isLoading, error } = useAuth();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>();

  const onSubmit = async (data: ForgotPasswordForm) => {
    const result = await forgotPassword(data.email);
    if (result.success) {
      setSubmitted(true);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1>BillProMax</h1>
        <h2>Reset Password</h2>

        {submitted ? (
          <>
            <div className={styles.success}>
              If an account exists with that email, a reset link has been sent.
            </div>
            <div className={styles.links}>
              <Link to="/login">Back to Sign In</Link>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
              <div className={styles.field}>
                <input
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  {...register('email', { required: 'Email is required' })}
                />
                {errors.email && <span className={styles.fieldError}>{errors.email.message}</span>}
              </div>

              {error && <div className={styles.error}>{error}</div>}

              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <div className={styles.links}>
              <Link to="/login">Back to Sign In</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
