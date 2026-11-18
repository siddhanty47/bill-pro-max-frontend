/**
 * @file Forgot password page - sends password reset email via Supabase.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Button, Field, Input, Notice } from '../components/ui';
import styles from '../components/auth/AuthForm.module.css';

const forgotSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
});

type ForgotPasswordForm = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage() {
  const { forgotPassword, isLoading, error } = useAuth();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (data: ForgotPasswordForm) => {
    const result = await forgotPassword(data.email);
    if (result.success) {
      setSubmitted(true);
    }
  };

  return (
    <AuthLayout title="Reset password" footer={<Link to="/login">Back to sign in</Link>}>
      {submitted ? (
        <Notice tone="success">
          If an account exists with that email, a reset link has been sent.
        </Notice>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
          <Field label="Email" error={errors.email?.message}>
            <Input
              size="lg"
              type="email"
              autoComplete="email"
              aria-required="true"
              {...register('email')}
            />
          </Field>

          {error && <Notice tone="danger">{error}</Notice>}

          <Button
            size="lg"
            variant="primary"
            type="submit"
            loading={isLoading}
            className={styles.full}
          >
            {isLoading ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
