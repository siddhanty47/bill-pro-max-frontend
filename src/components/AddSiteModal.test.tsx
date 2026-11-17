import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { AddSiteModal } from './AddSiteModal';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { Party } from '../types';

const SITES = '/businesses/biz-1/parties/p1/sites';

const party = (over: Partial<Party> = {}) =>
  ({
    _id: 'p1',
    businessId: 'biz-1',
    code: 'MEHT',
    name: 'Mehta Builders',
    roles: ['client'],
    contact: { person: 'Rakesh', phone: '9820041275', stateCode: '27' },
    sites: [
      { code: 'PLOT', address: 'Plot 12' },
      { code: 'SECT', address: 'Sector 5' },
    ],
    agreements: [],
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-11-16T00:00:00.000Z',
    ...over,
  }) as Party;

function renderModal(p: Party = party(), onClose = vi.fn()) {
  server.use(http.get(apiUrl('/businesses'), () => ok([])));
  const utils = renderWithProviders(
    <AddSiteModal isOpen onClose={onClose} businessId="biz-1" party={p} />,
    { preloadedState: signedIn() }
  );
  return { ...utils, onClose };
}

function captureAdd(response = () => ok(party())) {
  const bodies: unknown[] = [];
  server.use(
    http.post(apiUrl(SITES), async ({ request }) => {
      bodies.push(await request.json());
      return response();
    })
  );
  return bodies;
}

describe('AddSiteModal', () => {
  it('shows the existing site codes and the party state code as default', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: 'Add site to Mehta Builders' })).toBeInTheDocument();
    expect(screen.getByText('PLOT, SECT')).toHaveClass('mono');
    expect(screen.getByRole('textbox', { name: 'State code' })).toHaveValue('27');
    expect(screen.getByRole('textbox', { name: /Site address/ })).toBeRequired();
  });

  it('defaults the state code from a 15-character GST when the party has none', () => {
    renderModal(party({ contact: { person: 'R', phone: '1', gst: '24AABCM1234F1Z5' }, sites: [] }));
    expect(screen.getByRole('textbox', { name: 'State code' })).toHaveValue('24');
    expect(screen.getByText(/Existing sites/)).toHaveTextContent('Existing sites: None');
  });

  it('requires an address', async () => {
    const bodies = captureAdd();
    const { user } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Add site' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Site address is required');
    expect(bodies).toEqual([]);
  });

  it('rejects a state code that is not two digits', async () => {
    const bodies = captureAdd();
    const { user } = renderModal();
    await user.type(screen.getByRole('textbox', { name: /Site address/ }), 'Andheri');
    const state = screen.getByRole('textbox', { name: 'State code' });
    await user.clear(state);
    await user.type(state, 'MH');
    await user.click(screen.getByRole('button', { name: 'Add site' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('State code must be 2 digits');
    expect(bodies).toEqual([]);
  });

  it('posts the exact payload and closes', async () => {
    const bodies = captureAdd();
    const { user, onClose } = renderModal();
    await user.type(screen.getByRole('textbox', { name: /Site address/ }), 'Andheri East');
    await user.type(screen.getByRole('textbox', { name: 'Site code' }), 'ANDH');
    await user.click(screen.getByRole('button', { name: 'Add site' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodies).toEqual([{ code: 'ANDH', address: 'Andheri East', stateCode: '27' }]);
  });

  it('omits an empty code and state code', async () => {
    const bodies = captureAdd();
    const { user, onClose } = renderModal(party({ contact: { person: 'R', phone: '1' } }));
    await user.type(screen.getByRole('textbox', { name: /Site address/ }), 'Andheri');
    await user.click(screen.getByRole('button', { name: 'Add site' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodies).toEqual([{ address: 'Andheri' }]);
  });

  it('shows the API error and stays open', async () => {
    captureAdd(() =>
      HttpResponse.json(
        { success: false, error: { message: 'Site code already exists' } },
        { status: 409 }
      )
    );
    const { user, onClose } = renderModal();
    await user.type(screen.getByRole('textbox', { name: /Site address/ }), 'Andheri');
    await user.click(screen.getByRole('button', { name: 'Add site' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Site code already exists');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('falls back to a generic error message', async () => {
    captureAdd(() => HttpResponse.json({}, { status: 500 }));
    const { user } = renderModal();
    await user.type(screen.getByRole('textbox', { name: /Site address/ }), 'Andheri');
    await user.click(screen.getByRole('button', { name: 'Add site' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to add site');
  });

  it('cancel closes without posting', async () => {
    const bodies = captureAdd();
    const { user, onClose } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(bodies).toEqual([]);
  });
});
