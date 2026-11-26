import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkResultDialog } from './BulkResultDialog';

describe('BulkResultDialog', () => {
  it('shows each line and the skipped rows with reasons, in order', () => {
    render(
      <BulkResultDialog
        lines={['2 confirmed', '1 downloaded']}
        skipped={[
          { label: 'CH-3', reason: 'year closed' },
          { label: 'CH-1', reason: 'needs a check, open it to confirm' },
        ]}
        noun="challans"
        onClose={() => {}}
      />
    );
    const dialog = screen.getByRole('dialog', { name: 'Done' });
    expect(dialog).toHaveTextContent('2 confirmed');
    expect(dialog).toHaveTextContent('1 downloaded');
    expect(dialog).toHaveTextContent('Skipped (2)');
    const list = within(dialog).getByRole('list', { name: 'Skipped challans' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map(li => li.textContent)).toEqual([
      'CH-3: year closed',
      'CH-1: needs a check, open it to confirm',
    ]);
    expect(items[0].querySelector('.mono')).toHaveTextContent('CH-3');
  });

  it('hides the skipped section when nothing was skipped', () => {
    render(<BulkResultDialog lines={['3 deleted']} skipped={[]} onClose={() => {}} />);
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Skipped');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('keeps names in the text font and defaults the list name', () => {
    render(
      <BulkResultDialog
        lines={['0 deleted']}
        skipped={[{ label: 'Acme', reason: 'has agreements' }]}
        monoLabels={false}
        onClose={() => {}}
      />
    );
    const list = screen.getByRole('list', { name: 'Skipped rows' });
    expect(list.querySelector('.mono')).toBeNull();
    expect(list).toHaveTextContent('Acme: has agreements');
  });

  it('closes from the Close button', async () => {
    const onClose = vi.fn();
    render(<BulkResultDialog lines={['1 sent']} skipped={[]} onClose={onClose} />);
    const buttons = within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Close' });
    await userEvent.click(buttons.at(-1)!);
    expect(onClose).toHaveBeenCalled();
  });
});
