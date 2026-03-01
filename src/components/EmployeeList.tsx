/**
 * @file Employee list component.
 * Renders a table of employees with columns based on employee type.
 * Supports edit and delete actions.
 */
import type { Employee } from '../types';
import { useDeleteEmployeeMutation } from '../api/employeeApi';

interface EmployeeListProps {
  employees: Employee[];
  businessId: string;
  onEdit: (employee: Employee) => void;
}

export function EmployeeList({ employees, businessId, onEdit }: EmployeeListProps) {
  const [deleteEmployee] = useDeleteEmployeeMutation();

  if (employees.length === 0) {
    return <p style={{ color: '#888' }}>No employees yet. Add one to get started.</p>;
  }

  const handleDelete = async (employee: Employee) => {
    if (window.confirm(`Remove "${employee.name}" from employees?`)) {
      await deleteEmployee({ businessId, employeeId: employee._id });
    }
  };

  const transporters = employees.filter((e) => e.type === 'transporter');

  if (transporters.length === 0) {
    return <p style={{ color: '#888' }}>No transporters found.</p>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Phone</th>
          <th>Vehicle Number</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {transporters.map((emp) => (
          <tr key={emp._id}>
            <td>{emp.name}</td>
            <td>{emp.phone || '—'}</td>
            <td>{emp.details?.vehicleNumber || '—'}</td>
            <td>
              <span className={`status status-${emp.isActive ? 'active' : 'cancelled'}`}>
                {emp.isActive ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onEdit(emp)}
                  style={{ fontSize: 12, padding: '4px 8px' }}
                >
                  Edit
                </button>
                {emp.isActive && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(emp)}
                    style={{ fontSize: 12, padding: '4px 8px' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
