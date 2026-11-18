/**
 * @file Register page with sign-up form and Google OAuth.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Button, Field, GoogleIcon, Input, Notice } from '../components/ui';
import styles from '../components/auth/AuthForm.module.css';

const registerSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine(data => data.password === data.confirmPassword, {
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
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

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
      <AuthLayout title="Check your email" footer={<Link to="/login">Back to sign in</Link>}>
        <Notice tone="success">A confirmation link has been sent to your email.</Notice>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create account"
      footer={
        <>
          Already have an account?{' '}
          <Link to={invitationToken ? `/login?invitation=${invitationToken}` : '/login'}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
        <Field label="First name" error={errors.firstName?.message}>
          <Input
            size="lg"
            autoComplete="given-name"
            aria-required="true"
            {...register('firstName')}
          />
        </Field>

        <Field label="Last name" error={errors.lastName?.message}>
          <Input
            size="lg"
            autoComplete="family-name"
            aria-required="true"
            {...register('lastName')}
          />
        </Field>

        <Field label="Email" error={errors.email?.message}>
          <Input
            size="lg"
            type="email"
            autoComplete="email"
            aria-required="true"
            {...register('email')}
          />
        </Field>

        <Field label="Password" error={errors.password?.message}>
          <Input
            size="lg"
            type="password"
            autoComplete="new-password"
            aria-required="true"
            {...register('password')}
          />
        </Field>

        <Field label="Confirm password" error={errors.confirmPassword?.message}>
          <Input
            size="lg"
            type="password"
            autoComplete="new-password"
            aria-required="true"
            {...register('confirmPassword')}
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
          {isLoading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <div className={styles.divider}>or</div>

      <Button
        size="lg"
        className={styles.full}
        onClick={() => loginWithGoogle(invitationToken ?? undefined)}
      >
        <GoogleIcon />
        Continue with Google
      </Button>
    </AuthLayout>
  );
}
