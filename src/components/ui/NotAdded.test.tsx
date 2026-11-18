import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readCss } from '../../test/readCss';
import { NotAdded } from './NotAdded';

describe('NotAdded', () => {
  it('renders the muted default text', () => {
    render(<NotAdded />);
    expect(screen.getByText('Not added')).toHaveClass('notAdded');
  });

  it('renders custom text', () => {
    render(<NotAdded>Not set</NotAdded>);
    expect(screen.getByText('Not set')).toHaveClass('notAdded');
  });

  it('stays in the text font and muted, even inside a mono cell', async () => {
    const css = await readCss('src/components/ui/NotAdded.module.css');
    expect(css).toMatch(/\.notAdded\s*\{[^}]*font-family:\s*var\(--font-sans\)/);
    expect(css).toMatch(/\.notAdded\s*\{[^}]*color:\s*var\(--text-muted\)/);
  });
});
