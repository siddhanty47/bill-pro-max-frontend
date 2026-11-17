import { describe, expect, it, vi, afterEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { EmployeeList } from './EmployeeList';
import { renderWithProviders } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { Employee } from '../types';

const emp = (over: Partial<Employee>): Employee =>
  ({
    _id: 'e1',
    businessId: 'biz-1',
    name: 'Kiran',
    phone: '98200',
    type: 'transporter',
    details: { vehicleNumber: 'MH12AB1234' },
    isActive: true,
    ...over,
  }) as Employee;

const rows = [
  emp({}),
  emp({ _id: 'e2', name: 'Dev', phone: undefined, details: undefined, isActive: false }),
  emp({ _id: 'e3', name: 'Worker Joe', type: 'worker' }),
];

const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

afterEach(() => vi.restoreAllMocks());

describe('EmployeeList', () => {
  it('lists only transporters with vehicle and status', () => {
    renderWithProviders(<EmployeeList employees={rows} businessId="biz-1" onEdit={vi.fn()} />);
    expect(bodyRows()).toHaveLength(2);
    expect(within(bodyRows()[0]).getByText('MH12AB1234')).toBeInTheDocument();
    expect(within(bodyRows()[0]).getByText('Active')).toBeInTheDocument();
    expect(within(bodyRows()[1]).getByText('Inactive')).toBeInTheDocument();
    expect(screen.queryByText('Worker Joe')).toBeNull();
  });

  it('edits through the primary action', async () => {
    const onEdit = vi.fn();
    const { user } = renderWithProviders(
      <EmployeeList employees={rows} businessId="biz-1" onEdit={onEdit} />
    );
    await user.click(within(bodyRows()[0]).getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith(rows[0]);
  });

  it('removes an active employee after confirming and not an inactive one', async () => {
    let hit = false;
    server.use(
      http.delete(apiUrl('/businesses/biz-1/employees/e1'), () => {
        hit = true;
        return ok(null);
      })
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderWithProviders(
      <EmployeeList employees={rows} businessId="biz-1" onEdit={vi.fn()} />
    );
    expect(within(bodyRows()[1]).queryByRole('button', { name: 'More actions' })).toBeNull();
    await user.click(within(bodyRows()[0]).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    await waitFor(() => expect(hit).toBe(true));
  });

  it('does not remove when the confirm is declined', async () => {
    let hit = false;
    server.use(
      http.delete(apiUrl('/businesses/biz-1/employees/e1'), () => {
        hit = true;
        return ok(null);
      })
    );
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = renderWithProviders(
      <EmployeeList employees={rows} businessId="biz-1" onEdit={vi.fn()} />
    );
    await user.click(within(bodyRows()[0]).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    expect(hit).toBe(false);
  });

  it('shows the phone list', () => {
    renderWithProviders(<EmployeeList employees={rows} businessId="biz-1" onEdit={vi.fn()} />);
    const item = within(screen.getByRole('list', { name: 'Transporters' })).getAllByRole(
      'listitem'
    )[0];
    expect(item).toHaveTextContent('Kiran');
    expect(item).toHaveTextContent('MH12AB1234');
    expect(item).toHaveTextContent('98200');
  });

  it('shows empty states', () => {
    const { unmount } = renderWithProviders(
      <EmployeeList employees={[]} businessId="biz-1" onEdit={vi.fn()} />
    );
    expect(screen.getByText('No employees yet')).toBeInTheDocument();
    unmount();
    renderWithProviders(<EmployeeList employees={[rows[2]]} businessId="biz-1" onEdit={vi.fn()} />);
    expect(screen.getByText('No transporters yet')).toBeInTheDocument();
  });
});
