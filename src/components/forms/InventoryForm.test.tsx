import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { InventoryForm } from './InventoryForm';
import { renderWithProviders, signedIn } from '../../test/render';
import { server } from '../../test/msw/server';
import { apiUrl, ok } from '../../test/msw/handlers';
import type { Inventory } from '../../types';

function setup(props: Partial<React.ComponentProps<typeof InventoryForm>> = {}, exists = false) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([])),
    http.get(apiUrl('/businesses/biz-1/inventory/categories'), () => ok(['Scaffolding'])),
    http.get(apiUrl('/businesses/biz-1/inventory/check-code'), () => ok({ exists })),
    http.get(apiUrl('/businesses/biz-1/inventory/generate-code'), ({ request }) =>
      ok({ code: `GEN-${new URL(request.url).searchParams.get('name') ?? ''}` })
    )
  );
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const utils = renderWithProviders(
    <InventoryForm onSubmit={onSubmit} onCancel={onCancel} {...props} />,
    { preloadedState: signedIn() }
  );
  return { ...utils, onSubmit, onCancel };
}

async function fillRequired(user: ReturnType<typeof setup>['user']) {
  await user.type(screen.getByLabelText(/Item name/i), 'Cuplock 2m');
  await user.tab();
  const code = screen.getByLabelText(/Item code/i);
  await waitFor(() => expect(code).not.toHaveValue(''));
  await user.clear(code);
  await user.type(code, 'cup2');
  await user.type(screen.getByPlaceholderText(/category/i), 'Scaffolding');
  const qty = screen.getByLabelText(/Total quantity/i);
  await user.clear(qty);
  await user.type(qty, '40');
}

describe('InventoryForm', () => {
  it('fills the code from the item name when the code is empty', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/Item name/i), 'Prop 2x2');
    await user.tab();
    await waitFor(() => expect(screen.getByLabelText(/Item code/i)).toHaveValue('GEN-Prop 2x2'));
  });

  it('keeps a code the user already typed', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/Item code/i), 'MINE');
    await user.type(screen.getByLabelText(/Item name/i), 'Prop 2x2');
    await user.tab();
    await new Promise(r => setTimeout(r, 50));
    expect(screen.getByLabelText(/Item code/i)).toHaveValue('MINE');
  });

  it('submits the exact payload for a full fill', async () => {
    const { user, onSubmit } = setup();
    await fillRequired(user);
    await user.type(screen.getByLabelText(/Daily rate/i), '12.5');
    await user.type(screen.getByLabelText(/Damage charge/i), '300');
    await user.type(screen.getByLabelText(/Cost price/i), '450');
    await user.type(screen.getByLabelText(/Description/i), 'Standard');
    await user.selectOptions(screen.getByLabelText(/Unit/i), 'meters');
    await user.click(screen.getByRole('button', { name: /^Add item$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      code: 'CUP2',
      name: 'Cuplock 2m',
      category: 'Scaffolding',
      totalQuantity: 40,
      unit: 'meters',
      description: 'Standard',
      defaultRatePerDay: 12.5,
      damageRate: 300,
      costPrice: 450,
    });
  });

  it('submits with empty optional numbers omitted (previously failed silently)', async () => {
    const { user, onSubmit } = setup();
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: /^Add item$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.defaultRatePerDay).toBeUndefined();
    expect(payload.damageRate).toBeUndefined();
    expect(payload.costPrice).toBeUndefined();
    expect(payload.totalQuantity).toBe(40);
  });

  it('shows required-field messages and does not submit', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('button', { name: /^Add item$/i }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Code is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('labels the category autocomplete with exactly one star', () => {
    setup();
    expect(screen.getByLabelText(/^category/i)).toHaveAttribute('role', 'combobox');
    expect(screen.getByText(/^Category/, { selector: 'label' }).textContent).toBe('Category *');
  });

  it('blocks submit when the code already exists', async () => {
    const { user, onSubmit } = setup({}, true);
    await fillRequired(user);
    await user.click(screen.getByLabelText(/item code/i));
    await user.tab();
    expect(await screen.findByText('This code already exists')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Add item$/i }));
    await waitFor(() => expect(screen.getByText('This code already exists')).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('edits an existing item, keeps its code without a uniqueness check, and cancels', async () => {
    const item = {
      _id: 'i1',
      code: 'CUP2',
      name: 'Cuplock',
      category: 'Scaffolding',
      totalQuantity: 10,
      unit: 'pcs',
      description: 'd',
      defaultRatePerDay: 5,
      damageRate: 1,
      costPrice: 2,
    } as Inventory;
    const { user, onSubmit, onCancel } = setup({ initialData: item }, true);
    await user.click(screen.getByLabelText(/Item code/i));
    await user.tab();
    expect(screen.queryByText('This code already exists')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^update item$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      code: 'CUP2',
      name: 'Cuplock',
      totalQuantity: 10,
      defaultRatePerDay: 5,
    });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
