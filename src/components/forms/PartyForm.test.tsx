import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { PartyForm } from './PartyForm';
import { renderWithProviders, signedIn } from '../../test/render';
import { server } from '../../test/msw/server';
import { apiUrl, ok } from '../../test/msw/handlers';
import type { Party } from '../../types';

const GSTIN = '27AABCM1234F1Z5';

function setup(initialData?: Party, codeExists = false) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([])),
    http.get(apiUrl('/businesses/biz-1/parties/generate-code'), () => ok({ code: 'MEHT' })),
    http.get(apiUrl('/businesses/biz-1/parties/check-code'), () => ok({ exists: codeExists }))
  );
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const utils = renderWithProviders(
    <PartyForm initialData={initialData} onSubmit={onSubmit} onCancel={onCancel} />,
    { preloadedState: signedIn() }
  );
  return { ...utils, onSubmit, onCancel };
}

type User = ReturnType<typeof setup>['user'];

async function fillRequired(user: User) {
  await user.type(screen.getByLabelText(/party name/i), 'Mehta Builders');
  await user.type(screen.getByLabelText(/contact person/i), 'Rakesh');
  await user.type(screen.getByLabelText(/^phone/i), '9820041275');
}

describe('PartyForm', () => {
  it('submits the exact payload for a full new party', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/gst number/i), GSTIN);
    await user.type(screen.getByLabelText(/party name/i), 'Mehta Builders');
    await user.tab(); // blur name: generates the code
    await waitFor(() => expect(screen.getByLabelText(/party code/i)).toHaveValue('MEHT'));
    await user.click(screen.getByRole('checkbox', { name: /supplier/i }));
    await user.type(screen.getByLabelText(/contact person/i), 'Rakesh');
    await user.type(screen.getByLabelText(/^phone/i), '9820041275');
    await user.type(screen.getByLabelText(/^email/i), 'r@mehta.in');
    await user.type(screen.getByLabelText(/^address/i), 'Andheri East');
    await user.type(screen.getByLabelText(/^notes/i), 'Pays late');
    await user.type(screen.getByLabelText(/site address/i), 'Plot 12');
    await user.type(screen.getByLabelText(/site code/i), 'plot');
    await user.click(screen.getByRole('button', { name: /^add party$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      code: 'MEHT',
      name: 'Mehta Builders',
      roles: ['client', 'supplier'],
      contact: {
        person: 'Rakesh',
        phone: '9820041275',
        email: 'r@mehta.in',
        address: 'Andheri East',
        gst: GSTIN,
        stateCode: '27',
      },
      notes: 'Pays late',
      initialSite: { code: 'PLOT', address: 'Plot 12', stateCode: '27' },
    });
  });

  it('copies the office address to the site when "same as office" is ticked', async () => {
    const { user, onSubmit } = setup();
    await fillRequired(user);
    await user.type(screen.getByLabelText(/^address/i), 'Andheri East');
    await user.click(screen.getByRole('checkbox', { name: /same as office/i }));
    expect(screen.getByLabelText(/site address/i)).toBeDisabled();
    expect(screen.getByLabelText(/site address/i)).toHaveValue('Andheri East');
    await user.click(screen.getByRole('button', { name: /^add party$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      code: 'MEHT',
      name: 'Mehta Builders',
      roles: ['client'],
      contact: {
        person: 'Rakesh',
        phone: '9820041275',
        email: undefined,
        address: 'Andheri East',
        gst: undefined,
        stateCode: undefined,
      },
      notes: undefined,
      initialSite: { code: undefined, address: 'Andheri East', stateCode: undefined },
    });
  });

  it('shows required-field messages and does not submit', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('checkbox', { name: /client/i }));
    await user.click(screen.getByRole('button', { name: /^add party$/i }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Code is required')).toBeInTheDocument();
    expect(screen.getByText('Select at least one role')).toBeInTheDocument();
    expect(screen.getByText('Contact person is required')).toBeInTheDocument();
    expect(screen.getByText('Phone is required')).toBeInTheDocument();
    expect(screen.getByText('Site address is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects an invalid email', async () => {
    const { user, onSubmit } = setup();
    await fillRequired(user);
    await user.type(screen.getByLabelText(/^email/i), 'nope');
    await user.click(screen.getByRole('button', { name: /^add party$/i }));
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submit when the party code already exists', async () => {
    const { user, onSubmit } = setup(undefined, true);
    await fillRequired(user);
    await user.type(screen.getByLabelText(/party code/i), 'DUP');
    await user.type(screen.getByLabelText(/site address/i), 'Plot 12');
    await user.tab();
    expect(await screen.findByText('This code already exists')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^add party$/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('fetches GST details and fills name, code, address and state codes', async () => {
    server.use(
      http.get(apiUrl(`/businesses/biz-1/gstin/${GSTIN}`), () =>
        ok({
          gstin: GSTIN,
          legalName: 'Mehta Legal',
          tradeName: 'Mehta Builders',
          address: '12 Link Road',
          status: 'Active',
          isActive: true,
        })
      )
    );
    const { user } = setup();
    const btn = screen.getByRole('button', { name: /fetch details/i });
    expect(btn).toBeDisabled();
    await user.type(screen.getByLabelText(/gst number/i), GSTIN);
    await user.click(btn);
    expect(await screen.findByText('Fetched: Mehta Legal (Active)')).toBeInTheDocument();
    expect(screen.getByLabelText(/party name/i)).toHaveValue('Mehta Builders');
    expect(screen.getByLabelText(/party code/i)).toHaveValue('MEHT');
    expect(screen.getByLabelText(/^address/i)).toHaveValue('12 Link Road');
    expect(screen.getByLabelText(/^state code/i)).toHaveValue('27');
    expect(screen.getByLabelText(/site state code/i)).toHaveValue('27');
  });

  it('warns about an inactive GSTIN and reports a failed lookup', async () => {
    server.use(
      http.get(apiUrl(`/businesses/biz-1/gstin/${GSTIN}`), () =>
        ok({ gstin: GSTIN, legalName: 'X', status: 'Cancelled', isActive: false })
      )
    );
    const { user } = setup();
    await user.type(screen.getByLabelText(/gst number/i), GSTIN);
    await user.click(screen.getByRole('button', { name: /fetch details/i }));
    expect(await screen.findByText('Warning: This GSTIN is Cancelled')).toBeInTheDocument();

    server.use(
      http.get(apiUrl(`/businesses/biz-1/gstin/${GSTIN}`), () =>
        HttpResponse.json({ error: { message: 'GST service down' } }, { status: 502 })
      )
    );
    await user.click(screen.getByRole('button', { name: /fetch details/i }));
    expect(await screen.findByText('GST service down')).toBeInTheDocument();
  });

  it('edits an existing party without the site section', async () => {
    const party = {
      _id: 'p1',
      code: 'MEHT',
      name: 'Mehta',
      roles: ['client'],
      contact: { person: 'Rakesh', phone: '98', gst: GSTIN, stateCode: '27' },
      notes: 'n',
      sites: [],
    } as unknown as Party;
    const { user, onSubmit, onCancel } = setup(party);
    expect(screen.queryByLabelText(/site address/i)).not.toBeInTheDocument();
    const name = screen.getByLabelText(/party name/i);
    await user.clear(name);
    await user.type(name, 'Mehta Infra');
    await user.click(screen.getByRole('button', { name: /^update party$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      code: 'MEHT',
      name: 'Mehta Infra',
      roles: ['client'],
      contact: {
        person: 'Rakesh',
        phone: '98',
        email: undefined,
        address: undefined,
        gst: GSTIN,
        stateCode: '27',
      },
      notes: 'n',
      initialSite: { address: '' },
    });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
