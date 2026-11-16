/**
 * @file Login page with email/password form and Google OAuth button.
 */
import { useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Button, Field, GoogleIcon, Input, Notice } from '../components/ui';
import styles from '../components/auth/AuthForm.module.css';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get('invitation');
  const { login, loginWithGoogle, isAuthenticated, isLoading, error } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const onSubmit = async (data: LoginForm) => {
    if (invitationToken) {
      localStorage.setItem('invitation_token', invitationToken);
    }
    const result = await login(data.email, data.password);
    if (result.success) {
      const storedInvitation = localStorage.getItem('invitation_token');
      if (storedInvitation) {
        localStorage.removeItem('invitation_token');
        navigate(`/invitations/${storedInvitation}`, { replace: true });
      } else {
        const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
        navigate(from, { replace: true });
      }
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      footer={
        <>
          New here?{' '}
          <Link to={invitationToken ? `/register?invitation=${invitationToken}` : '/register'}>
            Create account
          </Link>
        </>
      }
    >
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

        <Field
          label="Password"
          error={errors.password?.message}
          labelAction={<Link to="/forgot-password">Forgot?</Link>}
        >
          <Input
            size="lg"
            type="password"
            autoComplete="current-password"
            aria-required="true"
            {...register('password')}
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
          {isLoading ? 'Signing in…' : 'Sign in'}
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
