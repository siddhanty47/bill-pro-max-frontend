import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { ChangeRatesForm } from './ChangeRatesForm';
import { renderWithProviders, signedIn } from '../../test/render';
import { formatDate } from '../../utils/format';
import type { AgreementRateWithItem } from '../../types';

const rates: AgreementRateWithItem[] = [
  {
    itemId: 'prop',
    itemCode: 'PROP',
    itemName: 'Prop 2x2',
    itemCategory: 'Prop',
    ratePerDay: 1,
    openingBalance: 0,
  },
  {
    itemId: 'plate',
    itemCode: 'PLT',
    itemName: 'Plate 3x2',
    itemCategory: 'Plate',
    ratePerDay: 0.7,
    openingBalance: 0,
  },
];

function setup(error?: string) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const utils = renderWithProviders(
    <ChangeRatesForm
      agreementId="AG-001"
      startDate="2026-04-01T00:00:00.000Z"
      rates={rates}
      onSubmit={onSubmit}
      onCancel={onCancel}
      error={error}
    />,
    { preloadedState: signedIn() }
  );
  return { ...utils, onSubmit, onCancel };
}

describe('ChangeRatesForm', () => {
  it('prefills current rates and sends only the changed ones', async () => {
    const { user, onSubmit } = setup();

    expect(screen.getByLabelText('New rate for Prop 2x2')).toHaveValue(1);
    fireEvent.change(screen.getByLabelText(/New rates from/), { target: { value: '2026-09-01' } });
    await user.clear(screen.getByLabelText('New rate for Prop 2x2'));
    await user.type(screen.getByLabelText('New rate for Prop 2x2'), '1.2');
    await user.click(screen.getByRole('button', { name: 'Change rates' }));

    expect(onSubmit).toHaveBeenCalledWith({
      effectiveDate: '2026-09-01',
      rates: [{ itemId: 'prop', ratePerDay: 1.2 }],
    });
  });

  it('says which agreement closes and when the new one starts', () => {
    setup();

    fireEvent.change(screen.getByLabelText(/New rates from/), { target: { value: '2026-09-01' } });

    expect(
      screen.getByText(
        `Closes AG-001 on ${formatDate('2026-08-31')}, new agreement from ${formatDate('2026-09-01')}`
      )
    ).toBeInTheDocument();
  });

  it('needs a date after the agreement start', async () => {
    const { user, onSubmit } = setup();

    fireEvent.change(screen.getByLabelText(/New rates from/), { target: { value: '2026-04-01' } });
    await user.click(screen.getByRole('button', { name: 'Change rates' }));

    expect(await screen.findByText('Pick a date after the agreement start')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the server's message", () => {
    setup('Delete bill(s) SUPE-X-2026-27-09-0001 first: they cover 2026-09-01 or later');
    expect(screen.getByRole('alert')).toHaveTextContent('SUPE-X-2026-27-09-0001');
  });
});
