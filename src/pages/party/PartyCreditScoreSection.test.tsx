import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { PartyCreditScoreSection } from './PartyCreditScoreSection';
import { renderWithProviders, signedIn } from '../../test/render';
import { server } from '../../test/msw/server';
import { apiUrl, ok } from '../../test/msw/handlers';
import type { PartyCreditScore } from '../../types';

const PATH = '/businesses/biz-1/parties/p1/credit-score';

const score = (over: Partial<PartyCreditScore> = {}): PartyCreditScore => ({
  score: 76,
  band: 'moderate',
  unpaidScore: 70,
  historyScore: 85,
  buckets: [
    { key: 'current', amount: 0, pct: 0 },
    { key: 'days31_60', amount: 1000, pct: 66.7 },
    { key: 'days61_90', amount: 0, pct: 0 },
    { key: 'days90Plus', amount: 500, pct: 33.3 },
  ],
  outstanding: 1500,
  paidBills: 3,
  avgDaysLate: 10,
  asOf: '2026-11-27T00:00:00.000Z',
  historyDays: 365,
  ...over,
});

const renderSection = () =>
  renderWithProviders(<PartyCreditScoreSection businessId="biz-1" partyId="p1" />, {
    preloadedState: signedIn(),
  });

describe('PartyCreditScoreSection', () => {
  it('shows the score, band, unpaid split by age and paid history', async () => {
    server.use(http.get(apiUrl(PATH), () => ok(score())));
    renderSection();

    expect(await screen.findByLabelText('Credit score 76 out of 100')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText(/unpaid now \(60%\).*last 12 months \(40%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/31–60 days past due · ₹1,000(\.00)? · 66\.7%/)).toBeInTheDocument();
    expect(screen.getByText(/90\+ days past due · ₹500(\.00)? · 33\.3%/)).toBeInTheDocument();
    expect(
      screen.getByText('3 bills paid in the last 12 months, 10 days late on average.')
    ).toBeVisible();
  });

  it('says when nothing is unpaid and bills were paid on time', async () => {
    server.use(
      http.get(apiUrl(PATH), () =>
        ok(
          score({
            score: 100,
            band: 'good',
            outstanding: 0,
            buckets: score().buckets.map(b => ({ ...b, amount: 0, pct: 0 })),
            paidBills: 1,
            avgDaysLate: 0,
          })
        )
      )
    );
    renderSection();

    expect(await screen.findByText('Good')).toBeInTheDocument();
    expect(screen.getByText('Nothing unpaid.')).toBeInTheDocument();
    expect(
      screen.getByText('1 bill paid in the last 12 months, on time on average.')
    ).toBeVisible();
  });

  it('explains a missing score', async () => {
    server.use(
      http.get(apiUrl(PATH), () =>
        ok(score({ score: null, band: null, outstanding: 0, paidBills: 0, avgDaysLate: null }))
      )
    );
    renderSection();

    expect(await screen.findByText('Not enough data yet')).toBeInTheDocument();
  });

  it('hides itself without permission', async () => {
    server.use(
      http.get(apiUrl(PATH), () =>
        HttpResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 403 })
      )
    );
    const { container } = renderSection();

    await new Promise(r => setTimeout(r, 50));
    expect(container).toBeEmptyDOMElement();
  });
});
