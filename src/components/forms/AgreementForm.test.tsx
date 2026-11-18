import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { AgreementForm } from './AgreementForm';
import { renderWithProviders } from '../../test/render';
import type { Agreement, Inventory, Site } from '../../types';

const inv = (over: Partial<Inventory>) =>
  ({
    _id: 'i1',
    code: 'CUP2',
    name: 'Cuplock 2m',
    category: 'Scaffolding',
    unit: 'pcs',
    defaultRatePerDay: 5,
    ...over,
  }) as Inventory;

const items = [
  inv({}),
  inv({ _id: 'i2', code: 'PROP', name: 'Steel prop', defaultRatePerDay: 3 }),
  inv({ _id: 'i3', code: 'LAD', name: 'Ladder', category: 'Access', defaultRatePerDay: undefined }),
];
const sites: Site[] = [
  { code: 'S1', address: 'Plot 12 Andheri East' },
  { code: 'S2', address: 'A very long site address that goes well past the fifty character limit' },
];

function setup(existing: Agreement[] = []) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const utils = renderWithProviders(
    <AgreementForm
      inventoryItems={items}
      sites={sites}
      existingAgreements={existing}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
  return { ...utils, onSubmit, onCancel };
}

const submit = () => screen.getByRole('button', { name: /^create agreement$/i });

describe('AgreementForm', () => {
  it('submits the exact payload with category-added rates and edited values', async () => {
    const { user, onSubmit } = setup();
    await user.selectOptions(screen.getByLabelText(/^site/i), 'S1');
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-01-05' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-12-31' } });
    await user.selectOptions(screen.getByLabelText(/billing cycle/i), 'weekly');
    const due = screen.getByLabelText(/payment due/i);
    await user.clear(due);
    await user.type(due, '30');
    const dep = screen.getByLabelText(/security deposit/i);
    await user.clear(dep);
    await user.type(dep, '5000');
    await user.clear(screen.getByLabelText(/delivery cartage/i));
    await user.type(screen.getByLabelText(/delivery cartage/i), '250.5');
    await user.clear(screen.getByLabelText(/return cartage/i));
    await user.type(screen.getByLabelText(/return cartage/i), '100');
    await user.clear(screen.getByLabelText(/^loading charge/i));
    await user.type(screen.getByLabelText(/^loading charge/i), '10');
    await user.clear(screen.getByLabelText(/unloading charge/i));
    await user.type(screen.getByLabelText(/unloading charge/i), '20');

    await user.click(screen.getByRole('checkbox', { name: /scaffolding/i }));
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const [rate, opening] = within(rows[0]).getAllByRole('spinbutton');
    await user.clear(rate);
    await user.type(rate, '7.5');
    await user.clear(opening);
    await user.type(opening, '12');

    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      siteCode: 'S1',
      startDate: '2026-01-05',
      endDate: '2026-12-31',
      terms: {
        billingCycle: 'weekly',
        paymentDueDays: 30,
        securityDeposit: 5000,
        deliveryCartage: 250.5,
        returnCartage: 100,
        loadingCharge: 10,
        unloadingCharge: 20,
      },
      rates: [
        { itemId: 'i1', ratePerDay: 7.5, openingBalance: 12 },
        { itemId: 'i2', ratePerDay: 3, openingBalance: 0 },
      ],
    });
  });

  it('defaults terms and omits the end date when empty', async () => {
    const { user, onSubmit } = setup();
    await user.selectOptions(screen.getByLabelText(/^site/i), 'S1');
    await user.click(screen.getByRole('checkbox', { name: /access/i }));
    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const body = onSubmit.mock.calls[0][0];
    expect(body.endDate).toBeUndefined();
    expect(body.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.terms).toEqual({
      billingCycle: 'monthly',
      paymentDueDays: 15,
      securityDeposit: 0,
      deliveryCartage: 0,
      returnCartage: 0,
      loadingCharge: 0,
      unloadingCharge: 0,
    });
    expect(body.rates).toEqual([{ itemId: 'i3', ratePerDay: 0, openingBalance: 0 }]);
  });

  it('shows validation messages and does not submit', async () => {
    const { user, onSubmit } = setup();
    await user.click(submit());
    expect(await screen.findByText('Add at least one item rate')).toBeInTheDocument();
    // the placeholder option and the error message
    expect(screen.getAllByText('Select a site')).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('select all adds every item, keeps edited rates across toggles, and unselects', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('checkbox', { name: /select all/i }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4);
    const first = within(within(screen.getByRole('table')).getAllByRole('row')[1]).getAllByRole(
      'spinbutton'
    )[0];
    await user.clear(first);
    await user.type(first, '9');
    await user.click(screen.getByRole('checkbox', { name: /^access/i }));
    await user.click(screen.getByRole('checkbox', { name: /^access/i }));
    const again = within(within(screen.getByRole('table')).getAllByRole('row')[1]).getAllByRole(
      'spinbutton'
    )[0];
    expect(again).toHaveValue(9);
    await user.click(screen.getByRole('checkbox', { name: /unselect all/i }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('only offers sites without an active agreement', () => {
    setup([{ siteCode: 'S1', status: 'active' } as Agreement]);
    const select = screen.getByLabelText(/^site/i);
    expect(within(select).queryByRole('option', { name: /^S1/ })).not.toBeInTheDocument();
    expect(within(select).getByRole('option', { name: /^S2 - .*\.\.\.$/ })).toBeInTheDocument();
  });

  it('warns when no sites or inventory are available and cancels', async () => {
    const onCancel = vi.fn();
    const { user } = renderWithProviders(
      <AgreementForm
        inventoryItems={[]}
        sites={[]}
        existingAgreements={[]}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText(/no sites available/i)).toBeInTheDocument();
    expect(screen.getByText(/no inventory items available/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables the controls while loading', () => {
    renderWithProviders(
      <AgreementForm
        inventoryItems={items}
        sites={sites}
        existingAgreements={[]}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isLoading
      />
    );
    expect(screen.getByLabelText(/^site/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });
});
