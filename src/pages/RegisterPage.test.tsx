import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { RegisterPage } from './RegisterPage';
import { renderWithProviders } from '../test/render';
import { signUp } from '../api/authApi';

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

async function fill(overrides: Partial<Record<string, string>> = {}) {
  const values = {
    'First Name': 'Ravi',
    'Last Name': 'Sharma',
    Email: 'ravi@example.com',
    Password: 'secret123',
    'Confirm Password': 'secret123',
    ...overrides,
  };
  const { user } = renderWithProviders(<RegisterPage />, { preloadedState: loggedOut });
  for (const [label, value] of Object.entries(values)) {
    if (value) await user.type(screen.getByPlaceholderText(label, { exact: true }), value);
  }
  await user.click(screen.getByRole('button', { name: 'Create Account' }));
}

describe('RegisterPage', () => {
  beforeEach(() => vi.mocked(signUp).mockReset());

  it('rejects mismatched passwords without calling sign-up', async () => {
    await fill({ 'Confirm Password': 'different1' });

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than 6 characters', async () => {
    // (Malformed emails are stopped earlier by the browser: the input is type="email".)
    await fill({ Password: '123', 'Confirm Password': '123' });

    expect(await screen.findByText('Password must be at least 6 characters')).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('signs up with valid input and asks to confirm the email', async () => {
    vi.mocked(signUp).mockResolvedValue({ session: null, user: null } as Awaited<
      ReturnType<typeof signUp>
    >);

    await fill();

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(signUp).toHaveBeenCalledWith('ravi@example.com', 'secret123', 'Ravi', 'Sharma');
  });
});
