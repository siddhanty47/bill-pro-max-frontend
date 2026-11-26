import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

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

  it('does not steal focus from a field the user focused before the frame', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      frames.push(cb);
      return frames.length;
    });
    try {
      render(
        <Modal isOpen onClose={vi.fn()} title="Edit party">
          <input aria-label="Name" />
          <input aria-label="Phone" />
        </Modal>
      );
      screen.getByLabelText('Phone').focus();
      frames.forEach(cb => cb(0));
      expect(screen.getByLabelText('Phone')).toHaveFocus();
    } finally {
      vi.mocked(window.requestAnimationFrame).mockRestore();
    }
  });

  it('autofocuses when focus is on the dialog container', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      frames.push(cb);
      return frames.length;
    });
    try {
      render(
        <Modal isOpen onClose={vi.fn()} title="Edit party">
          <input aria-label="Name" />
        </Modal>
      );
      const dialog = screen.getByRole('dialog');
      dialog.tabIndex = -1;
      dialog.focus();
      frames.forEach(cb => cb(0));
      expect(screen.getByLabelText('Name')).toHaveFocus();
    } finally {
      vi.mocked(window.requestAnimationFrame).mockRestore();
    }
  });

  it('autofocuses only once per open, not on every re-render', async () => {
    const { rerender } = render(
      <Modal isOpen onClose={() => {}} title="Edit party">
        <input aria-label="Name" />
        <button type="button">Other</button>
      </Modal>
    );
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveFocus());
    // Focus back on the body: the guard would allow autofocus, so only "once per open" stops it.
    screen.getByLabelText('Name').blur();
    expect(document.body).toHaveFocus();
    rerender(
      <Modal isOpen onClose={() => {}} title="Edit party">
        <input aria-label="Name" />
        <button type="button">Other</button>
      </Modal>
    );
    await new Promise(r => requestAnimationFrame(() => r(null)));
    expect(screen.getByLabelText('Name')).not.toHaveFocus();
  });

  it('skips fields taken out of the tab order (e.g. a hidden file input)', async () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="New challan">
        <input type="file" tabIndex={-1} aria-label="Photo" />
        <input aria-label="Challan number" />
      </Modal>
    );
    await waitFor(() => expect(screen.getByLabelText('Challan number')).toHaveFocus());
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

  it('ignores an Escape a nested widget already handled', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Edit party">
        <input
          aria-label="Search"
          onKeyDown={e => {
            if (e.key === 'Escape') e.preventDefault();
          }}
        />
      </Modal>
    );
    await userEvent.click(screen.getByLabelText('Search'));
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
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

  it('applies the wide class for size="wide"', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Change" size="wide">
        <p>Body</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('wideSize');
    expect(dialog).not.toHaveClass('formSize');
  });

  // Regression: tall forms (add party/agreement/challan) were clipped on desktop
  // with their Cancel/Save buttons unreachable, because the form-size modal hides
  // overflow and nothing inside scrolled.
  it('lets the form-size body scroll so actions stay reachable (CSS present)', async () => {
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as {
      readFileSync(path: string, encoding: 'utf8'): string;
    };
    const css = fs.readFileSync('src/components/ui/Modal.module.css', 'utf8');
    expect(css).toMatch(/\.modal\.formSize\s*\{[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/\.modal\.formSize \.body\s*\{[^}]*overflow-y:\s*auto/);
  });
});
