/**
 * @fileoverview Wraps a gated challan / agreement mutation: preview with `dryRun`,
 * save straight away when nothing billed is touched, otherwise ask in a dialog.
 * The server stays the source of truth: its 403 / 400 / 409 after the preview
 * reopen the same dialog.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { isDryRunResult } from '../api/changeGate';
import { getApiError } from '../utils/apiError';
import { ChangeImpactDialog } from '../components/billing/ChangeImpactDialog';
import type { GateArgs, GateNegativeSpan, GateReport } from '../types';

/** Makes the API call (`.unwrap()`ed) with the gate fields merged in. */
export type GatedCall = (gate: GateArgs) => Promise<unknown>;

interface Pending {
  call: GatedCall;
  report: GateReport;
  /** The server asked to confirm negative stock (even when it sent no spans) */
  confirmNegative?: boolean;
  resolve: (saved: boolean) => void;
  reject: (error: unknown) => void;
}

function needsDialog(report: GateReport): boolean {
  return report.affected.length > 0 || report.negative.length > 0 || report.blocked !== null;
}

/** The report to show again when the real save is refused, or null for any other error. */
function reportFromError(error: unknown, previous: GateReport): GateReport | null {
  const info = getApiError(error);
  if (info.code === 'BILLED_PERIOD_LOCKED') return { ...previous, blocked: 'role' };
  if (info.code === 'REASON_REQUIRED') return { ...previous, requiresReason: true };
  if (info.code === 'NEGATIVE_STOCK_CONFIRM_REQUIRED') {
    const negative = info.details?.negative;
    return {
      ...previous,
      negative: Array.isArray(negative) ? (negative as GateNegativeSpan[]) : previous.negative,
    };
  }
  return null;
}

export function useChangeGate() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef<Pending | null>(null);

  const show = useCallback((next: Pending | null) => {
    active.current = next;
    setPending(next);
  }, []);

  /** Save for real. Returns true once saved; a refused save reopens the dialog. */
  const commit = useCallback(
    async (p: Pending, gate: GateArgs) => {
      try {
        await p.call(gate);
        show(null);
        p.resolve(true);
      } catch (err) {
        const report = reportFromError(err, p.report);
        if (report) {
          const confirmNegative =
            p.confirmNegative || getApiError(err).code === 'NEGATIVE_STOCK_CONFIRM_REQUIRED';
          show({ ...p, report, confirmNegative });
        } else {
          show(null);
          p.reject(err);
        }
      }
    },
    [show]
  );

  /**
   * Run a gated change. Resolves true once saved, false if the user cancelled the dialog;
   * rejects with the API error for anything the dialog cannot fix.
   */
  const run = useCallback(
    async (call: GatedCall): Promise<boolean> => {
      const preview = await call({ dryRun: true });
      if (!isDryRunResult(preview)) return true;
      return new Promise<boolean>((resolve, reject) => {
        const next: Pending = { call, report: preview.report, resolve, reject };
        if (needsDialog(preview.report)) show(next);
        else void commit(next, {});
      });
    },
    [show, commit]
  );

  const cancel = () => {
    // A save in flight settles the promise itself
    if (busy) return;
    active.current?.resolve(false);
    show(null);
  };

  const confirm = async (reason: string) => {
    if (!pending) return;
    setBusy(true);
    await commit(pending, {
      ...(reason ? { reason } : {}),
      ...(pending.confirmNegative || pending.report.negative.length > 0
        ? { confirmNegative: true }
        : {}),
    });
    setBusy(false);
  };

  const dialog: ReactNode = pending ? (
    <ChangeImpactDialog report={pending.report} busy={busy} onCancel={cancel} onConfirm={confirm} />
  ) : null;

  return { run, dialog };
}
