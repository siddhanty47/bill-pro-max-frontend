import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RowActions } from './RowActions';
import { Button } from './Button';

describe('RowActions', () => {
  it('renders the primary action and a More actions menu', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onDownload = vi.fn();
    render(
      <RowActions
        primary={<Button size="sm">Send</Button>}
        items={[
          { label: 'Download', onClick: onDownload, icon: 'arrow-right' },
          { label: 'Delete', onClick: onDelete, tone: 'danger' },
        ]}
      />
    );
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveClass('danger');
    expect(screen.getByRole('menuitem', { name: 'Download' })).not.toHaveClass('danger');
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDownload).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows a hint under the label and describes the item with it', async () => {
    const user = userEvent.setup();
    render(
      <RowActions
        items={[{ label: 'Delete', onClick: vi.fn(), disabled: true, hint: 'Items are rented' }]}
      />
    );
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    const item = screen.getByRole('menuitem', { name: 'Delete' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Items are rented')).toBeVisible();
    expect(item).toHaveAccessibleDescription('Items are rented');
  });

  it('keeps a disabled danger item inert while its hint stays visible', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <RowActions
        items={[{ label: 'Delete', onClick, tone: 'danger', disabled: true, hint: 'In use' }]}
      />
    );
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    const item = screen.getByRole('menuitem', { name: 'Delete' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('In use')).toBeVisible();
    await user.click(item);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('disables an item', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<RowActions items={[{ label: 'Download', onClick, disabled: true }]} />);
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    const item = screen.getByRole('menuitem', { name: 'Download' });
    await user.click(item);
    expect(onClick).not.toHaveBeenCalled();
    item.focus();
    expect(item).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('omits the menu when there are no items', () => {
    render(<RowActions primary={<Button size="sm">Send</Button>} items={[]} />);
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
  });

  it('does not let clicks reach the row', async () => {
    const user = userEvent.setup();
    const onRow = vi.fn();
    render(
      <div onClick={onRow}>
        <RowActions
          primary={<Button size="sm">Send</Button>}
          items={[{ label: 'Delete', onClick: () => {} }]}
        />
      </div>
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menu'));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onRow).not.toHaveBeenCalled();
  });
});
