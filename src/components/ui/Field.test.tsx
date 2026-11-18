import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { Checkbox, Field, Fieldset, Input, Select, Textarea } from './Field';

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

describe('Field wiring', () => {
  it('does not attach the label to a wrapper child', () => {
    render(
      <Field label="GSTIN">
        <div data-testid="wrap">
          <input aria-label="inner" />
        </div>
      </Field>
    );
    expect(screen.getByTestId('wrap')).not.toHaveAttribute('id');
    expect(screen.getByText('GSTIN')).not.toHaveAttribute('for');
  });

  it('works with a wrapper child when htmlFor targets the inner input', () => {
    render(
      <Field label="GSTIN" htmlFor="gst">
        <div>
          <input id="gst" />
          <button type="button">Fetch</button>
        </div>
      </Field>
    );
    expect(screen.getByLabelText('GSTIN')).toHaveAttribute('id', 'gst');
  });

  it('merges className and spreads div props on the root', () => {
    render(
      <Field label="A" className="layout" data-testid="root">
        <Input />
      </Field>
    );
    expect(screen.getByTestId('root')).toHaveClass('field');
    expect(screen.getByTestId('root')).toHaveClass('layout');
  });

  it('wires aria-describedby and aria-invalid from hint and error', () => {
    render(
      <Field label="Phone" hint="10 digits" error="Required">
        <Input aria-describedby="other" />
      </Field>
    );
    const input = screen.getByLabelText('Phone');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const ids = input.getAttribute('aria-describedby')!.split(' ');
    expect(ids).toContain('other');
    expect(document.getElementById(ids[1])).toHaveTextContent('10 digits');
    expect(document.getElementById(ids[2])).toHaveTextContent('Required');
  });

  it('shows an aria-hidden required marker', () => {
    render(
      <Field label="Name" required>
        <Input />
      </Field>
    );
    expect(screen.getByLabelText(/^Name/)).toBeInTheDocument();
    expect(screen.getByText('*', { exact: false })).toHaveAttribute('aria-hidden', 'true');
  });

  it('marks the auto-wired control as required', () => {
    render(
      <Field label="Name" required>
        <Input />
      </Field>
    );
    const input = screen.getByLabelText(/^Name/);
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-required', 'true');
  });

  it('leaves the control optional without required', () => {
    render(
      <Field label="Nickname">
        <Input />
      </Field>
    );
    const input = screen.getByLabelText('Nickname');
    expect(input).not.toBeRequired();
    expect(input).not.toHaveAttribute('aria-required');
  });

  it('labels a Checkbox through Field', () => {
    render(
      <Field label="Options">
        <Checkbox label="Is GST registered" />
      </Field>
    );
    expect(screen.getByLabelText('Options')).toHaveAttribute('type', 'checkbox');
  });
});

describe('Checkbox', () => {
  it('renders its label and toggles', async () => {
    render(<Checkbox label="Active" />);
    const box = screen.getByLabelText('Active');
    await userEvent.click(box);
    expect(box).toBeChecked();
  });

  it('works with register', async () => {
    const onSubmit = vi.fn();
    function H() {
      const { register, handleSubmit } = useForm<{ on: boolean }>({ defaultValues: { on: false } });
      return (
        <form onSubmit={handleSubmit(onSubmit)}>
          <Checkbox label="On" {...register('on')} />
          <button type="submit">Go</button>
        </form>
      );
    }
    render(<H />);
    await userEvent.click(screen.getByLabelText('On'));
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onSubmit.mock.calls[0][0]).toEqual({ on: true });
  });

  it('Input type checkbox does not get the box control class', () => {
    render(<Input type="checkbox" aria-label="c" />);
    const el = screen.getByLabelText('c');
    expect(el).toHaveClass('check');
    expect(el).not.toHaveClass('control');
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

  it('Select gets the kit chevron class; Input does not', () => {
    render(
      <>
        <Select aria-label="Status" className="placed">
          <option>All statuses</option>
        </Select>
        <Input aria-label="Search" />
      </>
    );
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveClass(
      'control',
      'select',
      'placed'
    );
    expect(screen.getByLabelText('Search')).not.toHaveClass('select');
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

describe('Field labelAction', () => {
  it('renders the action outside the label and keeps the association', () => {
    render(
      <Field label="Password" labelAction={<a href="/forgot">Forgot?</a>}>
        <Input type="password" />
      </Field>
    );
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    const link = screen.getByRole('link', { name: 'Forgot?' });
    expect(link.closest('label')).toBeNull();
    expect(link.closest('.labelRow')).not.toBeNull();
  });

  it('renders no label row without an action', () => {
    const { container } = render(
      <Field label="Email">
        <Input />
      </Field>
    );
    expect(container.querySelector('.labelRow')).toBeNull();
  });
});

describe('control size', () => {
  it('applies lg to Input and Select', () => {
    render(
      <>
        <Input aria-label="Email" size="lg" />
        <Select aria-label="Role" size="lg">
          <option>Owner</option>
        </Select>
      </>
    );
    expect(screen.getByLabelText('Email')).toHaveClass('control', 'lg');
    expect(screen.getByLabelText('Role')).toHaveClass('control', 'lg');
  });

  it('does not apply lg by default', () => {
    render(<Input aria-label="Email" />);
    expect(screen.getByLabelText('Email')).not.toHaveClass('lg');
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('size');
  });
});
