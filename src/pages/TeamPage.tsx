/**
 * @file Team management page.
 * Two tabs:
 *   - Manage employees: full employee CRUD with DataTable, search, and filters
 *   - Invite: members list, pending invitations, invite modal
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useHotkey } from '../hooks/useHotkey';
import { usePlatform } from '../hooks/usePlatform';
import { useGetMembersQuery } from '../api/memberApi';
import { useGetInvitationsQuery } from '../api/invitationApi';
import {
  useGetEmployeesQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
} from '../api/employeeApi';
import { InviteModal } from '../components/InviteModal';
import { MemberList } from '../components/MemberList';
import { InvitationList } from '../components/InvitationList';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorMessage,
  FilterBar,
  Modal,
  PageHeader,
  RowActions,
  SearchInput,
  Select,
  Spinner,
  StatusChip,
  TabPanel,
  Tabs,
  type Column,
} from '../components/ui';
import { EmployeeForm } from '../components/forms/EmployeeForm';
import { getErrorMessage } from '../api/baseApi';
import { formatMoney } from '../utils/format';
import type { Employee, CreateEmployeeInput, EmployeeType } from '../types';
import styles from './TeamPage.module.css';

type Tab = 'employees' | 'invite';

const TABS: { id: Tab; label: string }[] = [
  { id: 'employees', label: 'Manage employees' },
  { id: 'invite', label: 'Invite' },
];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'general', label: 'General' },
  { value: 'transporter', label: 'Transporter' },
  { value: 'worker', label: 'Worker' },
  { value: 'operator', label: 'Operator' },
  { value: 'supervisor', label: 'Supervisor' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

function formatEmployeeType(type: EmployeeType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function salaryLabel(e: Employee): string {
  if (e.salaryType === 'monthly' && e.monthlySalary != null) {
    return `${formatMoney(e.monthlySalary)} / month`;
  }
  if (e.salaryType === 'daily' && e.dailyRate != null) {
    return `${formatMoney(e.dailyRate)} / day`;
  }
  return '';
}

export function TeamPage() {
  const { currentBusiness } = useCurrentBusiness();
  const { modLabel } = usePlatform();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('employees');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEmployeeFormOpen, setIsEmployeeFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const businessId = currentBusiness?._id;

  const {
    data: membersResponse,
    isLoading: membersLoading,
    error: membersError,
    refetch: refetchMembers,
  } = useGetMembersQuery(businessId!, { skip: !businessId });

  const {
    data: invitationsResponse,
    isLoading: invitationsLoading,
    error: invitationsError,
    refetch: refetchInvitations,
  } = useGetInvitationsQuery(businessId!, { skip: !businessId });

  const {
    data: employeesResponse,
    isLoading: employeesLoading,
    error: employeesError,
    refetch: refetchEmployees,
  } = useGetEmployeesQuery(
    {
      businessId: businessId!,
      type: typeFilter || undefined,
      search: searchTerm || undefined,
      isActive: statusFilter || undefined,
    },
    { skip: !businessId }
  );

  const [createEmployee, { isLoading: isCreating }] = useCreateEmployeeMutation();
  const [updateEmployee, { isLoading: isUpdating }] = useUpdateEmployeeMutation();
  const [deleteEmployee] = useDeleteEmployeeMutation();

  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setIsEmployeeFormOpen(true);
  };

  useHotkey('alt+n', () => {
    if (!isEmployeeFormOpen && activeTab === 'employees') handleAddEmployee();
  });
  useHotkey('/', () => {
    if (activeTab === 'employees') searchRef.current?.focus();
  });

  if (!businessId) {
    return <EmptyState title="No business selected" />;
  }

  const members = membersResponse?.data ?? [];
  const invitations = invitationsResponse?.data ?? [];
  const employees = employeesResponse?.data ?? [];

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsEmployeeFormOpen(true);
  };

  const handleCloseEmployeeForm = () => {
    setIsEmployeeFormOpen(false);
    setEditingEmployee(null);
  };

  const handleEmployeeSubmit = async (data: CreateEmployeeInput) => {
    try {
      if (editingEmployee) {
        await updateEmployee({
          businessId,
          employeeId: editingEmployee._id,
          data,
        }).unwrap();
      } else {
        await createEmployee({
          businessId,
          data,
        }).unwrap();
      }
      handleCloseEmployeeForm();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!confirm(`Delete employee "${employee.name}"?`)) return;
    try {
      await deleteEmployee({
        businessId,
        employeeId: employee._id,
      }).unwrap();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const actionsCell = (emp: Employee) => (
    <RowActions
      primary={
        <Button size="sm" onClick={() => handleEditEmployee(emp)}>
          Edit
        </Button>
      }
      items={
        emp.isActive
          ? [{ label: 'Delete', onClick: () => handleDeleteEmployee(emp), tone: 'danger' }]
          : []
      }
    />
  );

  const employeeColumns: Column<Employee>[] = [
    { key: 'name', header: 'Name' },
    { key: 'phone', header: 'Phone', nowrap: true, mono: true, render: e => e.phone || '—' },
    { key: 'type', header: 'Type', nowrap: true, render: e => formatEmployeeType(e.type) },
    { key: 'designation', header: 'Designation', render: e => e.designation || '—' },
    {
      key: 'salary',
      header: 'Salary',
      mono: true,
      align: 'right',
      nowrap: true,
      render: e => salaryLabel(e) || '—',
    },
    {
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: e => <StatusChip status={e.isActive ? 'active' : 'inactive'} />,
    },
    { key: 'actions', header: '', align: 'right', nowrap: true, render: actionsCell },
  ];

  const hasEmployeeFilters = Boolean(searchTerm || typeFilter || statusFilter);
  const pendingCount = invitations.filter(i => i.status === 'pending').length;

  return (
    <div>
      <PageHeader
        title="Team"
        actions={
          activeTab === 'employees' ? (
            <Button
              variant="primary"
              icon="plus"
              hint={`${modLabel}+N`}
              onClick={handleAddEmployee}
            >
              Add employee
            </Button>
          ) : (
            <Button variant="primary" icon="plus" onClick={() => setIsInviteModalOpen(true)}>
              Invite member
            </Button>
          )
        }
      />

      <Tabs
        idPrefix="team"
        tabs={TABS}
        activeTab={activeTab}
        onChange={id => setActiveTab(id as Tab)}
      />

      <TabPanel idPrefix="team" tabId={activeTab}>
        {activeTab === 'employees' && (
          <>
            <FilterBar>
              <SearchInput
                ref={searchRef}
                label="Search employees"
                hint="/"
                placeholder="Name or phone"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <Select
                aria-label="Type"
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
              >
                {TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Status"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </FilterBar>

            {employeesLoading ? (
              <Spinner message="Loading employees…" />
            ) : employeesError ? (
              <ErrorMessage error={employeesError} onRetry={refetchEmployees} />
            ) : (
              <Card padded={false}>
                <DataTable
                  aria-label="Employees"
                  columns={employeeColumns}
                  rows={employees}
                  rowKey={e => e._id}
                  onRowClick={e => navigate(`/team/employees/${e._id}`)}
                  empty={
                    hasEmployeeFilters ? (
                      <EmptyState title="No employees match these filters" />
                    ) : (
                      <EmptyState
                        title="No employees yet"
                        action={
                          <Button variant="primary" icon="plus" onClick={handleAddEmployee}>
                            Add employee
                          </Button>
                        }
                      />
                    )
                  }
                  mobile={{
                    title: e => e.name,
                    badge: e => <StatusChip status={e.isActive ? 'active' : 'inactive'} />,
                    subtitle: e => e.designation,
                    meta: e => [
                      e.phone,
                      formatEmployeeType(e.type),
                      <span key="salary" className="mono">
                        {salaryLabel(e)}
                      </span>,
                    ],
                    actions: actionsCell,
                  }}
                />
              </Card>
            )}
          </>
        )}

        {activeTab === 'invite' && (
          <div className={styles.stack}>
            <Card title="Members" count={members.length} padded={false}>
              {membersLoading ? (
                <Spinner message="Loading members…" />
              ) : membersError ? (
                <ErrorMessage error={membersError} onRetry={refetchMembers} />
              ) : (
                <MemberList
                  members={members}
                  businessId={businessId}
                  onInvite={() => setIsInviteModalOpen(true)}
                />
              )}
            </Card>

            <Card title="Pending invitations" count={pendingCount} padded={false}>
              {invitationsLoading ? (
                <Spinner message="Loading invitations…" />
              ) : invitationsError ? (
                <ErrorMessage error={invitationsError} onRetry={refetchInvitations} />
              ) : (
                <InvitationList invitations={invitations} businessId={businessId} />
              )}
            </Card>
          </div>
        )}
      </TabPanel>

      {isInviteModalOpen && (
        <InviteModal businessId={businessId} onClose={() => setIsInviteModalOpen(false)} />
      )}

      <Modal
        isOpen={isEmployeeFormOpen}
        onClose={handleCloseEmployeeForm}
        title={editingEmployee ? 'Edit employee' : 'Add employee'}
        size="form"
      >
        <EmployeeForm
          initialData={editingEmployee || undefined}
          onSubmit={handleEmployeeSubmit}
          onCancel={handleCloseEmployeeForm}
          isLoading={isCreating || isUpdating}
        />
      </Modal>
    </div>
  );
}
