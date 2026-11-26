import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, signedIn } from '../../test/render';
import { server } from '../../test/msw/server';
import { apiUrl, ok } from '../../test/msw/handlers';
import { makeBill, makeBillItem } from '../../test/factories';
import { BillPreviewPanel } from './BillPreviewPanel';
import type { Bill } from '../../types';

function useBill(bill: Bill | 'error' | 'pending') {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([])),
    http.get(apiUrl('/businesses/biz-1/bills/:billId'), () => {
      if (bill === 'error') {
        return HttpResponse.json({ success: false, error: { message: 'Nope' } }, { status: 404 });
      }
      if (bill === 'pending') return new Promise<never>(() => {});
      return ok(bill);
    })
  );
}

function renderPanel(props: Partial<Parameters<typeof BillPreviewPanel>[0]> = {}) {
  const onClose = vi.fn();
  const view = renderWithProviders(
    <BillPreviewPanel billId="b1" billNumber="INV-9" onClose={onClose} {...props} />,
    { preloadedState: signedIn('biz-1') }
  );
  return { ...view, onClose };
}

describe('BillPreviewPanel', () => {
  it('shows the bill number, status, period and money through the bill money helpers', async () => {
    // notesTotal -800: effective ₹11,000; paid ₹1,000 → balance ₹10,000
    useBill(makeBill({ _id: 'b1', billNumber: 'INV-2026-27-0042', notesTotal: -800 }));
    renderPanel();

    expect(await screen.findByText('INV-2026-27-0042')).toBeInTheDocument();
    const panel = screen.getByRole('region', { name: 'Bill preview' });
    expect(within(panel).getByText('Sent')).toBeInTheDocument();
    expect(within(panel).getByText('Period').nextSibling).toHaveTextContent('1 Oct – 31 Oct');
    expect(within(panel).getByText('Bill date').nextSibling).toHaveTextContent('1 Nov');
    expect(within(panel).getByText('Bill total').nextSibling).toHaveTextContent('₹11,000');
    expect(within(panel).getByText('Paid').nextSibling).toHaveTextContent('₹1,000');
    expect(within(panel).getByText('Balance').nextSibling).toHaveTextContent('₹10,000');
  });

  it('falls back to the period end when the bill has no bill date', async () => {
    useBill(makeBill({ _id: 'b1', billDate: undefined }));
    renderPanel();
    expect((await screen.findByText('Bill date')).nextSibling).toHaveTextContent('31 Oct');
  });

  it('lists at most six item lines and says how many more there are', async () => {
    const items = Array.from({ length: 8 }, (_, i) =>
      makeBillItem({ itemName: `Prop ${i + 1}`, quantity: i + 1, amount: 100 * (i + 1) })
    );
    useBill(makeBill({ _id: 'b1', items }));
    renderPanel();

    const table = await screen.findByRole('table', { name: 'Bill items' });
    expect(within(table).getAllByRole('row')).toHaveLength(7); // header + 6
    expect(within(table).getByText('Prop 6')).toBeInTheDocument();
    expect(within(table).queryByText('Prop 7')).not.toBeInTheDocument();
    expect(within(table).getByText('₹600')).toBeInTheDocument();
    expect(screen.getByText('+ 2 more items')).toBeInTheDocument();
  });

  it('shows no "more items" line for a short bill', async () => {
    useBill(makeBill({ _id: 'b1' }));
    renderPanel();
    await screen.findByRole('table', { name: 'Bill items' });
    expect(screen.queryByText(/more items/)).not.toBeInTheDocument();
  });

  it('opens the full bill in a new tab', async () => {
    useBill(makeBill({ _id: 'b1' }));
    renderPanel();
    const link = await screen.findByRole('link', { name: 'Open full bill' });
    expect(link).toHaveAttribute('href', '/bills/b1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
  });

  it('shows a spinner and the bill number while loading', async () => {
    useBill('pending');
    renderPanel();
    expect(await screen.findByRole('status')).toHaveTextContent('Loading');
    expect(screen.getByText('INV-9')).toBeInTheDocument();
  });

  it('says it could not load the bill when the fetch fails', async () => {
    useBill('error');
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load this bill.");
  });

  it('closes from the close button, and Back defaults to close', async () => {
    useBill(makeBill({ _id: 'b1' }));
    const { user, onClose } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Close bill' }));
    await user.click(screen.getByRole('button', { name: 'Back to the change' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('calls onBack from the Back button when given', async () => {
    useBill(makeBill({ _id: 'b1' }));
    const onBack = vi.fn();
    const { user, onClose } = renderPanel({ onBack });
    await user.click(screen.getByRole('button', { name: 'Back to the change' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape and marks the key as handled', async () => {
    useBill(makeBill({ _id: 'b1' }));
    const { user, onClose } = renderPanel();
    let prevented = false;
    const after = (e: KeyboardEvent) => (prevented = e.defaultPrevented);
    document.addEventListener('keydown', after);
    await user.keyboard('{Escape}');
    document.removeEventListener('keydown', after);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(prevented).toBe(true);
  });

  it('ignores other keys', async () => {
    useBill(makeBill({ _id: 'b1' }));
    const { user, onClose } = renderPanel();
    await user.keyboard('a');
    expect(onClose).not.toHaveBeenCalled();
  });
});
