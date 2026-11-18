import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeAutocomplete, type AutocompleteItem } from './CodeAutocomplete';

const items: AutocompleteItem[] = [
  { id: '1', code: 'PIPE', label: 'Steel Pipe' },
  { id: '2', code: 'CLMP', label: 'Clamp' },
  { id: '3', code: 'PLNK', label: 'Wooden Plank' },
];

/** Controlled wrapper, the way forms use the component. */
type HarnessProps = Partial<React.ComponentProps<typeof CodeAutocomplete>>;

function Harness({ onSelect = vi.fn(), label = 'Item', ...rest }: HarnessProps) {
  const [value, setValue] = useState('');
  return (
    <CodeAutocomplete
      label={label}
      value={value}
      onChange={setValue}
      items={items}
      onSelect={onSelect}
      {...rest}
    />
  );
}

const setup = (onSelect = vi.fn(), props: HarnessProps = {}) => {
  const user = userEvent.setup();
  render(<Harness onSelect={onSelect} {...props} />);
  return { user, onSelect, input: screen.getByRole('combobox') };
};

describe('CodeAutocomplete', () => {
  it('filters by code or label, case-insensitively', async () => {
    const { user, input } = setup();

    await user.type(input, 'pl');

    expect((await screen.findAllByRole('option')).map(o => o.textContent)).toEqual([
      expect.stringContaining('Wooden Plank'),
    ]);
  });

  it('shows the first items when focused with an empty value', async () => {
    const { user, input } = setup();

    await user.click(input);

    expect(await screen.findAllByRole('option')).toHaveLength(3);
  });

  it('selects the highlighted option with ArrowDown + Enter', async () => {
    const { user, input, onSelect } = setup();

    await user.type(input, 'c');
    await screen.findAllByRole('option');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith(items[1]); // "c" matches only CLMP/Clamp
    expect(input).toHaveValue('CLMP');
  });

  it('selects an option on click', async () => {
    const { user, input, onSelect } = setup();

    await user.click(input);
    await user.click(await screen.findByText('Steel Pipe'));

    expect(onSelect).toHaveBeenCalledWith(items[0]);
    expect(input).toHaveValue('PIPE');
  });

  it('resets the highlight when the query changes', async () => {
    const { user, input, onSelect } = setup();

    await user.click(input);
    await screen.findAllByRole('option');
    await user.keyboard('{ArrowDown}{ArrowDown}'); // highlight Clamp
    await user.type(input, 'p'); // list changes → highlight cleared
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith(items[0]); // first match for "p" is PIPE
  });

  it('closes on Escape', async () => {
    const { user, input } = setup();

    await user.click(input);
    await screen.findAllByRole('option');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('links the label to the input and marks required with exactly one star', () => {
    setup(vi.fn(), { label: 'Party', required: true });
    const input = screen.getByLabelText(/^party/i);
    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-required', 'true');
    // The form's schema validates; no native `required` that would pre-empt it.
    expect(input).not.toHaveAttribute('required');
    expect(screen.getByText(/^Party/, { selector: 'label' }).textContent).toBe('Party *');
  });

  it('shows the error once and marks the input invalid', () => {
    setup(vi.fn(), { error: 'Select a party' });
    expect(screen.getByRole('alert')).toHaveTextContent('Select a party');
    expect(screen.getAllByText('Select a party')).toHaveLength(1);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('takes an aria-label when it has no visible label, and still shows errors', () => {
    setup(vi.fn(), { label: '', 'aria-label': 'Item for row 1', error: 'Select an item' });
    expect(screen.getByRole('combobox', { name: 'Item for row 1' })).toBeInTheDocument();
    expect(screen.queryByText('Item', { selector: 'label' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Select an item');
  });

  it('wires the combobox to the listbox and the highlighted option', async () => {
    const { user, input } = setup();
    await user.click(input);
    const listbox = await screen.findByRole('listbox');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(input).not.toHaveAttribute('aria-activedescendant');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id);
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });

  it('stops at the last option and opens with the arrow keys', async () => {
    const { user, input, onSelect } = setup();
    await user.click(input);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.keyboard('{ArrowUp}');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith(items[2]);
  });

  it('closes on Tab and on an outside click', async () => {
    const { user, input } = setup();
    await user.click(input);
    await screen.findByRole('listbox');
    await user.tab();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.click(input);
    await screen.findByRole('listbox');
    await user.click(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('says when nothing matches', async () => {
    const { user, input } = setup();
    await user.type(input, 'zzz');
    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-controls');
  });

  it('portals the panel to the body and places it under the input', async () => {
    const { user, input } = setup();
    input.getBoundingClientRect = () =>
      ({ top: 100, bottom: 140, left: 50, right: 250, width: 200, height: 40 }) as DOMRect;
    await user.click(input);
    const panel = (await screen.findByRole('listbox')).parentElement as HTMLElement;
    expect(panel.parentElement).toBe(document.body);
    expect(panel.style.top).toBe('146px');
    expect(panel.style.left).toBe('50px');
    expect(panel.style.width).toBe('200px');
    // Repositions on scroll instead of closing.
    input.getBoundingClientRect = () =>
      ({ top: 60, bottom: 100, left: 50, right: 250, width: 200, height: 40 }) as DOMRect;
    fireEvent.scroll(window);
    expect(panel.style.top).toBe('106px');
  });

  it('spans the viewport on narrow phones (no fixed width)', async () => {
    const original = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    try {
      const { user, input } = setup();
      await user.click(input);
      const panel = (await screen.findByRole('listbox')).parentElement as HTMLElement;
      expect(panel.style.width).toBe('');
      expect(panel.style.left).toBe('');
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: original });
    }
  });

  it('is disabled when asked', () => {
    setup(vi.fn(), { disabled: true });
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
