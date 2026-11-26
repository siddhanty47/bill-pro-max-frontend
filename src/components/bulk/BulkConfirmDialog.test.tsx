import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../ui';
import { BulkConfirmDialog, MessageDialog, type ConfirmRequest } from './BulkConfirmDialog';
import { useConfirm } from './useConfirm';

const request = (over: Partial<ConfirmRequest> = {}): ConfirmRequest => ({
  title: 'Delete 2 parties?',
  body: "This can't be undone.",
  confirmLabel: 'Delete',
  danger: true,
  onConfirm: vi.fn(),
  ...over,
});

describe('BulkConfirmDialog', () => {
  it('renders nothing without a request', () => {
    render(<BulkConfirmDialog request={null} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('runs onConfirm, then closes', async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>(r => (resolve = r)));
    const onClose = vi.fn();
    render(<BulkConfirmDialog request={request({ onConfirm })} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Delete 2 parties?' });
    expect(dialog).toHaveTextContent("This can't be undone.");
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
    resolve();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('closes without acting from the cancel button, with its own label', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <BulkConfirmDialog
        request={request({ onConfirm, cancelLabel: 'Keep notes', body: undefined })}
        onClose={onClose}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Keep notes' }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('useConfirm', () => {
  it('opens the asked request and closes it after confirming', async () => {
    const onConfirm = vi.fn();
    function Harness() {
      const confirm = useConfirm();
      return (
        <>
          <Button
            onClick={() =>
              confirm.ask({ title: 'Issue 2 notes?', confirmLabel: 'Issue', onConfirm })
            }
          >
            Open
          </Button>
          {confirm.dialog}
        </>
      );
    }
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog', { name: 'Issue 2 notes?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Issue' }));
    expect(onConfirm).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('MessageDialog', () => {
  it('shows the message and closes', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <MessageDialog title="Something went wrong" message={null} onClose={onClose} />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(<MessageDialog title="Something went wrong" message="Nope" onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Something went wrong' });
    expect(dialog).toHaveTextContent('Nope');
    await userEvent.click(within(dialog).getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(onClose).toHaveBeenCalled();
  });
});
