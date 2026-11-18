import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { EmployeeDetailPage } from './EmployeeDetailPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { Employee } from '../types';

const BASE = '/businesses/biz-1/employees/e1';

const makeEmployee = (over: Partial<Employee> = {}): Employee =>
  ({
    _id: 'e1',
    businessId: 'biz-1',
    name: 'Kiran Patel',
    phone: '9820041275',
    type: 'worker',
    designation: 'Rigger',
    address: '4 Dock Road',
    joiningDate: '2025-03-05T00:00:00.000Z',
    salaryType: 'monthly',
    monthlySalary: 25000,
    overtimeRatePerHour: 150,
    emergencyContact: { name: 'Asha', phone: '9000011111' },
    notes: 'Night shifts only',
    isActive: true,
    createdAt: '2025-03-01T08:30:00.000Z',
    updatedAt: '2025-04-02T08:30:00.000Z',
    ...over,
  }) as Employee;

const salary = {
  month: 11,
  year: 2026,
  workingDays: 26,
  effectiveDays: 22,
  overtimeHours: 4,
  sundaysWorked: 1,
  salaryType: 'monthly',
  monthlySalary: 25000,
  dailyRate: 0,
  overtimeRatePerHour: 150,
  baseSalary: 21154,
  overtimePay: 600,
  totalPay: 21754,
};

function useApi(employee: Employee = makeEmployee()) {
  const salaryMonths: string[] = [];
  server.use(
    http.get(apiUrl('/businesses'), () => ok([])),
    http.get(apiUrl(BASE), () => ok(employee)),
    http.get(apiUrl(`${BASE}/attendance`), () => ok([])),
    http.get(apiUrl(`${BASE}/attendance/summary`), () => ok(null)),
    http.get(apiUrl(`${BASE}/attendance/salary-breakdown`), ({ request }) => {
      const u = new URL(request.url);
      salaryMonths.push(`${u.searchParams.get('year')}-${u.searchParams.get('month')}`);
      return ok(salary);
    })
  );
  return salaryMonths;
}

function capture(method: 'patch' | 'delete') {
  const bodies: unknown[] = [];
  server.use(
    http[method](apiUrl(BASE), async ({ request }) => {
      bodies.push(method === 'patch' ? await request.json() : null);
      return ok(makeEmployee());
    })
  );
  return bodies;
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/team/employees/:employeeId" element={<EmployeeDetailPage />} />
      <Route path="/team/employees" element={<div>employee list</div>} />
    </Routes>,
    { preloadedState: signedIn(), route: '/team/employees/e1' }
  );
}

const section = (title: string) => screen.getByRole('heading', { name: title }).closest('section')!;

afterEach(() => vi.restoreAllMocks());

describe('EmployeeDetailPage', () => {
  it('shows a spinner then the error', async () => {
    useApi();
    server.use(
      http.get(apiUrl(BASE), () =>
        HttpResponse.json(
          { success: false, error: { message: 'No such employee' } },
          { status: 404 }
        )
      )
    );
    renderPage();
    expect(screen.getByText('Loading employee…')).toBeInTheDocument();
    expect(await screen.findByText(/No such employee/)).toBeInTheDocument();
  });

  it('renders header, one status chip, tabs and the details sidebar', async () => {
    useApi();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Kiran Patel', level: 1 })).toBeVisible();
    expect(screen.getByText('Employee')).toBeVisible();
    expect(screen.getAllByText('Active')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Back to Employees' })).toHaveAttribute(
      'href',
      '/team'
    );
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual([
      'About',
      'Attendance',
      'Salary',
      'Change history',
    ]);
    const details = section('Details');
    expect(within(details).queryByText('Status')).not.toBeInTheDocument();
    expect(within(details).getByText('Worker')).toBeVisible();
    expect(within(details).getByText('1 Mar 2025')).toBeVisible();
    expect(within(details).getByText('2 Apr 2025')).toBeVisible();
  });

  it('renders contact, salary and notes with mono numbers and plain units', async () => {
    useApi();
    renderPage();
    await screen.findByRole('heading', { name: 'Kiran Patel', level: 1 });
    const basic = section('Basic information');
    expect(within(basic).getByRole('button', { name: /9820041275/ })).toHaveClass('mono');
    expect(within(basic).getByText('5 Mar 2025')).toBeVisible();
    const salaryCard = section('Salary details');
    const monthly = within(salaryCard).getByText('₹25,000');
    expect(monthly).toHaveClass('mono');
    expect(monthly.parentElement).toHaveTextContent('₹25,000 / month');
    expect(within(salaryCard).getByText('₹150')).toHaveClass('mono');
    expect(within(salaryCard).queryByText('Daily rate')).not.toBeInTheDocument();
    expect(screen.getByText('Night shifts only')).toBeVisible();
    expect(within(section('Emergency contact')).getByText('Asha')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Vehicle details' })).not.toBeInTheDocument();
  });

  it('shows the daily rate, vehicle details and placeholders', async () => {
    useApi(
      makeEmployee({
        type: 'transporter',
        details: { vehicleNumber: 'MH12AB1234' },
        salaryType: 'daily',
        dailyRate: 850,
        monthlySalary: undefined,
        overtimeRatePerHour: undefined,
        phone: undefined,
        notes: undefined,
        emergencyContact: undefined,
        joiningDate: undefined,
      })
    );
    renderPage();
    await screen.findByRole('heading', { name: 'Kiran Patel', level: 1 });
    expect(within(section('Salary details')).getByText('₹850')).toHaveClass('mono');
    expect(within(section('Salary details')).queryByText('Monthly salary')).not.toBeInTheDocument();
    expect(within(section('Vehicle details')).getByText('MH12AB1234')).toBeVisible();
    expect(within(section('Basic information')).getAllByText('Not added').length).toBeGreaterThan(
      1
    );
  });

  it('shows an inactive employee without a delete button', async () => {
    useApi(makeEmployee({ isActive: false }));
    renderPage();
    expect(await screen.findByText('Inactive')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
  });

  it('saves a field with only that field in the PATCH body', async () => {
    useApi();
    const bodies = capture('patch');
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: /Rigger/ }));
    const input = screen.getByRole('textbox', { name: 'Designation' });
    await user.clear(input);
    await user.type(input, 'Foreman{Enter}');
    await waitFor(() => expect(bodies).toEqual([{ designation: 'Foreman' }]));
  });

  it('saves a salary amount as a number', async () => {
    useApi();
    const bodies = capture('patch');
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: /25,000/ }));
    const input = screen.getByRole('spinbutton', { name: 'Monthly salary' });
    await user.clear(input);
    await user.type(input, '27000{Enter}');
    await waitFor(() => expect(bodies).toEqual([{ monthlySalary: 27000 }]));
  });

  it('saves the emergency contact merged with the existing one', async () => {
    useApi();
    const bodies = capture('patch');
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: /9000011111/ }));
    const input = screen.getByRole('textbox', { name: 'Phone' });
    await user.clear(input);
    await user.type(input, '9111122222{Enter}');
    await waitFor(() =>
      expect(bodies).toEqual([{ emergencyContact: { name: 'Asha', phone: '9111122222' } }])
    );
  });

  it('cancels an edit with Escape', async () => {
    useApi();
    const bodies = capture('patch');
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: /Rigger/ }));
    await user.type(screen.getByRole('textbox', { name: 'Designation' }), 'x{Escape}');
    expect(bodies).toEqual([]);
    expect(screen.getByRole('button', { name: /Rigger/ })).toBeVisible();
  });

  it('deletes after confirmation and returns to the list', async () => {
    useApi();
    const bodies = capture('delete');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete employee' }));
    expect(confirmSpy).toHaveBeenCalledWith(
      'Delete employee "Kiran Patel"? This will deactivate them.'
    );
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(await screen.findByText('employee list')).toBeInTheDocument();
  });

  it('does not delete when the confirmation is declined', async () => {
    useApi();
    const bodies = capture('delete');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete employee' }));
    expect(bodies).toEqual([]);
  });

  it('alerts when deleting fails', async () => {
    useApi();
    server.use(
      http.delete(apiUrl(BASE), () =>
        HttpResponse.json({ success: false, error: { message: 'Has open work' } }, { status: 400 })
      )
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete employee' }));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Has open work'))
    );
  });

  it('shows the attendance calendar on the Attendance tab', async () => {
    useApi();
    const { user } = renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Attendance' }));
    expect(await screen.findByRole('button', { name: 'Previous month' })).toBeVisible();
    expect(screen.getByText('Present')).toBeVisible();
  });

  it('loads the salary breakdown only on the Salary tab and pages months', async () => {
    const months = useApi();
    const { user } = renderPage();
    const tab = await screen.findByRole('tab', { name: 'Salary' });
    await screen.findByRole('heading', { name: 'Basic information' });
    expect(months).toHaveLength(0);
    await user.click(tab);
    const table = await screen.findByRole('table', { name: 'Salary breakdown' });
    expect(months).toHaveLength(1);
    const row = (label: RegExp) => within(table).getByText(label).closest('tr')!;
    expect(within(row(/^Base salary/)).getByText('₹21,154')).toHaveClass('mono');
    expect(row(/^Base salary/)).toHaveTextContent('Base salary (22/26 × ₹25,000)');
    expect(row(/^Overtime/)).toHaveTextContent('Overtime (4h × ₹150)');
    expect(within(row(/^Total pay/)).getByText('₹21,754')).toBeVisible();
    const attendance = section('Attendance');
    expect(within(attendance).getByText('26')).toHaveClass('mono');

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    await waitFor(() => expect(months).toHaveLength(2));
    expect(months[1]).not.toBe(months[0]);
    // Back to the current month is served from the cache
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(months).toHaveLength(2);
  });

  it('wraps the salary month over the year boundary', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-10T10:00:00'));
    const months = useApi();
    const { user } = renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Salary' }));
    await screen.findByRole('table', { name: 'Salary breakdown' });
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    await waitFor(() => expect(months).toContain('2025-12'));
    // January is cached; February is in the future, so Next is then disabled
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    await waitFor(() => expect(months).toContain('2026-2'));
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    vi.useRealTimers();
  });

  it('prompts to set a salary type when there is none', async () => {
    useApi(makeEmployee({ salaryType: undefined }));
    const { user } = renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Salary' }));
    expect(
      await screen.findByText('Set a salary type in the About tab to see the breakdown')
    ).toBeVisible();
  });

  it('uses the daily rate in the breakdown for daily employees', async () => {
    useApi(makeEmployee({ salaryType: 'daily', dailyRate: 850 }));
    server.use(
      http.get(apiUrl(`${BASE}/attendance/salary-breakdown`), () =>
        ok({ ...salary, salaryType: 'daily', dailyRate: 850 })
      )
    );
    const { user } = renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Salary' }));
    const table = await screen.findByRole('table', { name: 'Salary breakdown' });
    expect(within(table).getByText('Base salary (22 × ₹850)')).toBeVisible();
  });

  it('loads the change history', async () => {
    useApi();
    let url = '';
    server.use(
      http.get(apiUrl('/businesses/biz-1/audit-logs/employee/e1'), ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, pageSize: 15, total: 0, totalPages: 1 },
        });
      })
    );
    const { user } = renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Change history' }));
    await waitFor(() => expect(url).toContain('/audit-logs/employee/e1'));
  });
});
