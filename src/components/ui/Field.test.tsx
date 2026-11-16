import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { Field, Fieldset, Input, Select, Textarea } from './Field';

describe('Field', () => {
  it('associates the label with the child via an auto id', () => {
    render(
      <Field label="Party name">
        <Input />
      </Field>
    );
    expect(screen.getByLabelText('Party name')).toBeInTheDocument();
  });

  it('uses an explicit htmlFor and keeps the child id', () => {
    render(
      <Field label="City" htmlFor="city">
        <Input id="city" />
      </Field>
    );
    expect(screen.getByLabelText('City')).toHaveAttribute('id', 'city');
  });

  it('keeps an existing child id when htmlFor is omitted', () => {
    render(
      <Field label="GSTIN">
        <Input id="gstin" />
      </Field>
    );
    expect(screen.getByLabelText('GSTIN')).toHaveAttribute('id', 'gstin');
  });

  it('renders hint and an alert error', () => {
    render(
      <Field label="Phone" hint="10 digits" error="Required">
        <Input invalid />
      </Field>
    );
    expect(screen.getByText('10 digits')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
    expect(screen.getByLabelText('Phone')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders no alert without an error', () => {
    render(
      <Field label="Phone">
        <Input />
      </Field>
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Phone')).not.toHaveAttribute('aria-invalid');
  });

  it('works with non-element children', () => {
    render(<Field label="Static">text only</Field>);
    expect(screen.getByText('Static')).toBeInTheDocument();
  });
});

describe('inputs', () => {
  it('Input adds mono class and merges className', () => {
    render(<Input aria-label="n" mono className="extra" />);
    const el = screen.getByLabelText('n');
    expect(el).toHaveClass('mono');
    expect(el).toHaveClass('extra');
  });

  it('Input forwards native props', async () => {
    const onChange = vi.fn();
    render(<Input aria-label="n" placeholder="Name" data-testid="x" onChange={onChange} />);
    await userEvent.type(screen.getByTestId('x'), 'a');
    expect(onChange).toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
  });

  it('Select renders options and invalid state', () => {
    render(
      <Select aria-label="Type" invalid mono>
        <option value="a">A</option>
      </Select>
    );
    const el = screen.getByRole('combobox', { name: 'Type' });
    expect(el).toHaveAttribute('aria-invalid', 'true');
    expect(el).toHaveClass('mono');
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();
  });

  it('Textarea renders with invalid and mono', () => {
    render(<Textarea aria-label="Notes" invalid mono rows={3} />);
    const el = screen.getByRole('textbox', { name: 'Notes' });
    expect(el).toHaveAttribute('aria-invalid', 'true');
    expect(el).toHaveClass('mono');
    expect(el).toHaveAttribute('rows', '3');
  });
});

describe('react-hook-form integration', () => {
  type Values = { name: string; kind: string; notes: string };
  function Harness({ onSubmit }: { onSubmit: (v: Values) => void }) {
    const { register, handleSubmit } = useForm<Values>({ defaultValues: { kind: 'b' } });
    return (
      <form onSubmit={handleSubmit(onSubmit)}>
        <Field label="Party name">
          <Input {...register('name')} />
        </Field>
        <Field label="Kind">
          <Select {...register('kind')}>
            <option value="a">A</option>
            <option value="b">B</option>
          </Select>
        </Field>
        <Field label="Notes">
          <Textarea {...register('notes')} />
        </Field>
        <button type="submit">Save</button>
      </form>
    );
  }

  it('receives typed values through register refs', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Party name'), 'Acme');
    await userEvent.selectOptions(screen.getByLabelText('Kind'), 'a');
    await userEvent.type(screen.getByLabelText('Notes'), 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({ name: 'Acme', kind: 'a', notes: 'hello' });
  });
});

describe('Fieldset', () => {
  it('renders a group with legend', () => {
    render(
      <Fieldset legend="Billing">
        <Input aria-label="x" />
      </Fieldset>
    );
    expect(screen.getByRole('group', { name: 'Billing' })).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
  });

  it('forwards native props', () => {
    render(
      <Fieldset legend="L" disabled data-testid="fs">
        <Input aria-label="x" />
      </Fieldset>
    );
    expect(screen.getByTestId('fs')).toBeDisabled();
  });
});
