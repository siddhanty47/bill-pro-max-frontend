import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { renderWithProviders, signedIn } from '../../test/render';
import { server } from '../../test/msw/server';
import { apiUrl, ok } from '../../test/msw/handlers';
import { makeBill } from '../../test/factories';
import { ChangeImpactDialog } from './ChangeImpactDialog';
import type { GateReport } from '../../types';

const DRAFT_HELPER = "We'll update these. Check them before sending.";
const SENT_HELPER =
  "We won't change a sent bill. We'll prepare a correction with the difference for you to review and send.";
const STOCK_HELPER =
  'Some items will show less than zero in stock. Check the challan quantities before saving.';
const BLOCKED = 'These months are already billed. Only an owner or manager can make this change.';

const negativeSpan = {
  itemId: 'i1',
  itemName: 'Ladder',
  from: '2026-04-10T00:00:00.000Z',
  minQty: -3,
  firstCause: 'D-0007',
};

const mixed: GateReport = {
  affected: [
    { billId: 'b1', billNumber: 'INV-1', status: 'draft', issued: false },
    { billId: 'b2', billNumber: 'INV-2', status: 'sent', issued: true },
    { billId: 'b3', billNumber: 'INV-3', status: 'paid', issued: true },
  ],
  negative: [],
  requiresReason: true,
  blocked: null,
};

function renderDialog(report: GateReport) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  server.use(
    http.get(apiUrl('/businesses'), () => ok([])),
    http.get(apiUrl('/businesses/biz-1/bills/:billId'), ({ params }) =>
      ok(
        makeBill({
          _id: String(params.billId),
          billNumber: `Bill ${String(params.billId)}`,
          totalAmount: 5000,
          amountPaid: 0,
        })
      )
    )
  );
  const view = renderWithProviders(
    <ChangeImpactDialog report={report} busy={false} onCancel={onCancel} onConfirm={onConfirm} />,
    { preloadedState: signedIn('biz-1') }
  );
  return { ...view, onCancel, onConfirm };
}

const billButton = (number: string) => screen.getByRole('button', { name: `${number} View` });

describe('ChangeImpactDialog title', () => {
  it('counts one bill in the singular', () => {
    renderDialog({ ...mixed, affected: mixed.affected.slice(0, 1) });
    expect(
      screen.getByRole('dialog', { name: 'This change will update 1 bill' })
    ).toBeInTheDocument();
  });

  it('has a plain fallback when the report lists nothing', () => {
    renderDialog({ ...mixed, affected: [], blocked: 'role' });
    expect(screen.getByRole('dialog', { name: 'Check this change' })).toBeInTheDocument();
  });
});

describe('ChangeImpactDialog', () => {
  it('titles the dialog by the number of bills and groups them with counts', () => {
    renderDialog(mixed);
    const dialog = screen.getByRole('dialog', { name: 'This change will update 3 bills' });
    const drafts = within(dialog).getByRole('heading', { name: 'Not sent yet (1)' });
    const sent = within(dialog).getByRole('heading', { name: 'Already sent to the client (2)' });
    const draftSection = drafts.closest('section')!;
    const sentSection = sent.closest('section')!;
    expect(within(draftSection).getByText(DRAFT_HELPER)).toBeInTheDocument();
    expect(within(draftSection).getByRole('button', { name: 'INV-1 View' })).toBeInTheDocument();
    expect(within(sentSection).getByText(SENT_HELPER)).toBeInTheDocument();
    expect(within(sentSection).getByRole('button', { name: 'INV-2 View' })).toBeInTheDocument();
    expect(within(sentSection).getByRole('button', { name: 'INV-3 View' })).toBeInTheDocument();
  });

  it('uses no accounting jargon', () => {
    renderDialog({ ...mixed, negative: [negativeSpan] });
    const text = screen.getByRole('dialog').textContent ?? '';
    expect(text).not.toMatch(/credit|debit|out of date|recheck|drift/i);
    expect(text).not.toMatch(/Exact amounts appear/);
  });

  it('shows the stock section with its heading when bills are affected too', () => {
    renderDialog({ ...mixed, negative: [negativeSpan] });
    expect(screen.getByRole('heading', { name: 'Stock will go below zero' })).toBeInTheDocument();
    expect(screen.getByText(STOCK_HELPER)).toBeInTheDocument();
    expect(screen.getByText(/Ladder/)).toHaveTextContent('lowest count -3');
  });

  it('titles a stock-only report by the stock and shows no bill sections', () => {
    renderDialog({ affected: [], negative: [negativeSpan], requiresReason: true, blocked: null });
    const dialog = screen.getByRole('dialog', { name: 'Stock will go below zero' });
    expect(within(dialog).queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
    expect(within(dialog).getByText(STOCK_HELPER)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /View/ })).not.toBeInTheDocument();
  });

  it('keeps Save change disabled until a required reason is typed', async () => {
    const { user, onConfirm } = renderDialog(mixed);
    const reason = screen.getByLabelText(/Why are you making this change\?/);
    expect(reason).toHaveAttribute('placeholder', 'e.g. wrong quantity on challan');
    const save = screen.getByRole('button', { name: 'Save change' });
    expect(save).toBeDisabled();
    await user.type(reason, '   ');
    expect(save).toBeDisabled();
    await user.type(reason, ' Wrong count ');
    await user.click(save);
    expect(onConfirm).toHaveBeenCalledWith('Wrong count');
  });

  it('saves without a reason when none is required', async () => {
    const { user, onConfirm } = renderDialog({ ...mixed, requiresReason: false });
    await user.click(screen.getByRole('button', { name: 'Save change' }));
    expect(onConfirm).toHaveBeenCalledWith('');
  });

  it('cancels from Cancel', async () => {
    const { user, onCancel } = renderDialog(mixed);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows only the notice and Close when the role may not make the change', async () => {
    const { user, onCancel, onConfirm } = renderDialog({ ...mixed, blocked: 'role' });
    const dialog = screen.getByRole('dialog', { name: 'This change will update 3 bills' });
    expect(within(dialog).getByText(BLOCKED)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Why are you making/)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Save change' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    // The bills can still be looked at
    await user.click(billButton('INV-2'));
    expect(await screen.findByText('Bill b2')).toBeInTheDocument();
    await user.click(within(dialog).getByText('Close'));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('opens a bill in the side panel without leaving the dialog', async () => {
    const { user } = renderDialog(mixed);
    const row = billButton('INV-2');
    expect(row).toHaveAttribute('aria-expanded', 'false');
    await user.click(row);

    const panel = screen.getByRole('region', { name: 'Bill preview' });
    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(row).toHaveAttribute('aria-pressed', 'true');
    expect(row).toHaveAttribute('aria-controls', panel.id);
    expect(await within(panel).findByText('Bill b2')).toBeInTheDocument();
    expect(within(panel).getByText('Bill total').nextSibling).toHaveTextContent('₹5,000');
    expect(screen.getByRole('dialog')).toHaveClass('wideSize');
    expect(screen.getByRole('button', { name: 'Save change' })).toBeInTheDocument();
  });

  it('switches bills from another row and closes from the active row', async () => {
    const { user } = renderDialog(mixed);
    await user.click(billButton('INV-1'));
    expect(await screen.findByText('Bill b1')).toBeInTheDocument();
    await user.click(billButton('INV-3'));
    expect(await screen.findByText('Bill b3')).toBeInTheDocument();
    expect(billButton('INV-1')).toHaveAttribute('aria-expanded', 'false');
    await user.click(billButton('INV-3'));
    expect(screen.queryByRole('region', { name: 'Bill preview' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).not.toHaveClass('wideSize');
  });

  it('closes the panel from its close button and returns focus to the row', async () => {
    const { user } = renderDialog(mixed);
    await user.click(billButton('INV-2'));
    await user.click(await screen.findByRole('button', { name: 'Close bill' }));
    expect(screen.queryByRole('region', { name: 'Bill preview' })).not.toBeInTheDocument();
    await waitFor(() => expect(billButton('INV-2')).toHaveFocus());
  });

  it('closes the panel on Escape, keeps the typed reason, then closes the dialog', async () => {
    const { user, onCancel } = renderDialog(mixed);
    await user.type(screen.getByLabelText(/Why are you making/), 'Wrong count');
    await user.click(billButton('INV-1'));
    expect(await screen.findByText('Bill b1')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Bill preview' })).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Why are you making/)).toHaveValue('Wrong count');

    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows only the closed-year message and a Close button in closed-year mode', async () => {
    const { user, onCancel, onConfirm } = renderDialog({
      affected: [{ billId: 'b1', billNumber: 'INV-1', status: 'sent', issued: true }],
      negative: [],
      requiresReason: true,
      blocked: 'closedYear',
      closedYear: '2025-26',
    });
    const dialog = screen.getByRole('dialog', { name: 'This year is closed' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      "FY 2025-26 is closed for this site. Anything dated on or before 31 Mar 2026 can't be changed."
    );
    expect(within(dialog).queryByRole('button', { name: /INV-1/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Why are you making/)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Save change' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByText('Close'));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
