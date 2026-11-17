import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { DetailField, DetailPageShell, DetailSection, NotAdded } from './DetailPageShell';

/** Reads a CSS module's source (vitest runs from the repo root). */
async function cssSource(path: string) {
  const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as {
    readFileSync(path: string, encoding: 'utf8'): string;
  };
  return fs.readFileSync(path, 'utf8');
}

const renderInRouter = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const TABS = [
  { id: 'about', label: 'About' },
  { id: 'bills', label: 'Bills', count: 12 },
];

describe('DetailPageShell', () => {
  it('renders the back link, eyebrow with code, title and actions', () => {
    renderInRouter(
      <DetailPageShell
        title="Mehta Builders"
        eyebrow="Party"
        code="MEHT"
        backTo="/parties"
        backLabel="Parties"
        headerActions={<button type="button">New bill</button>}
      >
        body
      </DetailPageShell>
    );

    const back = screen.getByRole('link', { name: 'Back to Parties' });
    expect(back).toHaveAttribute('href', '/parties');
    expect(back).toHaveTextContent('Parties');
    const code = screen.getByText('MEHT');
    expect(code).toHaveClass('mono');
    expect(code.parentElement).toHaveTextContent('Party · MEHT');
    expect(code.parentElement).not.toHaveClass('mono');
    expect(screen.getByRole('heading', { level: 1, name: 'Mehta Builders' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New bill' })).toBeInTheDocument();
  });

  it('shows the status once as a status chip', () => {
    renderInRouter(
      <DetailPageShell title="Mehta Builders" status="Active" backTo="/parties" backLabel="Parties">
        body
      </DetailPageShell>
    );
    expect(screen.getAllByText('Active')).toHaveLength(1);
  });

  it('keeps the legacy props working: subtitle becomes the eyebrow, statusClassName is ignored', () => {
    renderInRouter(
      <DetailPageShell
        title="B-001"
        subtitle="Party: Mehta"
        status="partially_paid"
        statusClassName="status status-partially_paid"
        backTo="/bills"
        backLabel="Bills"
      >
        body
      </DetailPageShell>
    );
    expect(screen.getByText('Party: Mehta')).toBeInTheDocument();
    const chip = screen.getByText('Partially paid');
    expect(chip).not.toHaveClass('status');
  });

  it('renders a spinner while loading and an error with retry', async () => {
    const onRetry = vi.fn();
    const { rerender } = renderInRouter(
      <DetailPageShell title="X" backTo="/x" backLabel="Items" isLoading>
        body
      </DetailPageShell>
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('body')).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <DetailPageShell
          title="X"
          backTo="/x"
          backLabel="Items"
          error={{ status: 500, data: { error: { message: 'Server down' } } }}
          onRetry={onRetry}
        >
          body
        </DetailPageShell>
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: /try again|retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders tabs with counts wired to a panel that wraps the children', async () => {
    const onTabChange = vi.fn();
    renderInRouter(
      <DetailPageShell
        title="Mehta Builders"
        backTo="/parties"
        backLabel="Parties"
        tabs={TABS}
        activeTab="about"
        onTabChange={onTabChange}
        idPrefix="party"
      >
        About content
      </DetailPageShell>
    );

    const about = screen.getByRole('tab', { name: 'About' });
    expect(about).toHaveAttribute('aria-selected', 'true');
    expect(about).toHaveAttribute('aria-controls', 'party-panel-about');
    const bills = screen.getByRole('tab', { name: /Bills/ });
    expect(within(bills).getByText('12')).toBeInTheDocument();

    const panel = screen.getByRole('tabpanel', { name: 'About' });
    expect(panel).toHaveAttribute('id', 'party-panel-about');
    expect(panel).toHaveTextContent('About content');

    await userEvent.click(bills);
    expect(onTabChange).toHaveBeenCalledWith('bills');
  });

  it('runs uncontrolled tabs without activeTab, starting on the first', async () => {
    const onTabChange = vi.fn();
    renderInRouter(
      <DetailPageShell
        title="T"
        backTo="/t"
        backLabel="Things"
        tabs={TABS}
        onTabChange={onTabChange}
      >
        content
      </DetailPageShell>
    );
    expect(screen.getByRole('tab', { name: 'About' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'About' })).toHaveAttribute(
      'id',
      'detail-panel-about'
    );

    await userEvent.click(screen.getByRole('tab', { name: /Bills/ }));
    expect(screen.getByRole('tab', { name: /Bills/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'detail-panel-bills');
    expect(onTabChange).toHaveBeenCalledWith('bills');
  });

  it('shows a custom loading label', () => {
    renderInRouter(
      <DetailPageShell
        title="X"
        backTo="/x"
        backLabel="Items"
        isLoading
        loadingLabel="Loading item"
      >
        body
      </DetailPageShell>
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading item');
  });

  it('places the sidebar in a complementary region after the main column', () => {
    renderInRouter(
      <DetailPageShell
        title="T"
        backTo="/t"
        backLabel="Things"
        sidebar={<DetailSection title="Details">side</DetailSection>}
      >
        <p>main</p>
      </DetailPageShell>
    );
    const aside = screen.getByRole('complementary');
    expect(aside).toHaveTextContent('side');
    expect(aside).not.toHaveTextContent('main');
    const main = screen.getByText('main');
    expect(main.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('DetailSection', () => {
  it('renders a card with title, count and actions', () => {
    render(
      <DetailSection title="Sites" count={3} actions={<button type="button">Add site</button>}>
        rows
      </DetailSection>
    );
    const heading = screen.getByRole('heading', { name: /Sites/ });
    expect(heading).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: 'Add site' })).toBeInTheDocument();
    expect(screen.getByText('rows')).toBeInTheDocument();
  });

  it('accepts the legacy headerActions prop', () => {
    render(
      <DetailSection title="Sites" headerActions={<button type="button">Add</button>}>
        rows
      </DetailSection>
    );
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});

describe('DetailField', () => {
  it('renders a label/value row in a description list', () => {
    render(<DetailField label="Phone" value="98200 41275" mono />);
    const term = screen.getByRole('term');
    expect(term).toHaveTextContent('Phone');
    const value = screen.getByRole('definition');
    expect(value).toHaveTextContent('98200 41275');
    expect(value).toHaveClass('mono');
  });

  it('shows "Not added" for empty values', () => {
    render(
      <>
        <DetailField label="Email" value="" />
        <DetailField label="GST" value={undefined} />
        <DetailField label="Notes" value={null} emptyText="No notes" />
      </>
    );
    expect(screen.getAllByText('Not added')).toHaveLength(2);
    expect(screen.getByText('No notes')).toBeInTheDocument();
  });

  it('keeps the empty placeholder in the text font on a mono field', async () => {
    render(<DetailField label="GST" value={undefined} mono />);
    const empty = screen.getByText('Not added');
    expect(empty).toHaveClass('empty');
    expect(await cssSource('src/components/DetailPageShell.module.css')).toMatch(
      /\.empty\s*{[^}]*font-family:\s*var\(--font-sans\)/
    );
  });

  it('renders a bare value without a label row', () => {
    render(<DetailField label="" value="Pays by cheque" />);
    expect(screen.queryByRole('term')).not.toBeInTheDocument();
    expect(screen.getByText('Pays by cheque')).toBeInTheDocument();
  });

  it('saves an inline edit through the editable config', async () => {
    const onSave = vi.fn(async () => {});
    const user = userEvent.setup();
    render(
      <DetailField
        label="Name"
        value="Mehta Builders"
        editable={{ rawValue: 'Mehta Builders', inputType: 'text', onSave }}
      />
    );

    expect(screen.getByRole('term')).toHaveTextContent('Name');
    await user.click(screen.getByRole('button', { name: /Mehta Builders/ }));
    const input = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(input);
    await user.type(input, 'Mehta & Sons{Enter}');

    expect(onSave).toHaveBeenCalledWith('Mehta & Sons');
  });

  it('shows "Not added" for an empty editable value', () => {
    render(
      <DetailField
        label="Email"
        value={undefined}
        editable={{ rawValue: '', inputType: 'text', onSave: vi.fn(async () => {}) }}
      />
    );
    expect(screen.getByRole('button', { name: /Not added/ })).toBeInTheDocument();
  });

  it('renders a section of labelled fields as one <dl> of row groups', () => {
    const { container } = render(
      <DetailSection title="Contact">
        <DetailField label="Name" value="Mehta" />
        <>
          <DetailField label="Phone" value="98200" mono />
          {false}
        </>
        <DetailField label="Email" value="" />
      </DetailSection>
    );
    const lists = container.querySelectorAll('dl');
    expect(lists).toHaveLength(1);
    const rows = Array.from(lists[0].children);
    expect(rows).toHaveLength(3);
    rows.forEach(row => {
      expect(row.tagName).toBe('DIV');
      expect(row.querySelector('dt')).not.toBeNull();
      expect(row.querySelector('dd')).not.toBeNull();
    });
    expect(screen.getAllByRole('term')).toHaveLength(3);
  });

  it('keeps each field its own <dl> when the section mixes other content', () => {
    const { container } = render(
      <DetailSection title="Notes">
        <DetailField label="Name" value="Mehta" />
        <p>Free text</p>
      </DetailSection>
    );
    const lists = container.querySelectorAll('dl');
    expect(lists).toHaveLength(1);
    expect(lists[0].parentElement?.tagName).toBe('DIV');
    expect(screen.getByText('Free text').closest('dl')).toBeNull();
  });
});

describe('NotAdded', () => {
  it('renders the muted placeholder, same class as an empty DetailField', () => {
    render(
      <>
        <NotAdded />
        <NotAdded>Not set</NotAdded>
        <DetailField label="Email" value={undefined} />
      </>
    );
    const [standalone, fieldEmpty] = screen.getAllByText('Not added');
    expect(standalone).toHaveClass('empty');
    expect(fieldEmpty).toHaveClass('empty');
    expect(screen.getByText('Not set')).toHaveClass('empty');
  });
});

describe('DetailField list context nesting', () => {
  it('gives a DetailField nested in a row value its own <dl>', () => {
    renderInRouter(
      <DetailSection title="Outer">
        <DetailField label="Address" value={<DetailField label="City" value="Pune" />} />
      </DetailSection>
    );
    const outerRow = screen.getByText('Address').closest('div');
    expect(outerRow?.parentElement?.tagName).toBe('DL');
    // The inner field is not a row of the outer list: it is a <dl> of its own.
    expect(screen.getByText('City').parentElement?.tagName).toBe('DL');
  });

  it('resets the context inside non-list and unpadded sections nested in a list', () => {
    renderInRouter(
      <DetailSection title="Outer">
        <DetailField
          label="Nested"
          value={
            <>
              <DetailSection title="Mixed">
                <p>text</p>
                <DetailField label="A" value="1" />
              </DetailSection>
              <DetailSection title="Bare" padded={false}>
                <DetailField label="B" value="2" />
              </DetailSection>
            </>
          }
        />
      </DetailSection>
    );
    expect(screen.getByText('A').parentElement?.tagName).toBe('DL');
    expect(screen.getByText('B').parentElement?.tagName).toBe('DL');
  });
});
