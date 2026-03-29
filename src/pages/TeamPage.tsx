/**
 * @file Team management page.
 * Two tabs:
 *   - Manage Employees: full employee CRUD with DataTable, search, and filters
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
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { EmployeeForm } from '../components/forms/EmployeeForm';
import { getErrorMessage } from '../api/baseApi';
import type { Employee, CreateEmployeeInput, EmployeeType } from '../types';
import styles from './TeamPage.module.css';

type Tab = 'employees' | 'invite';
type TableItem = Record<string, unknown>;

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'general', label: 'General' },
  { value: 'transporter', label: 'Transporter' },
  { value: 'worker', label: 'Worker' },
  { value: 'operator', label: 'Operator' },
  { value: 'supervisor', label: 'Supervisor' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

function formatEmployeeType(type: EmployeeType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
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
  } = useGetMembersQuery(businessId!, { skip: !businessId });

  const {
    data: invitationsResponse,
    isLoading: invitationsLoading,
  } = useGetInvitationsQuery(businessId!, { skip: !businessId });

  const {
    data: employeesResponse,
    isLoading: employeesLoading,
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

  useHotkey('alt+n', () => { if (!isEmployeeFormOpen && activeTab === 'employees') handleAddEmployee(); });
  useHotkey('/', () => { if (activeTab === 'employees') searchRef.current?.focus(); });

  if (!businessId) {
    return (
      <div className={styles.empty}>
        <h2>No business selected</h2>
        <p>Select or create a business to manage your team.</p>
      </div>
    );
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

  const employeeColumns = [
    { key: 'name', header: 'Name' },
    {
      key: 'phone',
      header: 'Phone',
      render: (row: TableItem) => {
        const emp = row as unknown as Employee;
        return emp.phone || '—';
      },
    },
    {
      key: 'type',
      header: 'Type',
      render: (row: TableItem) => {
        const emp = row as unknown as Employee;
        return <span className={styles.typeBadge}>{formatEmployeeType(emp.type)}</span>;
      },
    },
    {
      key: 'designation',
      header: 'Designation',
      render: (row: TableItem) => {
        const emp = row as unknown as Employee;
        return emp.designation || '—';
      },
    },
    {
      key: 'salary',
      header: 'Salary',
      render: (row: TableItem) => {
        const emp = row as unknown as Employee;
        if (emp.salaryType === 'monthly' && emp.monthlySalary != null) {
          return (
            <div>
              <div className={styles.salaryInfo}>₹{emp.monthlySalary.toLocaleString()}</div>
              <div className={styles.salaryLabel}>monthly</div>
            </div>
          );
        }
        if (emp.salaryType === 'daily' && emp.dailyRate != null) {
          return (
            <div>
              <div className={styles.salaryInfo}>₹{emp.dailyRate.toLocaleString()}</div>
              <div className={styles.salaryLabel}>per day</div>
            </div>
          );
        }
        return '—';
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: TableItem) => {
        const emp = row as unknown as Employee;
        return (
          <span className={`status status-${emp.isActive ? 'active' : 'inactive'}`}>
            {emp.isActive ? 'Active' : 'Inactive'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (row: TableItem) => {
        const emp = row as unknown as Employee;
        return (
          <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
            <button className="btn btn-sm btn-secondary" onClick={() => handleEditEmployee(emp)}>
              Edit
            </button>
            {emp.isActive && (
              <button className="btn btn-sm btn-danger" onClick={() => handleDeleteEmployee(emp)}>
                Delete
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Team</h1>
        {activeTab === 'employees' && (
          <button
            className="btn btn-primary"
            onClick={handleAddEmployee}
          >
            + Add Employee <kbd className="kbd-hint">{modLabel}+N</kbd>
          </button>
        )}
        {activeTab === 'invite' && (
          <button
            className="btn btn-primary"
            onClick={() => setIsInviteModalOpen(true)}
          >
            + Invite Member
          </button>
        )}
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'employees' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('employees')}
        >
          Manage Employees
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'invite' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('invite')}
        >
          Invite
        </button>
      </div>

      {activeTab === 'employees' && (
        <section className={styles.section}>
          <div className="filters">
            <div className="search-wrapper">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <kbd className="kbd-hint search-kbd">/</kbd>
            </div>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {employeesLoading ? (
            <p>Loading employees...</p>
          ) : (
            <DataTable
              data={employees as unknown as TableItem[]}
              columns={employeeColumns}
              keyField="_id"
              onRowClick={(row) => navigate(`/team/employees/${String(row._id)}`)}
              emptyMessage="No employees found. Add your first employee to get started."
            />
          )}
        </section>
      )}

      {activeTab === 'invite' && (
        <>
          <section className={styles.section}>
            <h2>Members ({members.length})</h2>
            {membersLoading ? (
              <p>Loading members...</p>
            ) : (
              <MemberList members={members} businessId={businessId} />
            )}
          </section>

          <section className={styles.section}>
            <h2>Pending Invitations ({invitations.filter(i => i.status === 'pending').length})</h2>
            {invitationsLoading ? (
              <p>Loading invitations...</p>
            ) : (
              <InvitationList invitations={invitations} businessId={businessId} />
            )}
          </section>
        </>
      )}

      {isInviteModalOpen && (
        <InviteModal
          businessId={businessId}
          onClose={() => setIsInviteModalOpen(false)}
        />
      )}

      <Modal
        isOpen={isEmployeeFormOpen}
        onClose={handleCloseEmployeeForm}
        title={editingEmployee ? 'Edit Employee' : 'Add Employee'}
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
