import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthLayout } from './AuthLayout';
import { ScaffoldArt } from './ScaffoldArt';

describe('AuthLayout', () => {
  it('renders the title as the page heading', () => {
    render(
      <AuthLayout title="Sign in">
        <p>form body</p>
      </AuthLayout>
    );
    expect(screen.getByRole('heading', { name: 'Sign in', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Bill Pro Max')).toBeInTheDocument();
    expect(screen.getByText('Bill Pro Max').parentElement).toHaveClass('brand', 'md');
  });

  it('renders children and footer', () => {
    render(
      <AuthLayout title="Sign in" footer={<a href="/register">Create account</a>}>
        <p>form body</p>
      </AuthLayout>
    );
    expect(screen.getByText('form body')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create account' })).toBeInTheDocument();
  });

  it('renders without a footer', () => {
    render(
      <AuthLayout title="Reset password">
        <p>form body</p>
      </AuthLayout>
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders with only a title', () => {
    render(<AuthLayout title="Done. Redirecting…" />);
    expect(screen.getByRole('heading', { name: 'Done. Redirecting…' })).toBeInTheDocument();
  });

  it('hides the art from assistive tech', () => {
    const { container } = render(
      <AuthLayout title="Sign in">
        <p>x</p>
      </AuthLayout>
    );
    const art = container.querySelector('[aria-hidden="true"] svg[viewBox="0 0 520 400"]');
    expect(art).not.toBeNull();
  });
});

describe('ScaffoldArt', () => {
  it('is aria-hidden and renders 12 couplers', () => {
    const { container } = render(<ScaffoldArt />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('circle')).toHaveLength(12);
  });

  it('renders the dimension labels', () => {
    const { container } = render(<ScaffoldArt />);
    expect(container).toHaveTextContent('4.5 m · 3 bays');
    expect(container).toHaveTextContent('6.0 m');
  });
});
