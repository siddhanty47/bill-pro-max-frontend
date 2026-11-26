import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useBulkDelete, type BulkDeleteOptions } from './useBulkDelete';
import { useConfirm } from './useConfirm';

type Row = { id: string; name: string; locked?: boolean };
const rows: Row[] = [
  { id: 'a', name: 'Acme' },
  { id: 'b', name: 'Bharat', locked: true },
  { id: 'c', name: 'Chopra' },
  { id: 'd', name: 'Desai' },
];

function Harness(
  props: Partial<BulkDeleteOptions<Row>> & Pick<BulkDeleteOptions<Row>, 'remove' | 'onSucceeded'>
) {
  const confirm = useConfirm();
  const bulk = useBulkDelete<Row>({
    rows,
    rowKey: r => r.id,
    label: r => r.name,
    noun: { one: 'party', many: 'parties' },
    ask: confirm.ask,
    ...props,
  });
  return (
    <>
      {bulk.button}
      {confirm.dialog}
      {bulk.dialog}
      <span data-testid="running">{String(bulk.running)}</span>
    </>
  );
}

afterEach(() => vi.restoreAllMocks());

describe('useBulkDelete', () => {
  it('asks first, deletes eligible rows and lists skips and refusals in table order', async () => {
    const user = userEvent.setup();
    const remove = vi.fn((r: Row) =>
      r.id === 'a' ? Promise.reject({ data: { message: 'has agreements' } }) : Promise.resolve()
    );
    const onSucceeded = vi.fn();
    render(
      <Harness
        remove={remove}
        onSucceeded={onSucceeded}
        skipReason={r => (r.locked ? 'locked' : null)}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Delete 3' }));
    const ask = screen.getByRole('dialog', { name: 'Delete 3 parties?' });
    expect(ask).toHaveTextContent("This can't be undone.");
    expect(remove).not.toHaveBeenCalled();
    await user.click(within(ask).getByRole('button', { name: 'Delete' }));

    const done = await screen.findByRole('dialog', { name: 'Done' });
    expect(remove.mock.calls.map(([r]) => r.id)).toEqual(['a', 'c', 'd']);
    expect(onSucceeded).toHaveBeenCalledWith(['c', 'd']);
    expect(done).toHaveTextContent('2 deleted');
    const list = within(done).getByRole('list', { name: 'Skipped parties' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map(li => li.textContent)
    ).toEqual(['Acme: has agreements', 'Bharat: locked']);
    // Names stay in the text font.
    expect(list.querySelector('.mono')).toBeNull();
    expect(screen.getByTestId('running')).toHaveTextContent('false');

    await user.click(within(done).getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does nothing when the confirm is cancelled', async () => {
    const user = userEvent.setup();
    const remove = vi.fn(() => Promise.resolve());
    render(<Harness remove={remove} onSucceeded={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Delete 4' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(remove).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses the singular and disables the button with nothing eligible', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <Harness remove={vi.fn(() => Promise.resolve())} onSucceeded={vi.fn()} rows={[rows[0]]} />
    );
    await user.click(screen.getByRole('button', { name: 'Delete 1' }));
    expect(screen.getByRole('dialog', { name: 'Delete 1 party?' })).toBeInTheDocument();
    unmount();
    render(
      <Harness
        remove={vi.fn(() => Promise.resolve())}
        onSucceeded={vi.fn()}
        skipReason={() => 'locked'}
      />
    );
    expect(screen.getByRole('button', { name: 'Delete 0' })).toBeDisabled();
  });

  it('disables the button while a run is going', async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const remove = vi.fn(() => new Promise<void>(resolve => (release = resolve)));
    render(<Harness remove={remove} onSucceeded={vi.fn()} rows={[rows[0]]} />);
    await user.click(screen.getByRole('button', { name: 'Delete 1' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByTestId('running')).toHaveTextContent('true'));
    expect(screen.getByRole('button', { name: 'Delete 1' })).toBeDisabled();
    release();
    expect(await screen.findByRole('dialog', { name: 'Done' })).toHaveTextContent('1 deleted');
  });
});
