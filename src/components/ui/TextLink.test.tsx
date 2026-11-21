import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { RowLinkContext } from './rowLink';
import { readCss } from '../../test/readCss';
import { TextLink } from './TextLink';

describe('TextLink', () => {
  it('renders a router link', () => {
    render(
      <MemoryRouter>
        <TextLink to="/parties/p1">Mehta Builders</TextLink>
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'Mehta Builders' });
    expect(link).toHaveAttribute('href', '/parties/p1');
    expect(link).toHaveClass('link');
  });

  it('merges a placement className', () => {
    render(
      <MemoryRouter>
        <TextLink to="/x" className="place">
          Go
        </TextLink>
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Go' })).toHaveClass('link', 'place');
  });

  it('sets an explicit accent and hover colour', async () => {
    const css = await readCss('src/components/ui/TextLink.module.css');
    expect(css).toMatch(/\.link\s*\{[^}]*color:\s*var\(--accent\)/);
    expect(css).toMatch(/\.link:hover\s*\{[^}]*color:\s*var\(--accent-hover\)/);
  });
});

describe('TextLink row state', () => {
  it('explicit state wins over the row state', async () => {
    function Probe() {
      return <div data-testid="s">{JSON.stringify(useLocation().state)}</div>;
    }
    render(
      <MemoryRouter>
        <Routes>
          <Route
            path="/"
            element={
              <RowLinkContext.Provider
                value={{ to: '/x', state: { recordNav: { paths: ['/x'], index: 0 } } }}
              >
                <TextLink to="/x" state={{ own: 1 }}>
                  go
                </TextLink>
              </RowLinkContext.Provider>
            }
          />
          <Route path="/x" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('link', { name: 'go' }));
    expect(screen.getByTestId('s')).toHaveTextContent('{"own":1}');
  });
});
