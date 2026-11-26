import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/render';
import { useChangeGate, type GatedCall } from './useChangeGate';
import type { GateArgs, GateReport } from '../types';

const clean: GateReport = { affected: [], negative: [], requiresReason: false, blocked: null };

const draftAndIssued: GateReport = {
  affected: [
    { billId: 'b1', billNumber: 'INV-1', status: 'draft', issued: false },
    { billId: 'b2', billNumber: 'INV-2', status: 'sent', issued: true },
  ],
  negative: [],
  requiresReason: true,
  blocked: null,
};

const negativeSpan = {
  itemId: 'i1',
  itemName: 'Ladder',
  from: '2026-04-10T00:00:00.000Z',
  minQty: -3,
  firstCause: 'D-0007',
};

function dry(report: GateReport) {
  return { dryRun: true, report };
}

function apiError(status: number, code: string, details?: object) {
  return { status, data: { success: false, error: { code, message: code, details } } };
}

/** A call that previews with `report`, then saves, recording every gate it was given. */
function makeCall(report: GateReport, real: (gate: GateArgs) => unknown = () => ({ ok: true })) {
  const gates: GateArgs[] = [];
  const call: GatedCall = async gate => {
    gates.push(gate);
    if (gate.dryRun) return dry(report);
    const out = real(gate);
    if (out instanceof Error) throw out;
    return out;
  };
  return { call, gates };
}

function Harness({ call, onDone }: { call: GatedCall; onDone: (r: unknown) => void }) {
  const { run, dialog } = useChangeGate();
  return (
    <>
      <button
        onClick={() => {
          run(call).then(onDone, e => onDone({ error: e }));
        }}
      >
        Go
      </button>
      {dialog}
    </>
  );
}

function setup(call: GatedCall) {
  const onDone = vi.fn();
  const view = renderWithProviders(<Harness call={call} onDone={onDone} />);
  return { ...view, onDone };
}

describe('useChangeGate', () => {
  it('saves straight away when nothing billed is touched', async () => {
    const { call, gates } = makeCall(clean);
    const { user, onDone } = setup(call);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
    expect(gates).toEqual([{ dryRun: true }, {}]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('treats a non dry-run preview response as already saved', async () => {
    const call = vi.fn().mockResolvedValue({ _id: 'c1' });
    const { user, onDone } = setup(call);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('lists affected bills and saves with the reason', async () => {
    const { call, gates } = makeCall(draftAndIssued);
    const { user, onDone } = setup(call);
    await user.click(screen.getByRole('button', { name: 'Go' }));

    expect(await screen.findByText('Not sent yet (1)')).toBeInTheDocument();
    expect(screen.getByText('Already sent to the client (1)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'INV-1 View' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'INV-2 View' })).toBeInTheDocument();

    const save = screen.getByRole('button', { name: 'Save change' });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText(/Why are you making/), '   ');
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText(/Why are you making/), '  Wrong count  ');
    await user.click(save);

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
    expect(gates).toEqual([{ dryRun: true }, { reason: 'Wrong count' }]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sends confirmNegative when stock goes below zero', async () => {
    const { call, gates } = makeCall({ ...clean, negative: [negativeSpan] });
    const { user, onDone } = setup(call);
    await user.click(screen.getByRole('button', { name: 'Go' }));

    expect(await screen.findByText('Stock will go below zero')).toBeInTheDocument();
    expect(screen.getByText(/Ladder/)).toHaveTextContent('lowest count -3');
    expect(screen.getByText(/Ladder/)).toHaveTextContent('challan D-0007');
    await user.click(screen.getByRole('button', { name: 'Save change' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
    expect(gates[1]).toEqual({ confirmNegative: true });
  });

  it('blocks staff from changing a billed month', async () => {
    const { call, gates } = makeCall({ ...draftAndIssued, blocked: 'role' });
    const { user } = setup(call);
    await user.click(screen.getByRole('button', { name: 'Go' }));

    expect(
      await screen.findByText(
        'These months are already billed. Only an owner or manager can make this change.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save change' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Why are you making/)).not.toBeInTheDocument();
    expect(gates).toEqual([{ dryRun: true }]);
  });

  it('resolves false when the dialog is cancelled', async () => {
    const { call, gates } = makeCall(draftAndIssued);
    const { user, onDone } = setup(call);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(false));
    expect(gates).toEqual([{ dryRun: true }]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reopens the dialog with negative stock when the server asks for confirmation', async () => {
    let attempt = 0;
    const { call, gates } = makeCall(clean, () => {
      attempt += 1;
      if (attempt === 1) {
        throw apiError(409, 'NEGATIVE_STOCK_CONFIRM_REQUIRED', { negative: [negativeSpan] });
      }
      return { ok: true };
    });
    const { user, onDone } = setup(call);
    await user.click(screen.getByRole('button', { name: 'Go' }));

    expect(await screen.findByText('Stock will go below zero')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save change' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
    expect(gates).toEqual([{ dryRun: true }, {}, { confirmNegative: true }]);
  });

  it('confirms negative stock when the server asks without sending spans', async () => {
    let attempt = 0;
    const { call, gates } = makeCall(clean, () => {
      attempt += 1;
      if (attempt === 1) throw apiError(409, 'NEGATIVE_STOCK_CONFIRM_REQUIRED');
      return { ok: true };
    });
    const { user, onDone } = setup(call);
    await user.click(screen.getByRole('button', { name: 'Go' }));

    await user.click(await screen.findByRole('button', { name: 'Save change' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
    expect(gates).toEqual([{ dryRun: true }, {}, { confirmNegative: true }]);
  });

  it('disables Cancel while the save is in flight', async () => {
    let finish: (v: unknown) => void = () => {};
    const { call } = makeCall(draftAndIssued, () => new Promise(resolve => (finish = resolve)));
    const { user, onDone } = setup(call);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    await user.type(await screen.findByLabelText(/Why are you making/), 'Fix');
    await user.click(screen.getByRole('button', { name: 'Save change' }));

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(cancel).toBeDisabled());
    await user.keyboard('{Escape}');
    expect(onDone).not.toHaveBeenCalled();
    finish({ ok: true });
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
  });

  it('asks for a reason when the server requires one', async () => {
    let attempt = 0;
    const { call, gates } = makeCall(clean, () => {
      attempt += 1;
      if (attempt === 1) throw apiError(400, 'REASON_REQUIRED');
      return { ok: true };
    });
    const { user, onDone } = setup(call);
    await user.click(screen.getByRole('button', { name: 'Go' }));

    const save = await screen.findByRole('button', { name: 'Save change' });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText(/Why are you making/), 'Typo');
    await user.click(save);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
    expect(gates[2]).toEqual({ reason: 'Typo' });
  });

  it('shows the blocked notice when the month was billed after the preview', async () => {
    const { call } = makeCall(clean, () => {
      throw apiError(403, 'BILLED_PERIOD_LOCKED');
    });
    const { user } = setup(call);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(await screen.findByText(/These months are already billed/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save change' })).not.toBeInTheDocument();
  });

  it('rejects with other errors from the real save and closes the dialog', async () => {
    const boom = apiError(500, 'SERVER_ERROR');
    const { call } = makeCall(draftAndIssued, () => {
      throw boom;
    });
    const { user, onDone } = setup(call);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    await user.type(await screen.findByLabelText(/Why are you making/), 'Fix');
    await user.click(screen.getByRole('button', { name: 'Save change' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ error: boom }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rejects when the preview itself fails', async () => {
    const boom = apiError(400, 'VALIDATION_ERROR');
    const { user, onDone } = setup(() => Promise.reject(boom));
    await user.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ error: boom }));
  });

  describe('closed year', () => {
    const MESSAGE =
      "FY 2025-26 is closed for this site. Anything dated on or before 31 Mar 2026 can't be changed.";
    const yearClosed = () =>
      apiError(409, 'YEAR_CLOSED', {
        fy: '2025-26',
        closedThrough: '2026-03-31T00:00:00.000Z',
        lockedThrough: '2026-03-31T00:00:00.000Z',
      });

    it('shows the message with only Close when the preview reports a closed year', async () => {
      const { call, gates } = makeCall({
        ...draftAndIssued,
        blocked: 'closedYear',
        closedYear: '2025-26',
      });
      const { user, onDone } = setup(call);
      await user.click(screen.getByRole('button', { name: 'Go' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGE);
      expect(screen.queryByRole('button', { name: 'Save change' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Why are you making/)).not.toBeInTheDocument();
      await user.click(screen.getByText('Close'));
      await waitFor(() => expect(onDone).toHaveBeenCalledWith(false));
      expect(gates).toEqual([{ dryRun: true }]);
    });

    it('shows the message when the real save is refused with YEAR_CLOSED', async () => {
      const { call, gates } = makeCall(clean, () => {
        throw yearClosed();
      });
      const { user, onDone } = setup(call);
      await user.click(screen.getByRole('button', { name: 'Go' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGE);
      expect(screen.queryByRole('button', { name: 'Save change' })).not.toBeInTheDocument();
      await user.click(screen.getByText('Close'));
      await waitFor(() => expect(onDone).toHaveBeenCalledWith(false));
      expect(gates).toEqual([{ dryRun: true }, {}]);
    });

    it('shows the message when the preview itself is refused with YEAR_CLOSED', async () => {
      const { user, onDone } = setup(() => Promise.reject(yearClosed()));
      await user.click(screen.getByRole('button', { name: 'Go' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGE);
      await user.click(screen.getByText('Close'));
      await waitFor(() => expect(onDone).toHaveBeenCalledWith(false));
    });
  });
});
