import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  it('is a named searchbox that reports typing and forwards its ref', async () => {
    const onChange = vi.fn();
    const ref = createRef<HTMLInputElement>();
    render(<SearchInput ref={ref} label="Search bills" placeholder="Find" onChange={onChange} />);
    const box = screen.getByRole('searchbox', { name: 'Search bills' });
    expect(ref.current).toBe(box);
    await userEvent.type(box, 'ab');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('has no fixed flex basis of its own, so a column parent cannot stretch it', async () => {
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as {
      readFileSync(path: string, encoding: 'utf8'): string;
    };
    const css = fs.readFileSync('src/components/ui/SearchInput.module.css', 'utf8');
    expect(css).not.toMatch(/flex:\s*1 1 \d+px/);
  });

  it('shows an aria-hidden shortcut hint only when given', () => {
    const { rerender } = render(<SearchInput label="Search" hint="/" />);
    expect(screen.getByText('/')).toHaveAttribute('aria-hidden', 'true');
    rerender(<SearchInput label="Search" />);
    expect(screen.queryByText('/')).not.toBeInTheDocument();
  });
});
