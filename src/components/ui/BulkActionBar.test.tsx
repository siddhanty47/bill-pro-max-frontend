import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkActionBar } from './BulkActionBar';
import { Button } from './Button';

describe('BulkActionBar', () => {
  it('renders nothing when nothing is selected', () => {
    const { container } = render(
      <BulkActionBar count={0} noun="bills" onClear={() => {}}>
        <Button>Delete</Button>
      </BulkActionBar>
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();
  });

  it('shows the count, the actions and Clear in a named region', () => {
    render(
      <BulkActionBar count={3} noun="bills" onClear={() => {}} className="place">
        <Button>Mark 3 as sent</Button>
      </BulkActionBar>
    );
    const region = screen.getByRole('region', { name: 'Bulk actions' });
    expect(region).toHaveClass('bar', 'place');
    expect(within(region).getByText(/selected/)).toHaveTextContent('3 bills selected');
    expect(within(region).getByText('3')).toHaveClass('number');
    expect(within(region).getByRole('button', { name: 'Mark 3 as sent' })).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('calls onClear from Clear', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<BulkActionBar count={1} noun="bill" onClear={onClear} />);
    expect(screen.getByText(/selected/)).toHaveTextContent('1 bill selected');
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
