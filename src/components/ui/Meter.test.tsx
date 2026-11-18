import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Meter } from './Meter';

const segments = [
  { value: 5632, tone: 'accent' as const, label: 'Available' },
  { value: 9188, tone: 'info' as const, label: 'Rented out' },
];

describe('Meter', () => {
  it('sizes rects as percentages of the total', () => {
    const { container } = render(<Meter segments={segments} />);
    const rects = container.querySelectorAll('rect');
    expect(rects).toHaveLength(2);
    expect(parseFloat(rects[0].getAttribute('width') as string)).toBeCloseTo(38, 0);
    expect(parseFloat(rects[1].getAttribute('width') as string)).toBeCloseTo(62, 0);
    expect(parseFloat(rects[1].getAttribute('x') as string)).toBeCloseTo(38, 0);
  });

  it('describes itself with an aria-label', () => {
    render(<Meter segments={segments} />);
    expect(
      screen.getByRole('img', {
        name: 'Available 5,632 of 14,820, Rented out 9,188 of 14,820',
      })
    ).toBeInTheDocument();
  });

  it('shows a legend with formatted values', () => {
    render(<Meter segments={segments} />);
    expect(screen.getByText('5,632')).toHaveClass('mono');
    expect(screen.getByText('Rented out')).toBeInTheDocument();
  });

  it('renders the legend but no rects when the total is zero', () => {
    const { container } = render(
      <Meter segments={[{ value: 0, tone: 'warning', label: 'Empty' }]} />
    );
    expect(container.querySelectorAll('rect')).toHaveLength(0);
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });
});
