/**
 * @file Employee form component (general-purpose)
 * @description Form for creating/editing employees of all types.
 * Supports conditional fields based on employee type and salary type.
 */
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Employee, CreateEmployeeInput } from '../../types';
import { Button, Field, Fieldset, Input, Select, Textarea } from '../ui';
import styles from './EmployeeForm.module.css';

const EMPLOYEE_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'transporter', label: 'Transporter' },
  { value: 'worker', label: 'Worker' },
  { value: 'operator', label: 'Operator' },
  { value: 'supervisor', label: 'Supervisor' },
] as const;

const amount = z.string().optional().or(z.literal(''));

const NEGATIVE_MESSAGE = 'Enter 0 or more';
const isNegative = (v: string | undefined) => !!v && Number(v) < 0;

const employeeFields = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().max(20).optional().or(z.literal('')),
  type: z.enum(['general', 'transporter', 'worker', 'operator', 'supervisor']),
  designation: z.string().max(100).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  joiningDate: z.string().optional().or(z.literal('')),
  salaryType: z.enum(['monthly', 'daily']).optional().or(z.literal('')),
  monthlySalary: amount,
  dailyRate: amount,
  overtimeRatePerHour: amount,
  vehicleNumber: z.string().max(20).optional().or(z.literal('')),
  emergencyContactName: z.string().max(100).optional().or(z.literal('')),
  emergencyContactPhone: z.string().max(20).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

/**
 * Salary amounts must be 0 or more, but only the ones on screen for the chosen salary
 * type: a value left in a field hidden by a type switch is never submitted, so it must
 * not block the submit either.
 */
const employeeSchema = employeeFields.superRefine((data, ctx) => {
  const visible: (keyof typeof data)[] = [];
  if (data.salaryType === 'monthly') visible.push('monthlySalary');
  if (data.salaryType === 'daily') visible.push('dailyRate');
  if (data.salaryType) visible.push('overtimeRatePerHour');
  for (const key of visible) {
    if (isNegative(data[key])) {
      ctx.addIssue({ code: 'custom', path: [key], message: NEGATIVE_MESSAGE });
    }
  }
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
    control,
    register,
    handleSubmit,
    formState: { errors },
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

  const employeeType = useWatch({ control, name: 'type' });
  const salaryType = useWatch({ control, name: 'salaryType' });

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
    <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
      <div className={styles.columns}>
        <div className={styles.column}>
          <Field label="Name" required error={errors.name?.message}>
            <Input id="emp-name" {...register('name')} disabled={isLoading} />
          </Field>

          <div className={styles.pair}>
            <Field label="Phone" error={errors.phone?.message}>
              <Input id="emp-phone" mono {...register('phone')} disabled={isLoading} />
            </Field>
            <Field label="Type">
              <Select id="emp-type" {...register('type')} disabled={isLoading || !!initialData}>
                {EMPLOYEE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Designation" error={errors.designation?.message}>
            <Input
              id="emp-designation"
              {...register('designation')}
              disabled={isLoading}
              placeholder="e.g. Crane operator, site supervisor"
            />
          </Field>

          <Field label="Joining date" error={errors.joiningDate?.message}>
            <Input id="emp-joining" type="date" {...register('joiningDate')} disabled={isLoading} />
          </Field>

          {employeeType === 'transporter' && (
            <Field label="Vehicle number" error={errors.vehicleNumber?.message}>
              <Input
                id="emp-vehicle"
                mono
                {...register('vehicleNumber')}
                disabled={isLoading}
                uppercase
                placeholder="e.g. MH12AB1234"
              />
            </Field>
          )}
        </div>

        <div className={styles.column}>
          <Field label="Salary type">
            <Select id="emp-salary-type" {...register('salaryType')} disabled={isLoading}>
              <option value="">Not set</option>
              <option value="monthly">Monthly</option>
              <option value="daily">Daily</option>
            </Select>
          </Field>

          {salaryType === 'monthly' && (
            <Field label="Monthly salary" error={errors.monthlySalary?.message}>
              <Input
                id="emp-monthly-salary"
                mono
                type="number"
                min="0"
                step="0.01"
                {...register('monthlySalary')}
                disabled={isLoading}
                placeholder="0.00"
              />
            </Field>
          )}

          {salaryType === 'daily' && (
            <Field label="Daily rate" error={errors.dailyRate?.message}>
              <Input
                id="emp-daily-rate"
                mono
                type="number"
                min="0"
                step="0.01"
                {...register('dailyRate')}
                disabled={isLoading}
                placeholder="0.00"
              />
            </Field>
          )}

          {salaryType && (
            <Field label="Overtime rate / hr (₹)" error={errors.overtimeRatePerHour?.message}>
              <Input
                id="emp-ot-rate"
                mono
                type="number"
                min="0"
                step="0.01"
                {...register('overtimeRatePerHour')}
                disabled={isLoading}
                placeholder="0.00"
              />
            </Field>
          )}

          <Field label="Address" error={errors.address?.message}>
            <Textarea id="emp-address" {...register('address')} rows={2} disabled={isLoading} />
          </Field>

          <Fieldset legend="Emergency contact">
            <div className={styles.pair}>
              <Field label="Name" error={errors.emergencyContactName?.message}>
                <Input
                  id="emp-ec-name"
                  {...register('emergencyContactName')}
                  disabled={isLoading}
                />
              </Field>
              <Field label="Phone" error={errors.emergencyContactPhone?.message}>
                <Input
                  id="emp-ec-phone"
                  mono
                  {...register('emergencyContactPhone')}
                  disabled={isLoading}
                />
              </Field>
            </div>
          </Fieldset>

          <Field label="Notes" error={errors.notes?.message}>
            <Textarea id="emp-notes" {...register('notes')} rows={2} disabled={isLoading} />
          </Field>
        </div>
      </div>

      <div className={styles.actions}>
        <Button onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={isLoading}>
          {initialData ? 'Update employee' : 'Add employee'}
        </Button>
      </div>
    </form>
  );
}
