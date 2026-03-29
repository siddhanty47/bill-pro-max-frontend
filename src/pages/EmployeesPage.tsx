/**
 * Employees management page
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useHotkey } from '../hooks/useHotkey';
import { usePlatform } from '../hooks/usePlatform';
import {
  useGetEmployeesQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
} from '../api/employeeApi';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmployeeForm } from '../components/forms/EmployeeForm';
import { getErrorMessage } from '../api/baseApi';
import type { Employee, CreateEmployeeInput, EmployeeType } from '../types';
import styles from './EmployeesPage.module.css';

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

export function EmployeesPage() {
  const { currentBusinessId } = useCurrentBusiness();
  const { modLabel } = usePlatform();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const {
    data: employeesResponse,
    isLoading,
    error,
    refetch,
  } = useGetEmployeesQuery(
    {
      businessId: currentBusinessId || '',
      type: typeFilter || undefined,
      search: searchTerm || undefined,
      isActive: statusFilter || undefined,
    },
    { skip: !currentBusinessId }
  );

  const employees = employeesResponse?.data || [];

  const [createEmployee, { isLoading: isCreating }] = useCreateEmployeeMutation();
  const [updateEmployee, { isLoading: isUpdating }] = useUpdateEmployeeMutation();
  const [deleteEmployee] = useDeleteEmployeeMutation();

  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setIsModalOpen(true);
  };

  useHotkey('alt+n', () => { if (!isModalOpen) handleAddEmployee(); });
  useHotkey('/', () => searchRef.current?.focus());

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsModalOpen(true);
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!confirm(`Delete employee "${employee.name}"?`)) return;
    try {
      await deleteEmployee({
        businessId: currentBusinessId!,
        employeeId: employee._id,
      }).unwrap();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleSubmit = async (data: CreateEmployeeInput) => {
    try {
      if (editingEmployee) {
        await updateEmployee({
          businessId: currentBusinessId!,
          employeeId: editingEmployee._id,
          data,
        }).unwrap();
      } else {
        await createEmployee({
          businessId: currentBusinessId!,
          data,
        }).unwrap();
      }
      setIsModalOpen(false);
      setEditingEmployee(null);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const columns = [
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
      header: 'Actions',
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

  if (!currentBusinessId) {
    return <ErrorMessage error={{ message: 'Please select a business' }} />;
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading employees..." />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={refetch} />;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Employees</h1>
        <button className="btn btn-primary" onClick={handleAddEmployee}>
          + Add Employee <kbd className="kbd-hint">{modLabel}+N</kbd>
        </button>
      </div>

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

      <DataTable
        data={employees as unknown as TableItem[]}
        columns={columns}
        keyField="_id"
        onRowClick={(row) => navigate(`/team/employees/${String(row._id)}`)}
        emptyMessage="No employees found. Add your first employee to get started."
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingEmployee(null); }}
        title={editingEmployee ? 'Edit Employee' : 'Add Employee'}
        size="form"
      >
        <EmployeeForm
          initialData={editingEmployee || undefined}
          onSubmit={handleSubmit}
          onCancel={() => { setIsModalOpen(false); setEditingEmployee(null); }}
          isLoading={isCreating || isUpdating}
        />
      </Modal>
    </div>
  );
}
