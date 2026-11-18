import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './Pagination';
import { pageItems } from './pageItems';

describe('pageItems', () => {
  it('lists every page when there are at most 7', () => {
    expect(pageItems(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps first, last and current ± 1 with gaps', () => {
    expect(pageItems(10, 20)).toEqual([1, 'gap-start', 9, 10, 11, 'gap-end', 20]);
  });

  it('shows a lone hidden page instead of a gap near the ends', () => {
    expect(pageItems(1, 20)).toEqual([1, 2, 3, 4, 5, 'gap-end', 20]);
    expect(pageItems(4, 20)).toEqual([1, 2, 3, 4, 5, 'gap-end', 20]);
    expect(pageItems(20, 20)).toEqual([1, 'gap-start', 16, 17, 18, 19, 20]);
    expect(pageItems(17, 20)).toEqual([1, 'gap-start', 16, 17, 18, 19, 20]);
  });
});

describe('Pagination', () => {
  it('renders nothing when everything fits on one page', () => {
    const { container } = render(
      <Pagination page={1} pageSize={25} total={25} onPageChange={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('summarises the visible range and marks the current page', () => {
    render(
      <Pagination
        page={2}
        pageSize={25}
        total={132}
        onPageChange={() => {}}
        label="Challans pages"
      />
    );
    const nav = screen.getByRole('navigation', { name: 'Challans pages' });
    expect(nav).toHaveTextContent('Showing 26–50 of 132');
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Page 1' })).not.toHaveAttribute('aria-current');
    expect(nav).toHaveTextContent('Page 2 of 6');
  });

  it('moves with Previous, Next and page numbers', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination page={2} pageSize={25} total={132} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: /Previous/ }));
    await user.click(screen.getByRole('button', { name: /Next/ }));
    await user.click(screen.getByRole('button', { name: 'Page 6' }));
    await user.click(screen.getByRole('button', { name: 'Page 2' }));

    expect(onPageChange.mock.calls).toEqual([[1], [3], [6]]);
  });

  it('disables Previous on the first page and Next on the last', () => {
    const { rerender } = render(
      <Pagination page={1} pageSize={10} total={30} onPageChange={() => {}} />
    );
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Next/ })).toBeEnabled();

    rerender(<Pagination page={3} pageSize={10} total={30} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
    expect(screen.getByRole('navigation')).toHaveTextContent('Showing 21–30 of 30');
  });

  it('clamps an out-of-range page to the last one', () => {
    render(<Pagination page={9} pageSize={10} total={25} onPageChange={() => {}} />);
    expect(screen.getByRole('navigation')).toHaveTextContent('Showing 21–25 of 25');
  });

  it('collapses page numbers on phones (CSS present)', async () => {
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as {
      readFileSync(path: string, encoding: 'utf8'): string;
    };
    const css = fs.readFileSync('src/components/ui/Pagination.module.css', 'utf8');
    const phone = css.slice(css.indexOf('@media (max-width: 480px)'));
    expect(phone).toMatch(/\.pages\s*\{[^}]*display:\s*none/);
    expect(phone).toMatch(/\.compact\s*\{[^}]*display:\s*block/);
  });
});
