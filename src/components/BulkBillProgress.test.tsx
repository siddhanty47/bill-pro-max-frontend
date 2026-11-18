import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkBillProgress } from './BulkBillProgress';
import type { BatchProgress } from '../hooks/useBillGenerationProgress';

const batch = (over: Partial<BatchProgress> = {}): BatchProgress => ({
  batchId: 'b1',
  total: 10,
  completed: 3,
  failed: 1,
  isProcessing: true,
  results: [],
  ...over,
});

describe('BulkBillProgress', () => {
  it('renders nothing without batches', () => {
    const { container } = render(<BulkBillProgress batches={[]} onDismiss={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows running progress without inline styles and cannot be dismissed', () => {
    const { container } = render(<BulkBillProgress batches={[batch()]} onDismiss={vi.fn()} />);
    expect(screen.getByText(/Generating bills: 3\/10 completed, 1 failed/)).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: /progress/i });
    expect(bar).toHaveAttribute('aria-valuenow', '4');
    expect(bar).toHaveAttribute('aria-valuemax', '10');
    expect(container.querySelector('[style]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('shows the summary when done and dismisses by batch id', async () => {
    const onDismiss = vi.fn();
    render(
      <BulkBillProgress
        batches={[batch({ isProcessing: false, completed: 5, failed: 0 })]}
        onDismiss={onDismiss}
      />
    );
    expect(screen.getByText('Bill generation complete: 5 succeeded')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /errors/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledWith('b1');
  });

  it('toggles the failure list', async () => {
    render(
      <BulkBillProgress
        batches={[
          batch({
            isProcessing: false,
            completed: 2,
            failed: 1,
            results: [
              { agreementId: 'AG-1', status: 'completed' },
              { agreementId: 'AG-2', status: 'failed', error: 'No items to bill' },
            ],
          }),
        ]}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.queryByText('No items to bill')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show errors' }));
    expect(screen.getByText('AG-2')).toBeInTheDocument();
    expect(screen.getByText('No items to bill')).toBeInTheDocument();
    expect(screen.queryByText('AG-1')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hide errors' }));
    expect(screen.queryByText('No items to bill')).not.toBeInTheDocument();
  });
});
