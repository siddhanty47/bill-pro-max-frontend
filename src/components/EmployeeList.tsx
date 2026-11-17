/**
 * @file Employee list component.
 * Renders a table of transporter employees. Supports edit and remove actions.
 */
import type { Employee } from '../types';
import { useDeleteEmployeeMutation } from '../api/employeeApi';
import { Button, DataTable, EmptyState, RowActions, StatusChip, type Column } from './ui';

interface EmployeeListProps {
  employees: Employee[];
  businessId: string;
  onEdit: (employee: Employee) => void;
}

export function EmployeeList({ employees, businessId, onEdit }: EmployeeListProps) {
  const [deleteEmployee] = useDeleteEmployeeMutation();

  const handleDelete = async (employee: Employee) => {
    if (window.confirm(`Remove "${employee.name}" from employees?`)) {
      await deleteEmployee({ businessId, employeeId: employee._id });
    }
  };

  const transporters = employees.filter(e => e.type === 'transporter');

  const actionsCell = (emp: Employee) => (
    <RowActions
      primary={
        <Button size="sm" onClick={() => onEdit(emp)}>
          Edit
        </Button>
      }
      items={
        emp.isActive ? [{ label: 'Remove', onClick: () => handleDelete(emp), tone: 'danger' }] : []
      }
    />
  );

  const columns: Column<Employee>[] = [
    { key: 'name', header: 'Name' },
    { key: 'phone', header: 'Phone', nowrap: true, mono: true, render: e => e.phone || '—' },
    {
      key: 'vehicle',
      header: 'Vehicle number',
      nowrap: true,
      mono: true,
      render: e => e.details?.vehicleNumber || '—',
    },
    {
      key: 'status',
      header: 'Status',
      nowrap: true,
      render: e => <StatusChip status={e.isActive ? 'active' : 'inactive'} />,
    },
    { key: 'actions', header: '', align: 'right', nowrap: true, render: actionsCell },
  ];

  return (
    <DataTable
      aria-label="Transporters"
      columns={columns}
      rows={transporters}
      rowKey={e => e._id}
      empty={
        <EmptyState title={employees.length === 0 ? 'No employees yet' : 'No transporters yet'} />
      }
      mobile={{
        title: e => e.name,
        badge: e => <StatusChip status={e.isActive ? 'active' : 'inactive'} />,
        meta: e => [e.details?.vehicleNumber, e.phone],
        actions: actionsCell,
      }}
    />
  );
}
