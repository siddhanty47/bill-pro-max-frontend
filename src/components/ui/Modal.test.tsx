import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';
import { Modal as ModalShim } from '../Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Edit party">
        <p>Body</p>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('names the dialog by its title', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Edit party">
        <p>Body</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog', { name: 'Edit party' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
  });

  it('focuses the first input when opened', async () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Edit party">
        <input aria-label="Name" />
        <input aria-label="Phone" />
      </Modal>
    );
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveFocus());
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Edit party">
        <p>Body</p>
      </Modal>
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on overlay click but not on dialog click', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Edit party">
        <p>Body</p>
      </Modal>
    );
    await userEvent.click(screen.getByText('Body'));
    expect(onClose).not.toHaveBeenCalled();
    const overlay = screen.getByRole('dialog').parentElement as HTMLElement;
    await userEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the close button', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Edit party">
        <p>Body</p>
      </Modal>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('applies variant and size classes', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Delivery" variant="delivery" size="form">
        <p>Body</p>
      </Modal>
    );
    expect(screen.getByRole('dialog')).toHaveClass('delivery', 'formSize');
  });

  it('is re-exported from the legacy path', () => {
    expect(ModalShim).toBe(Modal);
  });
});
