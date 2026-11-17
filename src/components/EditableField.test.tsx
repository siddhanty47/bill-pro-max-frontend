import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readCss } from '../test/readCss';
import { EditableField } from './EditableField';

const setup = (props: Partial<Parameters<typeof EditableField>[0]> = {}) => {
  const onSave = vi.fn(async () => {});
  const user = userEvent.setup();
  const utils = render(
    <EditableField label="Name" value="Sharma" inputType="text" onSave={onSave} {...props} />
  );
  const startEditing = () => user.click(screen.getByRole('button', { name: /Sharma/ }));
  return { user, onSave, startEditing, ...utils };
};

describe('EditableField', () => {
  it('saves the edited value on Enter', async () => {
    const { user, onSave, startEditing } = setup();

    await startEditing();
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'Verma{Enter}');

    expect(onSave).toHaveBeenCalledWith('Verma');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('cancels on Escape without saving', async () => {
    const { user, onSave, startEditing } = setup();

    await startEditing();
    await user.type(screen.getByRole('textbox'), 'xyz{Escape}');

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Sharma/ })).toBeInTheDocument();
  });

  it('does not save when the value is unchanged', async () => {
    const { user, onSave, startEditing } = setup();

    await startEditing();
    await user.keyboard('{Enter}');

    expect(onSave).not.toHaveBeenCalled();
  });

  it('converts number inputs before saving', async () => {
    const onSave = vi.fn(async () => {});
    const user = userEvent.setup();
    render(<EditableField label="Rate" value={10} inputType="number" onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /10/ }));
    await user.clear(screen.getByRole('spinbutton'));
    await user.type(screen.getByRole('spinbutton'), '12.5{Enter}');

    expect(onSave).toHaveBeenCalledWith(12.5);
  });

  it('shows the API error message and stays in edit mode when saving fails', async () => {
    const onSave = vi.fn(async () => {
      throw { data: { error: { message: 'Code already exists' } } };
    });
    const { user, startEditing } = setup({ onSave });

    await startEditing();
    await user.type(screen.getByRole('textbox'), '2{Enter}');

    expect(await screen.findByText('Code already exists')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Sharma2');
  });

  it('starts editing from the latest value after the prop changes', async () => {
    const { user, rerender, onSave } = setup();

    rerender(<EditableField label="Name" value="Gupta" inputType="text" onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: /Gupta/ }));

    expect(screen.getByRole('textbox')).toHaveValue('Gupta');
  });

  it('cancels from the Cancel button without saving', async () => {
    const { user, onSave, startEditing } = setup();

    await startEditing();
    await user.type(screen.getByRole('textbox'), 'xyz');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Sharma/ })).toBeInTheDocument();
  });

  it('saves once from the Save button', async () => {
    const { user, onSave, startEditing } = setup();

    await startEditing();
    await user.type(screen.getByRole('textbox'), 'ji');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('Sharmaji');
  });

  it('shows an Edit hint and labels the input with the field label', async () => {
    const { startEditing } = setup({ mono: true });

    const trigger = screen.getByRole('button', { name: /Sharma/ });
    expect(trigger).toHaveTextContent('Edit');
    expect(trigger).toHaveClass('mono');
    await startEditing();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
  });

  it('keeps the empty placeholder in the text font on a mono field', async () => {
    render(<EditableField label="GST" value="" inputType="text" mono onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Not added/ })).toHaveClass('mono');
    expect(screen.getByText('Not added')).toHaveClass('empty');
    expect(await readCss('src/components/EditableField.module.css')).toMatch(
      /\.empty\s*{[^}]*font-family:\s*var\(--font-sans\)/
    );
  });

  it('keeps compact (table cell) text flush with the column: same bleed as the default trigger', async () => {
    render(
      <EditableField label="Address" value="Plot 12" inputType="text" compact onSave={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: /Plot 12/ })).toHaveClass('trigger', 'compact');
    // No compact override that zeroes the trigger's negative inline margin.
    expect(await readCss('src/components/EditableField.module.css')).not.toMatch(
      /\.compact\.trigger\s*{[^}]*margin:\s*0/
    );
  });

  it('right-aligns the trigger (hint before the value) and the input', async () => {
    const user = userEvent.setup();
    render(
      <EditableField
        label="Quantity"
        value={10}
        inputType="number"
        align="right"
        onSave={vi.fn()}
      />
    );
    const trigger = screen.getByRole('button', { name: /10/ });
    expect(trigger).toHaveClass('trigger', 'right');
    expect(trigger.firstElementChild).toHaveTextContent('Edit');
    expect(trigger.lastElementChild).toHaveTextContent('10');
    await user.click(trigger);
    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toHaveClass('rightInput');
  });

  it('shows "Not added" for an empty value and edits selects and textareas', async () => {
    const onSave = vi.fn(async () => {});
    const user = userEvent.setup();
    const { rerender } = render(
      <EditableField
        label="Type"
        value=""
        inputType="select"
        options={[
          { value: '', label: 'None' },
          { value: 'client', label: 'Client' },
        ]}
        onSave={onSave}
      />
    );
    await user.click(screen.getByRole('button', { name: /Not added/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'client');
    await user.keyboard('{Enter}');
    expect(onSave).toHaveBeenCalledWith('client');

    rerender(<EditableField label="Notes" value="hi" inputType="textarea" onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: /hi/ }));
    await user.type(screen.getByRole('textbox', { name: 'Notes' }), '{Enter}there');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenLastCalledWith('hi\nthere');
  });

  it('uses a custom edit renderer', async () => {
    const { user, onSave, startEditing } = setup({
      renderEditInput: ({ onChange, onSave: save }) => (
        <button type="button" onClick={() => onChange('Custom')} onDoubleClick={() => save()}>
          Pick
        </button>
      ),
    });

    await startEditing();
    await user.click(screen.getByRole('button', { name: 'Pick' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith('Custom');
  });

  it('saves an override passed by a custom renderer, not the stale edit value', async () => {
    const { user, onSave, startEditing } = setup({
      renderEditInput: ({ onChange, onSave: save }) => (
        <button
          type="button"
          onClick={() => {
            onChange('Picked');
            save('Picked');
          }}
        >
          Pick
        </button>
      ),
    });

    await startEditing();
    await user.click(screen.getByRole('button', { name: 'Pick' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('Picked');
  });

  it('shows a busy state while saving', () => {
    setup({ isSaving: true });
    const trigger = screen.getByRole('button', { name: /Edit/ });
    expect(trigger).toHaveAttribute('aria-busy', 'true');
  });

  it('opens with the keyboard', async () => {
    const { user } = setup();
    screen.getByRole('button', { name: /Sharma/ }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('textbox')).toHaveValue('Sharma');
  });

  it('does not save when tabbing from the input to Cancel, and Cancel then cancels', async () => {
    const { user, onSave, startEditing } = setup();

    await startEditing();
    await user.type(screen.getByRole('textbox'), 'xyz');
    await user.tab(); // Save
    await user.tab(); // Cancel
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(onSave).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Sharma/ })).toBeInTheDocument();
  });

  it('saves from the keyboard on Save, once', async () => {
    const { user, onSave, startEditing } = setup();

    await startEditing();
    await user.type(screen.getByRole('textbox'), '2');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('Sharma2');
  });

  it('saves when focus leaves the editor', async () => {
    const onSave = vi.fn(async () => {});
    const user = userEvent.setup();
    render(
      <>
        <EditableField label="Name" value="Sharma" inputType="text" onSave={onSave} />
        <button type="button">Elsewhere</button>
      </>
    );
    await user.click(screen.getByRole('button', { name: /Sharma/ }));
    await user.type(screen.getByRole('textbox'), '3');
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(onSave).toHaveBeenCalledWith('Sharma3');
  });
});
