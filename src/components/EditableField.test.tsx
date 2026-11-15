import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
});
