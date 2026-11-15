import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeAutocomplete, type AutocompleteItem } from './CodeAutocomplete';

const items: AutocompleteItem[] = [
  { id: '1', code: 'PIPE', label: 'Steel Pipe' },
  { id: '2', code: 'CLMP', label: 'Clamp' },
  { id: '3', code: 'PLNK', label: 'Wooden Plank' },
];

/** Controlled wrapper, the way forms use the component. */
function Harness({ onSelect = vi.fn() }: { onSelect?: (item: AutocompleteItem) => void }) {
  const [value, setValue] = useState('');
  return (
    <CodeAutocomplete
      label="Item"
      value={value}
      onChange={setValue}
      items={items}
      onSelect={onSelect}
    />
  );
}

const setup = (onSelect = vi.fn()) => {
  const user = userEvent.setup();
  render(<Harness onSelect={onSelect} />);
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
});
