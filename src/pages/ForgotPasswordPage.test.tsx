import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { renderWithProviders } from '../test/render';
import { resetPassword } from '../api/authApi';

vi.mock('../api/authApi', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signInWithGoogle: vi.fn(),
  resetPassword: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

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

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.mocked(resetPassword).mockReset();
  });

  it('shows the heading, email field and a way back', () => {
    renderWithProviders(<ForgotPasswordPage />, { preloadedState: loggedOut });
    expect(screen.getByRole('heading', { name: 'Reset password' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
  });

  it('requires an email', async () => {
    const { user } = renderWithProviders(<ForgotPasswordPage />, { preloadedState: loggedOut });
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('rejects a malformed email', async () => {
    const { user } = renderWithProviders(<ForgotPasswordPage />, { preloadedState: loggedOut });
    await user.type(screen.getByLabelText('Email'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('sends the reset link and shows the confirmation', async () => {
    vi.mocked(resetPassword).mockResolvedValue(undefined as never);
    const { user } = renderWithProviders(<ForgotPasswordPage />, { preloadedState: loggedOut });
    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText(/a reset link has been sent/)).toBeInTheDocument();
    expect(resetPassword).toHaveBeenCalledWith('a@b.co');
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });

  it('shows the error and keeps the form when sending fails', async () => {
    vi.mocked(resetPassword).mockRejectedValue(new Error('Rate limited'));
    const { user } = renderWithProviders(<ForgotPasswordPage />, { preloadedState: loggedOut });
    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Rate limited');
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});
