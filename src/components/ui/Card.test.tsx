import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Card } from './Card';

describe('Card', () => {
  it('renders the title as a heading with a count', () => {
    render(
      <Card title="Overdue bills" count={5} countTone="danger">
        body
      </Card>
    );
    expect(screen.getByRole('heading', { name: /Overdue bills/, level: 2 })).toBeInTheDocument();
    expect(screen.getByText('5')).toHaveClass('danger');
  });

  it('renders a muted subtitle under the title', () => {
    render(
      <Card title="Ledger" subtitle="1 Jan to 5 Feb">
        body
      </Card>
    );
    expect(screen.getByText('1 Jan to 5 Feb')).toHaveClass('subtitle');
  });

  it('renders no heading without a title', () => {
    render(<Card>body</Card>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('renders the header for actions alone', () => {
    render(<Card actions={<button type="button">View all</button>}>body</Card>);
    expect(screen.getByRole('button', { name: 'View all' })).toBeInTheDocument();
  });

  it('uses a neutral count by default and omits padding when not padded', () => {
    const { container } = render(
      <Card title="T" count={0} padded={false} className="extra">
        body
      </Card>
    );
    expect(screen.getByText('0')).toHaveClass('neutral');
    expect(screen.getByText('body')).not.toHaveClass('body');
    expect(container.firstChild).toHaveClass('extra');
  });

  it('pads the body by default', () => {
    render(<Card>body</Card>);
    expect(screen.getByText('body')).toHaveClass('body');
  });

  it('renders a clickable link when given to', () => {
    render(
      <MemoryRouter>
        <Card to="/x" title="T">
          b
        </Card>
      </MemoryRouter>
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/x');
    expect(link).toHaveClass('clickable');
  });

  it('renders no link without to', () => {
    render(<Card title="T">b</Card>);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('entrance animation', () => {
  // The file name is a parameter: Vite rewrites a literal `new URL('./x', import.meta.url)`.
  async function readSource(file: string) {
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as {
      readFileSync(path: URL, encoding: 'utf8'): string;
    };
    return fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  }

  it('defines @keyframes rise once, globally, and the kit uses it through the token', async () => {
    const globals = await readSource('../../globals.css');
    expect(globals.match(/@keyframes rise\b/g)).toHaveLength(1);
    expect(globals).toMatch(/--animate-rise:\s*rise var\(--duration-enter\)/);
    for (const file of [
      './Card.module.css',
      './StatCard.module.css',
      './PageHeader.module.css',
      '../auth/AuthLayout.module.css',
    ]) {
      const css = await readSource(file);
      expect(css, file).not.toMatch(/@keyframes rise/);
      expect(css, file).toMatch(/animation:\s*var\(--animate-rise\)/);
    }
  });
});
