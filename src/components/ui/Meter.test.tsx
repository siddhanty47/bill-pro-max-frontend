import { describe, expect, it, vi } from 'vitest';
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

  it('leaves no gaps: each x is the sum of the previous rounded widths, ending at 100%', () => {
    const thirds = [
      { value: 1, tone: 'accent' as const, label: 'A' },
      { value: 1, tone: 'info' as const, label: 'B' },
      { value: 1, tone: 'warning' as const, label: 'C' },
    ];
    const { container } = render(<Meter segments={thirds} />);
    const rects = Array.from(container.querySelectorAll('rect'));
    const xs = rects.map(r => parseFloat(r.getAttribute('x') as string));
    const ws = rects.map(r => parseFloat(r.getAttribute('width') as string));
    expect(xs[0]).toBe(0);
    expect(xs[1]).toBeCloseTo(ws[0], 5);
    expect(xs[2]).toBeCloseTo(ws[0] + ws[1], 5);
    expect(xs[2] + ws[2]).toBeCloseTo(100, 5);
  });

  it('renders segments that share a label without key collisions', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <Meter
        segments={[
          { value: 1, tone: 'accent', label: 'Same' },
          { value: 2, tone: 'info', label: 'Same' },
        ]}
      />
    );
    expect(container.querySelectorAll('rect')).toHaveLength(2);
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(errSpy).not.toHaveBeenCalled();
  });
});
