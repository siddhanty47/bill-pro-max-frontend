import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { ImportPresetModal } from './ImportPresetModal';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { Inventory } from '../types';

const summaries = [
  {
    _id: 'p1',
    name: 'Scaffold basics',
    description: 'Starter',
    tags: ['site'],
    itemCount: 2,
    isSystem: true,
    isPublic: true,
  },
  { _id: 'p2', name: 'Ladders', tags: [], itemCount: 1, isSystem: false, isPublic: false },
];

const preset = {
  _id: 'p1',
  name: 'Scaffold basics',
  tags: [],
  isSystem: true,
  isPublic: true,
  isActive: true,
  createdAt: '',
  updatedAt: '',
  items: [
    { code: 'CUP2', name: 'Cuplock 2m', category: 'Scaffolding', unit: 'pieces' },
    { code: 'LAD1', name: 'Ladder 1m', category: 'Access', unit: 'pieces' },
  ],
};

const existing = [{ code: 'cup2' }] as unknown as Inventory[];

function setup(presets: unknown[] = summaries) {
  const onClose = vi.fn();
  const bodies: unknown[] = [];
  server.use(
    http.get(apiUrl('/presets'), () => ok(presets)),
    http.get(apiUrl('/presets/p1'), () => ok(preset)),
    http.post(apiUrl('/businesses/biz-1/inventory/import-preset'), async ({ request }) => {
      bodies.push(await request.json());
      return ok({ imported: 1, skipped: 1 });
    })
  );
  const utils = renderWithProviders(
    <ImportPresetModal isOpen onClose={onClose} businessId="biz-1" existingInventory={existing} />,
    { preloadedState: signedIn() }
  );
  return { ...utils, onClose, bodies };
}

async function openPreview(user: ReturnType<typeof setup>['user']) {
  await user.click((await screen.findAllByText('Scaffold basics'))[0]);
  await screen.findByText('Ladder 1m', { selector: 'td' });
}

describe('ImportPresetModal', () => {
  it('lists presets and filters by search', async () => {
    const { user } = setup();
    expect((await screen.findAllByText('Scaffold basics'))[0]).toBeInTheDocument();
    expect(screen.getAllByText('Ladders')[0]).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/search presets/i), 'ladd');
    expect(screen.queryByText('Scaffold basics')).not.toBeInTheDocument();
    await user.clear(screen.getByPlaceholderText(/search presets/i));
    await user.type(screen.getByPlaceholderText(/search presets/i), 'nomatch');
    expect(await screen.findByText(/no presets match/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no presets', async () => {
    setup([]);
    expect(await screen.findByText(/no presets available/i)).toBeInTheDocument();
  });

  it('previews, skips existing codes and imports with the exact body', async () => {
    const { user, bodies } = setup();
    await openPreview(user);
    expect(screen.getAllByText(/already exists/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/will be imported/i)).toHaveTextContent(/1\s*will be imported/i);
    await user.click(screen.getByRole('button', { name: /import 1 items/i }));
    expect(await screen.findByText(/items imported successfully/i)).toBeInTheDocument();
    expect(screen.getByText(/1 skipped/i)).toBeInTheDocument();
    expect(bodies).toEqual([{ presetId: 'p1' }]);
  });

  it('filters preview items and goes back', async () => {
    const { user } = setup();
    await openPreview(user);
    await user.type(screen.getByPlaceholderText(/search items/i), 'ladder');
    expect(within(screen.getByRole('table')).queryByText('Cuplock 2m')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(await screen.findByPlaceholderText(/search presets/i)).toBeInTheDocument();
  });

  it('shows the error when the preset fails to load', async () => {
    const { user } = setup();
    server.use(
      http.get(apiUrl('/presets/p1'), () =>
        HttpResponse.json({ success: false, message: 'Gone' }, { status: 404 })
      )
    );
    await user.click((await screen.findAllByText('Scaffold basics'))[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent(/gone/i);
  });

  it('shows the error when import fails and stays on preview', async () => {
    const { user } = setup();
    server.use(
      http.post(apiUrl('/businesses/biz-1/inventory/import-preset'), () =>
        HttpResponse.json({ success: false, message: 'Nope' }, { status: 400 })
      )
    );
    await openPreview(user);
    await user.click(screen.getByRole('button', { name: /import 1 items/i }));
    expect(await screen.findByText(/nope/i)).toBeInTheDocument();
  });

  it('done closes from the result step', async () => {
    const { user, onClose } = setup();
    await openPreview(user);
    await user.click(screen.getByRole('button', { name: /import 1 items/i }));
    await user.click(await screen.findByRole('button', { name: /^done$/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('marks the current step and shows a no-match state in the preview', async () => {
    const { user } = setup();
    await screen.findAllByText('Scaffold basics');
    expect(screen.getByText(/1\. Browse/)).toHaveAttribute('aria-current', 'step');
    await openPreview(user);
    expect(screen.getByText(/2\. Preview/)).toHaveAttribute('aria-current', 'step');
    await user.type(screen.getByPlaceholderText(/search items/i), 'zzzz');
    expect(screen.getByText(/no items match your search/i)).toBeInTheDocument();
  });

  it('shows item count, type and description on the phone list', async () => {
    setup();
    const list = await screen.findByRole('list', { name: 'Presets' });
    expect(within(list).getByText('2 items')).toBeInTheDocument();
    expect(within(list).getByText(/System · Starter/)).toBeInTheDocument();
    expect(within(list).getByText(/^Custom$/)).toBeInTheDocument();
  });
});
