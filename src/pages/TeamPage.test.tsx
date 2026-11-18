import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, screen, within, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { TeamPage } from './TeamPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { Employee } from '../types';

const emp = (over: Partial<Employee>) =>
  ({
    _id: 'e1',
    businessId: 'biz-1',
    name: 'Kiran',
    phone: '98200',
    type: 'worker',
    designation: 'Rigger',
    salaryType: 'monthly',
    monthlySalary: 25000,
    isActive: true,
    ...over,
  }) as unknown as Employee;

const employees = [
  emp({}),
  emp({
    _id: 'e2',
    name: 'Dev',
    phone: undefined,
    designation: undefined,
    salaryType: 'daily',
    dailyRate: 850,
    monthlySalary: undefined,
    isActive: false,
  }),
  emp({ _id: 'e3', name: 'Nita', salaryType: undefined, monthlySalary: undefined }),
];

function useApi(rows: Employee[] = employees) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([{ _id: 'biz-1', name: 'Patel Scaffold Co.' }])),
    http.get(apiUrl('/businesses/biz-1/employees'), () => ok(rows)),
    http.get(apiUrl('/businesses/biz-1/members'), () =>
      ok([
        {
          _id: 'm1',
          businessId: 'biz-1',
          userId: 'u1',
          email: 'owner@x.in',
          name: 'Asha',
          role: 'owner',
          joinedAt: '2020-03-05T00:00:00.000Z',
        },
      ])
    ),
    http.get(apiUrl('/businesses/biz-1/invitations'), () =>
      ok([
        {
          _id: 'i1',
          email: 'p@x.in',
          role: 'staff',
          status: 'pending',
          createdAt: '2020-06-07T00:00:00.000Z',
        },
        {
          _id: 'i2',
          email: 'q@x.in',
          role: 'staff',
          status: 'expired',
          createdAt: '2020-06-07T00:00:00.000Z',
        },
      ])
    )
  );
}

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<TeamPage />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { preloadedState: signedIn() }
  );
}

const names = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map(r => within(r).getAllByRole('cell')[0].textContent);

afterEach(() => vi.restoreAllMocks());

describe('TeamPage', () => {
  it('shows a spinner while loading employees', async () => {
    useApi();
    renderPage();
    expect(await screen.findByText('Loading employees…')).toBeInTheDocument();
  });

  it('lists employees with formatted salary and status', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(within(rows[1]).getByText('₹25,000')).toHaveClass('mono');
    expect(within(rows[1]).getByText(/\/ month/)).not.toHaveClass('mono');
    expect(within(rows[1]).getByText('Worker')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Active')).toBeInTheDocument();
    expect(within(rows[2]).getByText('₹850')).toHaveClass('mono');
    expect(within(rows[2]).getByText('Inactive')).toBeInTheDocument();
    expect(within(rows[3]).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('sends the search and filters to the API', async () => {
    useApi();
    const seen: string[] = [];
    server.use(
      http.get(apiUrl('/businesses/biz-1/employees'), ({ request }) => {
        seen.push(new URL(request.url).search);
        return ok(employees);
      })
    );
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.type(screen.getByRole('searchbox', { name: 'Search employees' }), 'kir');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'worker');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'false');
    await waitFor(() => {
      const last = new URLSearchParams(seen[seen.length - 1]);
      expect(last.get('search')).toBe('kir');
      expect(last.get('type')).toBe('worker');
      expect(last.get('isActive')).toBe('false');
    });
  });

  it('focuses search on /', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    fireEvent.keyDown(document, { code: 'Slash', key: '/' });
    expect(screen.getByRole('searchbox', { name: 'Search employees' })).toHaveFocus();
  });

  it('navigates to the employee on row click', async () => {
    useApi();
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(within(table).getByText('Nita'));
    expect(screen.getByTestId('where')).toHaveTextContent('/team/employees/e3');
  });

  it('opens the add employee modal from header and with alt+n', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /Add employee/ }));
    expect(await screen.findByRole('dialog', { name: 'Add employee' })).toBeInTheDocument();
  });

  it('edits an employee through the row action', async () => {
    useApi();
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(
      within(within(table).getAllByRole('row')[1]).getByRole('button', { name: 'Edit' })
    );
    expect(await screen.findByRole('dialog', { name: 'Edit employee' })).toBeInTheDocument();
    expect(names()).toHaveLength(3);
  });

  it('deletes an active employee after confirming', async () => {
    useApi();
    let hit = false;
    server.use(
      http.delete(apiUrl('/businesses/biz-1/employees/e1'), () => {
        hit = true;
        return ok(null);
      })
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    expect(
      within(within(table).getAllByRole('row')[2]).queryByRole('button', { name: 'More actions' })
    ).toBeNull();
    await user.click(
      within(within(table).getAllByRole('row')[1]).getByRole('button', { name: 'More actions' })
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await waitFor(() => expect(hit).toBe(true));
  });

  it('alerts when deleting fails', async () => {
    useApi();
    server.use(
      http.delete(apiUrl('/businesses/biz-1/employees/e1'), () =>
        HttpResponse.json({ success: false, message: 'Nope' }, { status: 500 })
      )
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { user } = renderPage();
    const table = await screen.findByRole('table');
    await user.click(
      within(within(table).getAllByRole('row')[1]).getByRole('button', { name: 'More actions' })
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await waitFor(() => expect(alert).toHaveBeenCalled());
  });

  it('creates an employee from the modal', async () => {
    useApi();
    let body: Record<string, unknown> = {};
    server.use(
      http.post(apiUrl('/businesses/biz-1/employees'), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok(employees[0]);
      })
    );
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /Add employee/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add employee' });
    await user.type(within(dialog).getAllByRole('textbox', { name: /^Name/ })[0], 'New Hire');
    await user.click(within(dialog).getByRole('button', { name: /^(Add|Create|Save)/ }));
    await waitFor(() => expect(body.name).toBe('New Hire'));
  });

  it('shows empty states for no employees and for filters', async () => {
    useApi([]);
    const { user } = renderPage();
    expect(await screen.findByText('No employees yet')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Search employees' }), 'zz');
    expect(await screen.findByText('No employees match these filters')).toBeInTheDocument();
  });

  it('shows an error and retries', async () => {
    useApi();
    let calls = 0;
    server.use(
      http.get(apiUrl('/businesses/biz-1/employees'), () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ success: false, message: 'Boom' }, { status: 500 })
          : ok(employees);
      })
    );
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('renders the phone list with phone, type and salary', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    const item = within(screen.getByRole('list', { name: 'Employees' })).getAllByRole(
      'listitem'
    )[0];
    expect(item).toHaveTextContent('Kiran');
    expect(item).toHaveTextContent('98200');
    expect(item).toHaveTextContent('Worker');
    expect(item).toHaveTextContent('₹25,000 / month');
  });

  it('drops the empty salary slot from the phone meta when salary is not set', async () => {
    useApi();
    renderPage();
    await screen.findByRole('table');
    const item = within(screen.getByRole('list', { name: 'Employees' })).getAllByRole(
      'listitem'
    )[2];
    expect(item).toHaveTextContent('Nita');
    expect(item.textContent).not.toMatch(/·\s*$/);
    expect(item.textContent).not.toContain('month');
  });

  it('switches to the invite tab with members, pending count and invite modal', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('tab', { name: 'Invite' }));
    expect((await screen.findAllByText('Asha')).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /Pending invitations/ })).toHaveTextContent('1');
    expect(screen.getAllByText('p@x.in').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Invite member' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
