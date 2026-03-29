/**
 * @file Employee form component (general-purpose)
 * @description Form for creating/editing employees of all types.
 * Supports conditional fields based on employee type and salary type.
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Employee, CreateEmployeeInput } from '../../types';
import styles from './EmployeeForm.module.css';

const EMPLOYEE_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'transporter', label: 'Transporter' },
  { value: 'worker', label: 'Worker' },
  { value: 'operator', label: 'Operator' },
  { value: 'supervisor', label: 'Supervisor' },
] as const;

const employeeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().max(20).optional().or(z.literal('')),
  type: z.enum(['general', 'transporter', 'worker', 'operator', 'supervisor']),
  designation: z.string().max(100).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  joiningDate: z.string().optional().or(z.literal('')),
  salaryType: z.enum(['monthly', 'daily']).optional().or(z.literal('')),
  monthlySalary: z.string().optional().or(z.literal('')),
  dailyRate: z.string().optional().or(z.literal('')),
  overtimeRatePerHour: z.string().optional().or(z.literal('')),
  vehicleNumber: z.string().max(20).optional().or(z.literal('')),
  emergencyContactName: z.string().max(100).optional().or(z.literal('')),
  emergencyContactPhone: z.string().max(20).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

type FormData = z.infer<typeof employeeSchema>;

interface EmployeeFormProps {
  initialData?: Employee;
  onSubmit: (data: CreateEmployeeInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function EmployeeForm({ initialData, onSubmit, onCancel, isLoading }: EmployeeFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          phone: initialData.phone || '',
          type: initialData.type,
          designation: initialData.designation || '',
          address: initialData.address || '',
          joiningDate: initialData.joiningDate
            ? new Date(initialData.joiningDate).toISOString().split('T')[0]
            : '',
          salaryType: initialData.salaryType || '',
          monthlySalary: initialData.monthlySalary?.toString() || '',
          dailyRate: initialData.dailyRate?.toString() || '',
          overtimeRatePerHour: initialData.overtimeRatePerHour?.toString() || '',
          vehicleNumber: initialData.details?.vehicleNumber || '',
          emergencyContactName: initialData.emergencyContact?.name || '',
          emergencyContactPhone: initialData.emergencyContact?.phone || '',
          notes: initialData.notes || '',
        }
      : {
          name: '',
          phone: '',
          type: 'general',
          designation: '',
          address: '',
          joiningDate: '',
          salaryType: '',
          monthlySalary: '',
          dailyRate: '',
          overtimeRatePerHour: '',
          vehicleNumber: '',
          emergencyContactName: '',
          emergencyContactPhone: '',
          notes: '',
        },
  });

  const employeeType = watch('type');
  const salaryType = watch('salaryType');

  const handleFormSubmit = async (data: FormData) => {
    const payload: CreateEmployeeInput = {
      name: data.name,
      phone: data.phone || undefined,
      type: data.type,
      designation: data.designation || undefined,
      address: data.address || undefined,
      joiningDate: data.joiningDate || undefined,
      notes: data.notes || undefined,
    };

    // Salary fields
    if (data.salaryType === 'monthly' || data.salaryType === 'daily') {
      payload.salaryType = data.salaryType;
    }
    if (data.salaryType === 'monthly' && data.monthlySalary) {
      payload.monthlySalary = parseFloat(data.monthlySalary);
    }
    if (data.salaryType === 'daily' && data.dailyRate) {
      payload.dailyRate = parseFloat(data.dailyRate);
    }
    if (data.overtimeRatePerHour) {
      payload.overtimeRatePerHour = parseFloat(data.overtimeRatePerHour);
    }

    // Transporter details
    if (data.type === 'transporter' && data.vehicleNumber) {
      payload.details = { vehicleNumber: data.vehicleNumber };
    }

    // Emergency contact
    if (data.emergencyContactName || data.emergencyContactPhone) {
      payload.emergencyContact = {
        name: data.emergencyContactName || '',
        phone: data.emergencyContactPhone || '',
      };
    }

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      <div className="form-content">
        <div className="form-columns">
          <div>
            <div className="form-group">
              <label htmlFor="emp-name">Name *</label>
              <input id="emp-name" {...register('name')} disabled={isLoading} />
              {errors.name && <span className="error-message">{errors.name.message}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="emp-phone">Phone</label>
                <input id="emp-phone" {...register('phone')} disabled={isLoading} />
              </div>

              <div className="form-group">
                <label htmlFor="emp-type">Type</label>
                <select
                  id="emp-type"
                  {...register('type')}
                  disabled={isLoading || !!initialData}
                  className={styles.typeSelect}
                >
                  {EMPLOYEE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="emp-designation">Designation</label>
              <input
                id="emp-designation"
                {...register('designation')}
                disabled={isLoading}
                placeholder="e.g. Crane Operator, Site Supervisor"
              />
            </div>

            <div className="form-group">
              <label htmlFor="emp-joining">Joining Date</label>
              <input
                id="emp-joining"
                type="date"
                {...register('joiningDate')}
                disabled={isLoading}
              />
            </div>

            {employeeType === 'transporter' && (
              <div className="form-group">
                <label htmlFor="emp-vehicle">Vehicle Number</label>
                <input
                  id="emp-vehicle"
                  {...register('vehicleNumber')}
                  disabled={isLoading}
                  className={styles.uppercaseInput}
                  placeholder="e.g. MH12AB1234"
                />
              </div>
            )}
          </div>

          <div>
            <div className="form-group">
              <label>Salary Type</label>
              <div className={styles.salaryRadioGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    value="monthly"
                    {...register('salaryType')}
                    disabled={isLoading}
                  />
                  Monthly
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    value="daily"
                    {...register('salaryType')}
                    disabled={isLoading}
                  />
                  Daily
                </label>
              </div>
            </div>

            {salaryType === 'monthly' && (
              <div className="form-group">
                <label htmlFor="emp-monthly-salary">Monthly Salary</label>
                <input
                  id="emp-monthly-salary"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('monthlySalary')}
                  disabled={isLoading}
                  placeholder="0.00"
                />
              </div>
            )}

            {salaryType === 'daily' && (
              <div className="form-group">
                <label htmlFor="emp-daily-rate">Daily Rate</label>
                <input
                  id="emp-daily-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('dailyRate')}
                  disabled={isLoading}
                  placeholder="0.00"
                />
              </div>
            )}

            {salaryType && (
              <div className="form-group">
                <label htmlFor="emp-ot-rate">Overtime Rate / Hr (₹)</label>
                <input
                  id="emp-ot-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('overtimeRatePerHour')}
                  disabled={isLoading}
                  placeholder="0.00"
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="emp-address">Address</label>
              <textarea
                id="emp-address"
                {...register('address')}
                rows={2}
                disabled={isLoading}
              />
            </div>

            <fieldset className={styles.emergencyFieldset}>
              <legend>Emergency Contact</legend>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="emp-ec-name">Name</label>
                  <input
                    id="emp-ec-name"
                    {...register('emergencyContactName')}
                    disabled={isLoading}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="emp-ec-phone">Phone</label>
                  <input
                    id="emp-ec-phone"
                    {...register('emergencyContactPhone')}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </fieldset>

            <div className="form-group">
              <label htmlFor="emp-notes">Notes</label>
              <textarea
                id="emp-notes"
                {...register('notes')}
                rows={2}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Saving...' : initialData ? 'Update Employee' : 'Add Employee'}
        </button>
      </div>
    </form>
  );
}
