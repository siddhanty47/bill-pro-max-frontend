import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { RegisterPage } from './RegisterPage';
import { renderWithProviders, signedIn } from '../test/render';
import { http } from 'msw';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import { signUp, signInWithGoogle } from '../api/authApi';

vi.mock('../api/authApi', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signInWithGoogle: vi.fn(),
  resetPassword: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

const loggedOut = {
  auth: {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    currentBusinessId: null,
  },
};

async function fill(
  overrides: Partial<Record<string, string>> = {},
  route = '/register',
  preloadedState = loggedOut
) {
  const values = {
    'First name': 'Ravi',
    'Last name': 'Sharma',
    Email: 'ravi@example.com',
    Password: 'secret123',
    'Confirm password': 'secret123',
    ...overrides,
  };
  const { user } = renderWithProviders(
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { preloadedState, route }
  );
  for (const [label, value] of Object.entries(values)) {
    if (value) await user.type(screen.getByLabelText(label), value);
  }
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  return user;
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.mocked(signUp).mockReset();
    vi.mocked(signInWithGoogle).mockReset();
    localStorage.clear();
    server.use(http.post(apiUrl('/auth/sync'), () => ok({ user: null })));
  });

  it('shows the create account heading, labelled fields and sign in link', () => {
    renderWithProviders(<RegisterPage />, { preloadedState: loggedOut });
    expect(screen.getByRole('heading', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByText(/Already have an account\?/)).toBeInTheDocument();
  });

  it('requires the name fields', async () => {
    await fill({ 'First name': '', 'Last name': '' });
    expect(await screen.findByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Last name is required')).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('keeps the invitation token on the sign in link and passes it to Google', async () => {
    const { user } = renderWithProviders(<RegisterPage />, {
      preloadedState: loggedOut,
      route: '/register?invitation=tok',
    });
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?invitation=tok'
    );
    await user.click(screen.getByRole('button', { name: 'Sign up with Google' }));
    expect(signInWithGoogle).toHaveBeenCalled();
    expect(localStorage.getItem('invitation_token')).toBe('tok');
  });

  it('goes home after sign-up when no confirmation is needed', async () => {
    vi.mocked(signUp).mockResolvedValue({ session: { access_token: 'tok-1' }, user: {} } as Awaited<
      ReturnType<typeof signUp>
    >);
    await fill();
    expect(await screen.findByTestId('where')).toHaveTextContent('/');
  });

  it('goes to the stored invitation after sign-up', async () => {
    vi.mocked(signUp).mockResolvedValue({ session: { access_token: 'tok-1' }, user: {} } as Awaited<
      ReturnType<typeof signUp>
    >);
    await fill({}, '/register?invitation=tok');
    expect(await screen.findByTestId('where')).toHaveTextContent('/invitations/tok');
    expect(localStorage.getItem('invitation_token')).toBeNull();
  });

  it('shows the sign-up error as an alert', async () => {
    vi.mocked(signUp).mockRejectedValue(new Error('Email taken'));
    await fill();
    expect(await screen.findByRole('alert')).toHaveTextContent('Email taken');
  });

  it('redirects an authenticated user home', () => {
    renderWithProviders(
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Where />} />
      </Routes>,
      { route: '/register', preloadedState: signedIn() }
    );
    expect(screen.getByTestId('where')).toHaveTextContent('/');
  });

  it('rejects mismatched passwords without calling sign-up', async () => {
    await fill({ 'Confirm password': 'different1' });

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than 6 characters', async () => {
    // (Malformed emails are stopped earlier by the browser: the input is type="email".)
    await fill({ Password: '123', 'Confirm password': '123' });

    expect(await screen.findByText('Password must be at least 6 characters')).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('signs up with valid input and asks to confirm the email', async () => {
    vi.mocked(signUp).mockResolvedValue({ session: null, user: null } as Awaited<
      ReturnType<typeof signUp>
    >);

    await fill();

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
    expect(signUp).toHaveBeenCalledWith('ravi@example.com', 'secret123', 'Ravi', 'Sharma');
  });
});
