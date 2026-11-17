import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { EmployeeForm } from './EmployeeForm';
import { renderWithProviders } from '../../test/render';
import type { Employee } from '../../types';

function setup(initialData?: Employee) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const utils = renderWithProviders(
    <EmployeeForm initialData={initialData} onSubmit={onSubmit} onCancel={onCancel} />
  );
  return { ...utils, onSubmit, onCancel };
}

type User = ReturnType<typeof setup>['user'];

/** Pick a salary type; the control is the only thing that differs between layouts. */
async function chooseSalary(user: User, which: 'Monthly' | 'Daily') {
  await user.selectOptions(screen.getByLabelText(/salary type/i), which.toLowerCase());
}

describe('EmployeeForm', () => {
  it('submits the exact payload for a transporter on a monthly salary', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/^name/i, { selector: '#emp-name' }), 'Ramesh Kumar');
    await user.type(screen.getByLabelText(/^phone/i, { selector: '#emp-phone' }), '9820041275');
    await user.selectOptions(screen.getByLabelText(/^type/i), 'transporter');
    await user.type(screen.getByLabelText(/designation/i), 'Driver');
    await user.type(screen.getByLabelText(/joining date/i), '2026-04-01');
    await user.type(screen.getByLabelText(/vehicle number/i), 'mh12ab1234');
    // Shown in capitals (kit Input uppercase), sent as typed.
    expect(screen.getByLabelText(/vehicle number/i)).toHaveClass('uppercase');
    await chooseSalary(user, 'Monthly');
    await user.type(screen.getByLabelText(/monthly salary/i), '18000');
    await user.type(screen.getByLabelText(/overtime rate/i), '90.5');
    await user.type(screen.getByLabelText(/^address/i), 'Pune');
    await user.type(screen.getByLabelText(/^name/i, { selector: '#emp-ec-name' }), 'Sita');
    await user.type(screen.getByLabelText(/^notes/i), 'Night shift');
    await user.click(screen.getByRole('button', { name: /^add employee$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      name: 'Ramesh Kumar',
      phone: '9820041275',
      type: 'transporter',
      designation: 'Driver',
      address: 'Pune',
      joiningDate: '2026-04-01',
      notes: 'Night shift',
      salaryType: 'monthly',
      monthlySalary: 18000,
      overtimeRatePerHour: 90.5,
      details: { vehicleNumber: 'mh12ab1234' },
      emergencyContact: { name: 'Sita', phone: '' },
    });
  });

  it('rejects a negative salary with a message and does not submit', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/^name/i, { selector: '#emp-name' }), 'Anil');
    await chooseSalary(user, 'Monthly');
    await user.type(screen.getByLabelText(/monthly salary/i), '-5');
    await user.click(screen.getByRole('button', { name: /^add employee$/i }));
    expect(await screen.findByText('Enter 0 or more')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ignores a negative salary hidden by a salary type switch', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/^name/i, { selector: '#emp-name' }), 'Anil');
    await chooseSalary(user, 'Monthly');
    await user.type(screen.getByLabelText(/monthly salary/i), '-5');
    await chooseSalary(user, 'Daily');
    await user.type(screen.getByLabelText(/daily rate/i), '650');
    await user.click(screen.getByRole('button', { name: /^add employee$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Enter 0 or more')).not.toBeInTheDocument();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ salaryType: 'daily', dailyRate: 650 });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('monthlySalary');
  });

  it('rejects a negative overtime rate and a negative daily rate', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/^name/i, { selector: '#emp-name' }), 'Anil');
    await chooseSalary(user, 'Daily');
    await user.type(screen.getByLabelText(/daily rate/i), '-1');
    await user.type(screen.getByLabelText(/overtime rate/i), '-2');
    await user.click(screen.getByRole('button', { name: /^add employee$/i }));
    expect(await screen.findAllByText('Enter 0 or more')).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a daily rate and drops the monthly one', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/^name/i, { selector: '#emp-name' }), 'Anil');
    await chooseSalary(user, 'Monthly');
    await user.type(screen.getByLabelText(/monthly salary/i), '100');
    await chooseSalary(user, 'Daily');
    expect(screen.queryByLabelText(/monthly salary/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/daily rate/i), '650');
    await user.click(screen.getByRole('button', { name: /^add employee$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      name: 'Anil',
      phone: undefined,
      type: 'general',
      designation: undefined,
      address: undefined,
      joiningDate: undefined,
      notes: undefined,
      salaryType: 'daily',
      dailyRate: 650,
    });
  });

  it('submits only the name with empty optionals omitted', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/^name/i, { selector: '#emp-name' }), 'Anil');
    await user.click(screen.getByRole('button', { name: /^add employee$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      name: 'Anil',
      phone: undefined,
      type: 'general',
      designation: undefined,
      address: undefined,
      joiningDate: undefined,
      notes: undefined,
    });
  });

  it('requires a name', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('button', { name: /^add employee$/i }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('edits an existing employee with the type locked', async () => {
    const { user, onSubmit, onCancel } = setup({
      _id: 'e1',
      name: 'Old Name',
      phone: '111',
      type: 'worker',
      salaryType: 'daily',
      dailyRate: 500,
      emergencyContact: { name: 'Kin', phone: '222' },
      joiningDate: '2026-01-05T00:00:00.000Z',
    } as Employee);
    expect(screen.getByLabelText(/^type/i)).toBeDisabled();
    expect(screen.getByLabelText(/daily rate/i)).toHaveValue(500);
    const name = screen.getByLabelText(/^name/i, { selector: '#emp-name' });
    await user.clear(name);
    await user.type(name, 'New Name');
    await user.click(screen.getByRole('button', { name: /^update employee$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'New Name',
      phone: '111',
      type: 'worker',
      joiningDate: '2026-01-05',
      salaryType: 'daily',
      dailyRate: 500,
      emergencyContact: { name: 'Kin', phone: '222' },
    });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
