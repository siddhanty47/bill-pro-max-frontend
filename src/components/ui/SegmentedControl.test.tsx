import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl, type SegmentedOption } from './SegmentedControl';

type V = 'all' | 'delivery' | 'return';
const OPTIONS: SegmentedOption<V>[] = [
  { value: 'all', label: 'All' },
  { value: 'delivery', label: 'Delivery', dot: 'info' },
  { value: 'return', label: 'Return', dot: 'warning' },
];

function Controlled({ onChange }: { onChange?: (v: V) => void }) {
  const [value, setValue] = useState<V>('all');
  return (
    <SegmentedControl
      label="Type"
      options={OPTIONS}
      value={value}
      onChange={v => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe('SegmentedControl', () => {
  it('renders a labelled radiogroup with one checked radio', () => {
    render(<SegmentedControl label="Type" options={OPTIONS} value="delivery" onChange={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: 'Type' })).toHaveClass('seg');
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Delivery' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Delivery' })).toHaveClass('on');
  });

  it('uses roving tabindex: only the checked radio is tabbable', () => {
    render(<SegmentedControl label="Type" options={OPTIONS} value="return" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Return' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('tabindex', '-1');
  });

  it('renders a tone dot only for options that have one', () => {
    const { container } = render(
      <SegmentedControl label="Type" options={OPTIONS} value="all" onChange={vi.fn()} />
    );
    const dots = container.querySelectorAll('.dot');
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveClass('info');
    expect(dots[1]).toHaveClass('warning');
    expect(dots[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('changes value on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Return' }));
    expect(onChange).toHaveBeenLastCalledWith('return');
    expect(screen.getByRole('radio', { name: 'Return' })).toHaveAttribute('aria-checked', 'true');
  });

  it('moves selection and focus with arrow keys, wrapping, plus Home and End', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    screen.getByRole('radio', { name: 'All' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('delivery');
    expect(screen.getByRole('radio', { name: 'Delivery' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Delivery' })).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('all');
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('return');
    await user.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenLastCalledWith('delivery');
    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith('all');
    await user.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith('return');
    expect(screen.getByRole('radio', { name: 'Return' })).toHaveFocus();
    const calls = onChange.mock.calls.length;
    await user.keyboard('a');
    expect(onChange).toHaveBeenCalledTimes(calls);
  });
  it('navigates six options with arrow keys, wrapping at the ends', async () => {
    const user = userEvent.setup();
    const six = ['1M', '3M', '6M', '1Y', '3Y', 'ALL'].map(v => ({ value: v, label: v }));
    function Six() {
      const [v, setV] = useState('1M');
      return <SegmentedControl label="Range" options={six} value={v} onChange={setV} />;
    }
    render(<Six />);
    expect(screen.getAllByRole('radio')).toHaveLength(6);
    screen.getByRole('radio', { name: '1M' }).focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('radio', { name: '6M' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: 'ALL' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: '1M' })).toHaveAttribute('aria-checked', 'true');
  });

  it('applies the compact class only for size="sm"', () => {
    const { rerender } = render(
      <SegmentedControl label="Type" options={OPTIONS} value="all" onChange={vi.fn()} />
    );
    expect(screen.getByRole('radiogroup')).not.toHaveClass('sm');
    rerender(
      <SegmentedControl label="Type" options={OPTIONS} value="all" onChange={vi.fn()} size="sm" />
    );
    expect(screen.getByRole('radiogroup')).toHaveClass('sm');
  });
});
