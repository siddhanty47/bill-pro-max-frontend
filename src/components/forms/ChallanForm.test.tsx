import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { ChallanForm } from './ChallanForm';
import { renderWithProviders, signedIn } from '../../test/render';
import { server } from '../../test/msw/server';
import { apiUrl, ok } from '../../test/msw/handlers';
import type { Challan, ExtractedChallanData, Inventory, Party } from '../../types';

const party = (over: Partial<Party> = {}) =>
  ({
    _id: 'p1',
    code: 'MEHT',
    name: 'Mehta Builders',
    roles: ['client'],
    contact: { person: 'Rakesh', phone: '98' },
    sites: [{ code: 'S1', address: 'Plot 12', stateCode: '27' }],
    agreements: [
      {
        agreementId: 'AG-1',
        status: 'active',
        siteCode: 'S1',
        startDate: '2026-04-01',
        rates: [{ itemId: 'i1', ratePerDay: 2, openingBalance: 0 }],
        terms: {
          billingCycle: 'monthly',
          deliveryCartage: 500,
          returnCartage: 300,
          loadingCharge: 100,
          unloadingCharge: 50,
        },
      },
      {
        agreementId: 'AG-0',
        status: 'closed',
        siteCode: 'S1',
        startDate: '2025-04-01',
        rates: [],
        terms: {},
      },
    ],
    ...over,
  }) as unknown as Party;

const inv = (over: Partial<Inventory>) =>
  ({
    businessId: 'biz-1',
    category: 'Pipes',
    totalQuantity: 100,
    unit: 'pcs',
    isActive: true,
    quantityHistory: [],
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Inventory;

const inventory = [
  inv({ _id: 'i1', code: 'PIPE', name: 'Steel Pipe', damageRate: 150, costPrice: 900 }),
  inv({ _id: 'i2', code: 'CLMP', name: 'Clamp', damageRate: 20, costPrice: 40 }),
];

const transporter = {
  _id: 't1',
  name: 'Ramesh',
  type: 'transporter',
  details: { vehicleNumber: 'MH12AB1234' },
};

function setup({
  type = 'delivery' as 'delivery' | 'return',
  parties = [party()],
  challans = [] as Challan[],
  isLoading = false,
  nextNumberFails = false,
} = {}) {
  server.use(
    http.get(apiUrl('/businesses/biz-1/challans/next-number'), () =>
      nextNumberFails
        ? HttpResponse.json({ success: false }, { status: 500 })
        : ok(type === 'delivery' ? 'D-2026-27-0007' : 'R-2026-27-0003')
    ),
    http.get(apiUrl('/businesses/biz-1/challans/items-with-party/p1'), () =>
      ok([{ itemId: 'i1', itemName: 'Steel Pipe', quantity: 12 }])
    ),
    http.get(apiUrl('/businesses/biz-1/employees'), () => ok([transporter]))
  );
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const utils = renderWithProviders(
    <ChallanForm
      businessId="biz-1"
      type={type}
      parties={parties}
      inventoryItems={inventory}
      challans={challans}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isLoading={isLoading}
    />,
    { preloadedState: signedIn() }
  );
  return { ...utils, onSubmit, onCancel };
}

type User = ReturnType<typeof setup>['user'];

const partyInput = () => screen.getByRole('combobox', { name: /^party/i });
/** Item pickers of both grids (items, then loss rows). */
const itemInputs = () => screen.getAllByRole('combobox', { name: /item for row/i });
const qtyInputs = () => screen.getAllByLabelText(/quantity for row/i);
const submit = () => screen.getByRole('button', { name: /^create challan$/i });
const deleteButtons = () => screen.getAllByRole('button', { name: /^remove (loss )?row/i });

async function pickParty(user: User) {
  await user.type(partyInput(), 'MEH');
  await user.click(await screen.findByRole('option', { name: /Mehta Builders/ }));
  await user.selectOptions(screen.getByLabelText(/^agreement/i), 'AG-1');
}

async function pickItem(user: User, input: HTMLElement, query: string, name: RegExp) {
  await user.type(input, query);
  await user.click(await screen.findByRole('option', { name }));
}

describe('ChallanForm', () => {
  it('submits the exact delivery payload', async () => {
    const { user, onSubmit } = setup();
    expect(await screen.findByDisplayValue('7')).toBeInTheDocument();
    expect(screen.getByText('D-2026-27-')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^date/i), { target: { value: '2026-11-01' } });
    await pickParty(user);
    await waitFor(() => expect(screen.getByLabelText(/^cartage/i)).toHaveValue(500));
    await pickItem(user, itemInputs()[0], 'pi', /Steel Pipe/);
    const qty = qtyInputs()[0];
    await user.clear(qty);
    await user.type(qty, '25');
    await user.type(screen.getByLabelText(/^notes/i), 'Handle with care');
    await user.selectOptions(screen.getByLabelText(/^transporter$/i), 't1');
    expect(screen.getByLabelText(/^vehicle number/i)).toHaveValue('MH12AB1234');
    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      type: 'delivery',
      partyId: 'p1',
      agreementId: 'AG-1',
      date: '2026-11-01',
      challanSequence: 7,
      items: [{ itemId: 'i1', itemName: 'Steel Pipe', quantity: 25 }],
      damagedItems: undefined,
      notes: 'Handle with care',
      transporterName: 'Ramesh',
      vehicleNumber: 'MH12AB1234',
      cartageCharge: 500,
      loadingCharge: 100,
      unloadingCharge: 50,
    });
  });

  it('submits the exact return payload with damaged items', async () => {
    const { user, onSubmit } = setup({ type: 'return' });
    expect(await screen.findByDisplayValue('3')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^date/i), { target: { value: '2026-11-02' } });
    await pickParty(user);
    await waitFor(() => expect(screen.getByLabelText(/^cartage/i)).toHaveValue(300));
    await pickItem(user, itemInputs()[0], 'pi', /Steel Pipe/);

    await user.click(screen.getByRole('button', { name: /add loss item/i }));
    await pickItem(user, itemInputs()[1], 'cl', /Clamp/);
    expect(screen.getByDisplayValue('20')).toBeInTheDocument(); // damage rate
    await user.selectOptions(screen.getByLabelText('Loss type for row 1'), 'short');
    expect(screen.getByDisplayValue('40')).toBeInTheDocument(); // cost price for short
    const lossQty = screen.getByLabelText('Loss quantity for row 1');
    await user.clear(lossQty);
    await user.type(lossQty, '2');
    await user.type(screen.getByLabelText('Note for row 1'), 'Bent');

    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      type: 'return',
      partyId: 'p1',
      agreementId: 'AG-1',
      date: '2026-11-02',
      challanSequence: 3,
      items: [{ itemId: 'i1', itemName: 'Steel Pipe', quantity: 1 }],
      damagedItems: [
        {
          itemId: 'i2',
          itemName: 'Clamp',
          quantity: 2,
          damageRate: 40,
          note: 'Bent',
          lossType: 'short',
        },
      ],
      notes: undefined,
      transporterName: undefined,
      vehicleNumber: undefined,
      cartageCharge: 300,
      loadingCharge: 100,
      unloadingCharge: 50,
    });
  });

  it('submits with blank charges and a blank number as undefined (previously failed silently)', async () => {
    const bare = party();
    bare.agreements = [{ ...bare.agreements![0], terms: { billingCycle: 'monthly' } }] as never;
    const { user, onSubmit } = setup({ parties: [bare] });
    const sequence = await screen.findByDisplayValue('7');
    fireEvent.change(screen.getByLabelText(/^date/i), { target: { value: '2026-11-01' } });
    await pickParty(user);
    await pickItem(user, itemInputs()[0], 'pi', /Steel Pipe/);
    await user.clear(sequence);
    expect(screen.getByLabelText(/^cartage/i)).toHaveValue(null);
    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      type: 'delivery',
      partyId: 'p1',
      agreementId: 'AG-1',
      date: '2026-11-01',
      challanSequence: undefined,
      items: [{ itemId: 'i1', itemName: 'Steel Pipe', quantity: 1 }],
      damagedItems: undefined,
      notes: undefined,
      transporterName: undefined,
      vehicleNumber: undefined,
      cartageCharge: undefined,
      loadingCharge: undefined,
      unloadingCharge: undefined,
    });
  });

  it('submits typed charges and an edited number as numbers', async () => {
    const bare = party();
    bare.agreements = [{ ...bare.agreements![0], terms: { billingCycle: 'monthly' } }] as never;
    const { user, onSubmit } = setup({ parties: [bare] });
    const sequence = await screen.findByDisplayValue('7');
    await pickParty(user);
    await pickItem(user, itemInputs()[0], 'pi', /Steel Pipe/);
    await user.clear(sequence);
    await user.type(sequence, '42');
    await user.type(screen.getByLabelText(/^cartage/i), '250.5');
    await user.type(screen.getByLabelText(/^loading/i), '0');
    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      challanSequence: 42,
      cartageCharge: 250.5,
      loadingCharge: 0,
      unloadingCharge: undefined,
    });
  });

  it('stacks grid rows on phones: header row and phone-only cell labels are marked for CSS', async () => {
    const { user } = setup({ type: 'return' });
    await user.click(screen.getByRole('button', { name: /add loss item/i }));
    const items = screen.getByRole('table', { name: 'Items' });
    const [head, row] = within(items).getAllByRole('row');
    expect(head.className).toMatch(/headRow/);
    expect(row.className).toMatch(/itemRow/);
    const loss = screen.getByRole('table', { name: 'Loss items' });
    expect(within(loss).getAllByRole('row')[1].className).toMatch(/lossRow/);
    // Phone labels repeat the hidden header; the controls keep their own names.
    const labels = row.querySelectorAll('span[aria-hidden="true"]');
    expect([...labels].map(l => l.textContent)).toEqual(['Qty', 'Running']);
    expect(labels[0].className).toMatch(/phoneLabel/);
  });

  it('has no loss section on deliveries', () => {
    setup();
    expect(screen.queryByRole('button', { name: /add loss item/i })).not.toBeInTheDocument();
  });

  it('selects an item with the keyboard and shows the running quantity', async () => {
    const { user } = setup();
    await pickParty(user);
    await user.type(itemInputs()[0], 'pi');
    await screen.findAllByRole('option');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(itemInputs()[0]).toHaveValue('PIPE');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    // Running stock with the party for this agreement (items-with-party API).
    expect(await screen.findByText('12')).toBeInTheDocument();
  });

  it('adds and removes item rows; the last row cannot be removed', async () => {
    const { user } = setup();
    expect(itemInputs()).toHaveLength(1);
    expect(deleteButtons()[0]).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /add item/i }));
    expect(itemInputs()).toHaveLength(2);
    expect(deleteButtons()[0]).toBeEnabled();
    await user.click(deleteButtons()[1]);
    expect(itemInputs()).toHaveLength(1);
  });

  it('removes a loss row', async () => {
    const { user } = setup({ type: 'return' });
    await user.click(screen.getByRole('button', { name: /add loss item/i }));
    expect(itemInputs()).toHaveLength(2);
    await user.click(deleteButtons()[1]);
    expect(itemInputs()).toHaveLength(1);
  });

  it('names each empty or invalid grid row instead of failing silently', async () => {
    const { user, onSubmit } = setup({ type: 'return' });
    await pickParty(user);
    await pickItem(user, itemInputs()[0], 'pi', /Steel Pipe/);
    await user.click(screen.getByRole('button', { name: /add item/i }));
    fireEvent.change(qtyInputs()[0], { target: { value: '1.5' } });
    await user.click(screen.getByRole('button', { name: /add loss item/i }));
    await user.click(submit());
    expect(await screen.findByText('Row 2: Select an item')).toBeInTheDocument();
    expect(screen.getByText('Row 1: Quantity must be a whole number')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity for row 1')).toHaveAttribute('aria-invalid', 'true');
    // Loss grid has its own message list.
    expect(screen.getAllByText('Row 1: Select an item')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Rate for row 1'), { target: { value: '-1' } });
    fireEvent.change(screen.getByLabelText('Loss quantity for row 1'), { target: { value: '' } });
    await user.click(submit());
    expect(await screen.findByText('Row 1: Select an item')).toBeInTheDocument();
    expect(screen.getByLabelText('Loss quantity for row 1')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByLabelText('Rate for row 1')).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('marks required header fields with one star and keeps the grid numbers mono', () => {
    setup();
    expect(screen.getByText(/^Party/, { selector: 'label' }).textContent).toBe('Party *');
    expect(screen.getByText(/^Agreement/, { selector: 'label' }).textContent).toBe('Agreement *');
    expect(screen.getByText(/^Date/, { selector: 'label' }).textContent).toBe('Date *');
    expect(qtyInputs()[0].className).toMatch(/mono/);
    expect(screen.getByRole('table', { name: 'Items' })).toBeInTheDocument();
  });

  it('shows required messages and does not submit', async () => {
    const { user, onSubmit } = setup();
    await user.click(submit());
    expect(await screen.findByText('Select a party')).toBeInTheDocument();
    expect(screen.getByText('Select an agreement')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('only lists active agreements and needs a party first', async () => {
    const { user } = setup();
    expect(screen.getByLabelText(/^agreement/i)).toBeDisabled();
    await user.type(partyInput(), 'MEH');
    await user.click(await screen.findByRole('option', { name: /Mehta Builders/ }));
    expect(screen.getByLabelText(/^agreement/i)).toBeEnabled();
    expect(screen.getByRole('option', { name: /^AG-1/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^AG-0/ })).not.toBeInTheDocument();
  });

  it('predicts the number locally when the API fails', async () => {
    const existing = [
      { challanNumber: 'D-2026-27-0001' },
      { challanNumber: 'D-2026-27-0002' },
      { challanNumber: 'R-2026-27-0001' },
    ] as Challan[];
    setup({ challans: existing, nextNumberFails: true });
    expect(await screen.findByDisplayValue('3')).toBeInTheDocument();
    expect(screen.getByText('D-2026-27-')).toBeInTheDocument();
  });

  it('disables the controls while saving', () => {
    setup({ isLoading: true });
    expect(partyInput()).toBeDisabled();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDisabled();
  });

  it('clears transporter details when the selection is cleared', async () => {
    const { user } = setup();
    const select = screen.getByLabelText(/^transporter$/i);
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2));
    await user.selectOptions(select, 't1');
    expect(screen.getByLabelText(/^transporter name/i)).toHaveValue('Ramesh');
    await user.selectOptions(select, '');
    expect(screen.getByLabelText(/^transporter name/i)).toHaveValue('');
    expect(screen.getByLabelText(/^vehicle number/i)).toHaveValue('');
  });

  it('cancels', async () => {
    const { user, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  describe('scan from photo', () => {
    const extracted = (over: Partial<ExtractedChallanData> = {}): ExtractedChallanData => ({
      type: 'return',
      challanNumber: 'R-12',
      date: '2026-10-30',
      partyName: 'Mehta',
      partyId: 'p1',
      partyGstin: '27ABCDE1234F1Z5',
      siteAddress: 'Plot 12',
      agreementId: 'AG-1',
      items: [
        { itemName: 'Steel Pipe', itemId: 'i1', quantity: 40 },
        { itemName: 'Mystery bolt', itemId: null, quantity: 3 },
      ],
      damagedItems: [{ itemName: 'Clamp', itemId: 'i2', quantity: 2 }],
      transporterName: 'Suresh',
      vehicleNumber: 'GJ01XY9999',
      cartageAmount: 750,
      confidence: 'medium',
      warnings: ['Quantity column total does not match'],
      ...over,
    });

    const photo = () => new File(['x'], 'challan.jpg', { type: 'image/jpeg' });
    const fileInput = (container: HTMLElement) =>
      container.querySelector('input[type="file"]') as HTMLInputElement;

    it('applies the extracted data and shows the review', async () => {
      const { user, container, onSubmit } = setup({ type: 'return' });
      let uploaded = false;
      server.use(
        http.post(apiUrl('/businesses/biz-1/challans/extract-from-photo'), async ({ request }) => {
          uploaded = (request.headers.get('content-type') ?? '').includes('multipart/form-data');
          return ok(extracted());
        })
      );
      await screen.findByDisplayValue('3');
      await user.upload(fileInput(container), photo());

      expect(await screen.findByText('Scan review')).toBeInTheDocument();
      expect(uploaded).toBe(true);
      expect(partyInput()).toHaveValue('MEHT');
      expect(screen.getByLabelText(/^date/i)).toHaveValue('2026-10-30');
      expect(screen.getByDisplayValue('12')).toBeInTheDocument(); // sequence from "R-12"
      expect(itemInputs().map(i => (i as HTMLInputElement).value)).toEqual([
        'PIPE',
        'Mystery bolt',
        'CLMP',
      ]);
      expect(qtyInputs().map(i => (i as HTMLInputElement).value)).toEqual(['40', '3', '2']);
      expect(screen.getByLabelText(/^vehicle number/i)).toHaveValue('GJ01XY9999');
      expect(screen.getByLabelText(/^transporter name/i)).toHaveValue('Suresh');

      expect(screen.getByText(/medium confidence/i)).toBeInTheDocument();
      expect(screen.getByText('27ABCDE1234F1Z5')).toBeInTheDocument();
      expect(
        within(screen.getByRole('table', { name: 'Read from photo' })).getByText(/Mystery bolt/)
      ).toBeInTheDocument();
      expect(screen.getByText('Quantity column total does not match')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(screen.queryByText('Scan review')).not.toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('keeps the scanned cartage when no agreement was matched, and submits once fixed', async () => {
      const { user, container, onSubmit } = setup({ type: 'return' });
      server.use(
        http.post(apiUrl('/businesses/biz-1/challans/extract-from-photo'), () =>
          ok(
            extracted({
              agreementId: null,
              items: [{ itemName: 'Steel Pipe', itemId: 'i1', quantity: 40 }],
              damagedItems: [],
              confidence: 'high',
              warnings: [],
            })
          )
        )
      );
      await screen.findByDisplayValue('3');
      await user.upload(fileInput(container), photo());
      expect(await screen.findByText(/high confidence/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^cartage/i)).toHaveValue(750);
      await user.selectOptions(screen.getByLabelText(/^agreement/i), 'AG-1');
      // Picking the agreement applies its return cartage, as before.
      await waitFor(() => expect(screen.getByLabelText(/^cartage/i)).toHaveValue(300));
      await user.click(submit());
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][0]).toEqual({
        type: 'return',
        partyId: 'p1',
        agreementId: 'AG-1',
        date: '2026-10-30',
        challanSequence: 12,
        items: [{ itemId: 'i1', itemName: 'Steel Pipe', quantity: 40 }],
        damagedItems: undefined,
        notes: undefined,
        transporterName: 'Suresh',
        vehicleNumber: 'GJ01XY9999',
        cartageCharge: 300,
        loadingCharge: 100,
        unloadingCharge: 50,
      });
    });

    it('shows the API error', async () => {
      const { user, container } = setup();
      server.use(
        http.post(apiUrl('/businesses/biz-1/challans/extract-from-photo'), () =>
          HttpResponse.json({ success: false, message: 'Could not read photo' }, { status: 422 })
        )
      );
      await user.upload(fileInput(container), photo());
      expect(await screen.findByText('Could not read photo')).toBeInTheDocument();
      expect(screen.queryByText('Scan review')).not.toBeInTheDocument();
    });

    it('rejects photos over 5MB without uploading', async () => {
      const { user, container } = setup();
      const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.jpg', {
        type: 'image/jpeg',
      });
      await user.upload(fileInput(container), big);
      expect(
        await screen.findByText('Image must be under 5MB. Please use a smaller photo.')
      ).toBeInTheDocument();
    });
  });
});
