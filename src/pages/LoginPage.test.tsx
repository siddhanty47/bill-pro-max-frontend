import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { renderWithProviders } from '../test/render';
import { useAuth } from '../hooks/useAuth';

vi.mock('../hooks/useAuth');

const login = vi.fn();
const loginWithGoogle = vi.fn();

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    login,
    loginWithGoogle,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    ...overrides,
  } as unknown as ReturnType<typeof useAuth>);
}

function Where() {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{pathname + search}</div>;
}

async function landedOn() {
  return (await screen.findByTestId('where')).textContent;
}

function renderLogin(route = '/login') {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { route }
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    login.mockReset();
    loginWithGoogle.mockReset();
    localStorage.clear();
    mockAuth();
  });

  it('shows the sign in heading and labelled fields without the old subtitle', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByText(/Scaffolding Rental Management/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Forgot?' })).toHaveAttribute(
      'href',
      '/forgot-password'
    );
  });

  it('requires email and password', async () => {
    const { user } = renderLogin();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects a malformed email', async () => {
    const { user } = renderLogin();
    await user.type(screen.getByLabelText('Email'), 'nope');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('logs in with valid input and goes home', async () => {
    login.mockResolvedValue({ success: true });
    const { user } = renderLogin();
    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(login).toHaveBeenCalledWith('a@b.co', 'secret');
    expect(await landedOn()).toBe('/');
  });

  it('stays on the page when login fails', async () => {
    login.mockResolvedValue({ success: false });
    const { user } = renderLogin();
    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.type(screen.getByLabelText('Password'), 'bad');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(login).toHaveBeenCalled();
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('stores the invitation token and redirects to the invitation after login', async () => {
    login.mockResolvedValue({ success: true });
    const { user } = renderLogin('/login?invitation=tok');
    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await landedOn()).toBe('/invitations/tok');
    expect(localStorage.getItem('invitation_token')).toBeNull();
  });

  it('returns to the page the user came from after login', async () => {
    login.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={[{ pathname: '/login', state: { from: { pathname: '/bills' } } }]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    );
    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await landedOn()).toBe('/bills');
  });

  it('shows an auth error as an alert', () => {
    mockAuth({ error: 'Invalid login credentials' });
    renderLogin();
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid login credentials');
  });

  it('continues with Google', async () => {
    const { user } = renderLogin();
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(loginWithGoogle).toHaveBeenCalledWith(undefined);
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/register'
    );
  });

  it('passes the invitation token to Google and the register link', async () => {
    const { user } = renderLogin('/login?invitation=tok');
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(loginWithGoogle).toHaveBeenCalledWith('tok');
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/register?invitation=tok'
    );
  });

  it('disables submit while loading', () => {
    mockAuth({ isLoading: true });
    renderLogin();
    const button = screen.getByRole('button', { name: 'Signing in…' });
    expect(button).toBeDisabled();
  });

  it('redirects an already authenticated user home', async () => {
    mockAuth({ isAuthenticated: true });
    renderLogin();
    expect(await landedOn()).toBe('/');
  });

  it('redirects an already authenticated user to where they came from', async () => {
    mockAuth({ isAuthenticated: true });
    render(
      <MemoryRouter
        initialEntries={[{ pathname: '/login', state: { from: { pathname: '/bills' } } }]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await landedOn()).toBe('/bills');
    expect(login).not.toHaveBeenCalled();
  });

  it('puts Forgot? on the password label row, outside the label', () => {
    renderLogin();
    const forgot = screen.getByRole('link', { name: 'Forgot?' });
    expect(forgot.closest('label')).toBeNull();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });
});
