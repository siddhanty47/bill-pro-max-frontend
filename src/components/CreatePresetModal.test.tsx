import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { CreatePresetModal } from './CreatePresetModal';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { Inventory } from '../types';

const inventory = [
  {
    _id: 'i1',
    code: 'CUP2',
    name: 'Cuplock 2m',
    category: 'Scaffolding',
    unit: 'pieces',
    description: 'Standard',
    defaultRatePerDay: 12,
    damageRate: 300,
  },
  {
    _id: 'i2',
    code: 'LAD1',
    name: 'Ladder 1m',
    category: 'Access',
    unit: 'pieces',
  },
] as unknown as Inventory[];

function setup(items: Inventory[] = inventory) {
  const onClose = vi.fn();
  const bodies: unknown[] = [];
  server.use(
    http.post(apiUrl('/businesses/biz-1/presets'), async ({ request }) => {
      bodies.push(await request.json());
      return ok({ _id: 'p1' });
    })
  );
  const utils = renderWithProviders(
    <CreatePresetModal isOpen onClose={onClose} businessId="biz-1" inventory={items} />,
    { preloadedState: signedIn() }
  );
  return { ...utils, onClose, bodies };
}

describe('CreatePresetModal', () => {
  it('lists inventory and keeps submit disabled until an item is picked', async () => {
    setup();
    expect(screen.getByText('Cuplock 2m')).toBeInTheDocument();
    expect(screen.getByText('Ladder 1m')).toBeInTheDocument();
    expect(screen.getByText(/0 items selected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^create preset$/i })).toBeDisabled();
  });

  it('submits the exact payload and closes', async () => {
    const { user, onClose, bodies } = setup();
    await user.type(screen.getByLabelText(/preset name/i), '  Starter kit ');
    await user.type(screen.getByLabelText(/description/i), '  For new sites ');
    await user.click(screen.getByRole('checkbox', { name: /CUP2/i }));
    await user.click(screen.getByRole('checkbox', { name: /LAD1/i }));
    expect(screen.getByText(/2 items selected/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^create preset$/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodies).toEqual([
      {
        name: 'Starter kit',
        description: 'For new sites',
        items: [
          {
            code: 'CUP2',
            name: 'Cuplock 2m',
            category: 'Scaffolding',
            unit: 'pieces',
            description: 'Standard',
            defaultRatePerDay: 12,
            damageRate: 300,
          },
          { code: 'LAD1', name: 'Ladder 1m', category: 'Access', unit: 'pieces' },
        ],
      },
    ]);
  });

  it('omits a blank description', async () => {
    const { user, bodies, onClose } = setup();
    await user.type(screen.getByLabelText(/preset name/i), 'Only name');
    await user.click(screen.getByRole('checkbox', { name: /LAD1/i }));
    await user.click(screen.getByRole('button', { name: /^create preset$/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((bodies[0] as { description?: string }).description).toBeUndefined();
  });

  it('filters by search, selects all filtered, and clears', async () => {
    const { user } = setup();
    await user.type(screen.getByPlaceholderText(/search items/i), 'ladder');
    expect(screen.queryByText('Cuplock 2m')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /select all/i }));
    expect(screen.getByText(/1 items selected/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^clear$/i }));
    expect(screen.getByText(/0 items selected/i)).toBeInTheDocument();
  });

  it('shows a message when the search matches nothing', async () => {
    const { user } = setup();
    await user.type(screen.getByPlaceholderText(/search items/i), 'zzzz');
    expect(await screen.findByText(/no items match your search/i)).toBeInTheDocument();
  });

  it('shows an empty state when the business has no inventory', () => {
    setup([]);
    expect(screen.getByText(/no items yet/i)).toBeInTheDocument();
  });

  it('toggles an item by clicking its row', async () => {
    const { user } = setup();
    await user.click(screen.getByText('Cuplock 2m'));
    expect(screen.getByRole('checkbox', { name: /CUP2/i })).toBeChecked();
    await user.click(screen.getByText('Cuplock 2m'));
    expect(screen.getByRole('checkbox', { name: /CUP2/i })).not.toBeChecked();
  });

  it('requires a name', async () => {
    const { user, bodies } = setup();
    await user.click(screen.getByRole('checkbox', { name: /CUP2/i }));
    await user.click(screen.getByRole('button', { name: /^create preset$/i }));
    expect(await screen.findByText(/preset name is required/i)).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it('shows the API error and stays open', async () => {
    const { user, onClose } = setup();
    server.use(
      http.post(apiUrl('/businesses/biz-1/presets'), () =>
        HttpResponse.json({ success: false, message: 'Name taken' }, { status: 400 })
      )
    );
    await user.type(screen.getByLabelText(/preset name/i), 'Dup');
    await user.click(screen.getByRole('checkbox', { name: /CUP2/i }));
    await user.click(screen.getByRole('button', { name: /^create preset$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/name taken/i);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cancel closes', async () => {
    const { user, onClose } = setup();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
