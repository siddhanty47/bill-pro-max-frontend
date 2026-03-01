/**
 * @file Modal form for creating/editing employees.
 * Renders type-specific detail fields based on the employee type.
 */
import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useCreateEmployeeMutation, useUpdateEmployeeMutation } from '../api/employeeApi';
import { getErrorMessage } from '../api/baseApi';
import { Modal } from './Modal';
import type { Employee, EmployeeType } from '../types';

interface EmployeeFormProps {
  businessId: string;
  employee?: Employee | null;
  onClose: () => void;
}

export function EmployeeForm({ businessId, employee, onClose }: EmployeeFormProps) {
  const isEditing = !!employee;

  const [name, setName] = useState(employee?.name ?? '');
  const [phone, setPhone] = useState(employee?.phone ?? '');
  const [type] = useState<EmployeeType>(employee?.type ?? 'transporter');
  const [vehicleNumber, setVehicleNumber] = useState(employee?.details?.vehicleNumber ?? '');

  const [createEmployee, { isLoading: isCreating, error: createError }] = useCreateEmployeeMutation();
  const [updateEmployee, { isLoading: isUpdating, error: updateError }] = useUpdateEmployeeMutation();

  const isLoading = isCreating || isUpdating;
  const error = createError || updateError;

  useEffect(() => {
    if (employee) {
      setName(employee.name);
      setPhone(employee.phone ?? '');
      setVehicleNumber(employee.details?.vehicleNumber ?? '');
    }
  }, [employee]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && employee) {
        await updateEmployee({
          businessId,
          employeeId: employee._id,
          data: {
            name,
            phone: phone || undefined,
            details: { vehicleNumber },
          },
        }).unwrap();
      } else {
        await createEmployee({
          businessId,
          data: {
            name,
            phone: phone || undefined,
            type,
            details: { vehicleNumber },
          },
        }).unwrap();
      }
      onClose();
    } catch {
      // Error displayed via RTK Query state
    }
  };

  return (
    <Modal isOpen={true} title={isEditing ? 'Edit Transporter' : 'Add Transporter'} onClose={onClose}>
      {error && <div className="error-message">{getErrorMessage(error)}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="emp-name">Name</label>
          <input
            id="emp-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Transporter name"
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="emp-phone">Phone</label>
          <input
            id="emp-phone"
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            disabled={isLoading}
          />
        </div>

        {type === 'transporter' && (
          <div className="form-group">
            <label htmlFor="emp-vehicle">Vehicle Number</label>
            <input
              id="emp-vehicle"
              type="text"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
              placeholder="e.g. MH12AB1234"
              required
              disabled={isLoading}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Saving...' : isEditing ? 'Update' : 'Add Transporter'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
