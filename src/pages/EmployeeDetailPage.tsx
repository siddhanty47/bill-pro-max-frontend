/**
 * Employee detail page with tabs for About, Attendance, Salary and Change history.
 * Built on the kit's detail recipe.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetEmployeeByIdQuery,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
} from '../api/employeeApi';
import { useGetSalaryBreakdownQuery } from '../api/attendanceApi';
import { DetailPageShell, DetailSection, DetailField } from '../components/DetailPageShell';
import { MonthNav } from '../components/MonthNav';
import {
  Card,
  EmptyState,
  IconButton,
  Menu,
  MenuItem,
  Spinner,
  Table,
  TBody,
  Td,
  Tr,
} from '../components/ui';
import { formatDate, formatMoney, formatMonth } from '../utils/format';
import ChangeHistoryTable from '../components/ChangeHistoryTable';
import { AttendanceCalendar } from '../components/AttendanceCalendar';
import { getErrorMessage } from '../api/baseApi';
import styles from './EmployeeDetailPage.module.css';

const SALARY_TYPE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'daily', label: 'Daily' },
];

function formatEmployeeType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/** An amount in mono with its unit in the text font. */
const perUnit = (amount: number, unit: string): ReactNode => (
  <>
    <span className="mono">{formatMoney(amount)}</span> {unit}
  </>
);

const TABS = [
  { id: 'about', label: 'About' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'salary', label: 'Salary' },
  { id: 'change-history', label: 'Change history' },
];

export function EmployeeDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const { currentBusinessId } = useCurrentBusiness();
  const navigate = useNavigate();

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useGetEmployeeByIdQuery(
    { businessId: currentBusinessId!, employeeId: employeeId! },
    { skip: !currentBusinessId || !employeeId }
  );

  const employee = response?.data;

  const [updateEmployee, { isLoading: isSaving }] = useUpdateEmployeeMutation();
  const [deleteEmployee] = useDeleteEmployeeMutation();

  const [activeTab, setActiveTab] = useState('about');

  // Salary tab state
  const today = useMemo(() => new Date(), []);
  const [salaryMonth, setSalaryMonth] = useState(today.getMonth() + 1);
  const [salaryYear, setSalaryYear] = useState(today.getFullYear());

  const { data: salaryResponse, isLoading: isSalaryLoading } = useGetSalaryBreakdownQuery(
    {
      businessId: currentBusinessId!,
      employeeId: employeeId!,
      month: salaryMonth,
      year: salaryYear,
    },
    { skip: !currentBusinessId || !employeeId || activeTab !== 'salary' }
  );
  const salary = salaryResponse?.data;

  const salaryMonthLabel = formatMonth(salaryYear, salaryMonth);

  const isSalaryFutureMonth =
    salaryYear > today.getFullYear() ||
    (salaryYear === today.getFullYear() && salaryMonth > today.getMonth() + 1);

  const handleSalaryPrevMonth = () => {
    if (salaryMonth === 1) {
      setSalaryMonth(12);
      setSalaryYear(salaryYear - 1);
    } else {
      setSalaryMonth(salaryMonth - 1);
    }
  };

  const handleSalaryNextMonth = () => {
    if (salaryMonth === 12) {
      setSalaryMonth(1);
      setSalaryYear(salaryYear + 1);
    } else {
      setSalaryMonth(salaryMonth + 1);
    }
  };

  const handleSave = useCallback(
    async (field: string, newValue: string | number) => {
      await updateEmployee({
        businessId: currentBusinessId!,
        employeeId: employeeId!,
        data: { [field]: newValue },
      }).unwrap();
    },
    [currentBusinessId, employeeId, updateEmployee]
  );

  const handleNestedSave = useCallback(
    async (parent: string, field: string, newValue: string | number) => {
      if (!employee) return;
      const existing =
        ((employee as unknown as Record<string, unknown>)[parent] as Record<string, unknown>) || {};
      await updateEmployee({
        businessId: currentBusinessId!,
        employeeId: employeeId!,
        data: { [parent]: { ...existing, [field]: newValue } },
      }).unwrap();
    },
    [currentBusinessId, employee, employeeId, updateEmployee]
  );

  const handleDelete = async () => {
    if (!confirm(`Delete employee "${employee?.name}"? This will deactivate them.`)) return;
    try {
      await deleteEmployee({
        businessId: currentBusinessId!,
        employeeId: employeeId!,
      }).unwrap();
      navigate('/team/employees');
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const sidebar = employee ? (
    <DetailSection title="Details">
      <DetailField label="Type" value={formatEmployeeType(employee.type)} />
      <DetailField label="Created" value={formatDate(employee.createdAt)} />
      <DetailField label="Updated" value={formatDate(employee.updatedAt)} />
    </DetailSection>
  ) : null;

  const edit = (
    field: string,
    rawValue: string | number | undefined,
    inputType: 'text' | 'textarea' | 'number' | 'select',
    extra: { options?: { value: string; label: string }[]; prefix?: string } = {}
  ) => ({
    rawValue: rawValue ?? (inputType === 'number' ? 0 : ''),
    inputType,
    ...extra,
    onSave: (v: string | number) => handleSave(field, v),
    isSaving,
  });

  const nestedEdit = (field: 'name' | 'phone') => ({
    rawValue: employee?.emergencyContact?.[field] ?? '',
    inputType: 'text' as const,
    onSave: (v: string | number) => handleNestedSave('emergencyContact', field, v),
    isSaving,
  });

  const breakdownRow = (label: string, amount: number, strong = false) => {
    const value = <span className="mono">{formatMoney(amount)}</span>;
    return (
      <Tr>
        <Td>{strong ? <strong>{label}</strong> : label}</Td>
        <Td align="right" nowrap>
          {strong ? <strong>{value}</strong> : value}
        </Td>
      </Tr>
    );
  };

  return (
    <DetailPageShell
      title={employee?.name || 'Employee'}
      status={employee ? (employee.isActive ? 'active' : 'inactive') : undefined}
      backTo="/team"
      backLabel="Employees"
      isLoading={isLoading}
      loadingLabel="Loading employee…"
      error={error}
      onRetry={refetch}
      tabs={employee ? TABS : undefined}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      idPrefix="employee"
      sidebar={sidebar}
      headerActions={
        employee?.isActive ? (
          <Menu trigger={p => <IconButton label="More actions" icon="more" {...p} />}>
            <MenuItem tone="danger" onSelect={handleDelete}>
              Delete employee
            </MenuItem>
          </Menu>
        ) : undefined
      }
    >
      {employee && (
        <>
          {activeTab === 'about' && (
            <>
              <DetailSection title="Basic information">
                <DetailField
                  label="Name"
                  value={employee.name}
                  editable={edit('name', employee.name, 'text')}
                />
                <DetailField
                  label="Phone"
                  mono
                  value={employee.phone || undefined}
                  editable={edit('phone', employee.phone, 'text')}
                />
                <DetailField
                  label="Designation"
                  value={employee.designation || undefined}
                  editable={edit('designation', employee.designation, 'text')}
                />
                <DetailField
                  label="Joining date"
                  value={employee.joiningDate ? formatDate(employee.joiningDate) : undefined}
                />
              </DetailSection>

              <DetailSection title="Address">
                <DetailField
                  label=""
                  value={employee.address || undefined}
                  editable={edit('address', employee.address, 'textarea')}
                />
              </DetailSection>

              <DetailSection title="Salary details">
                <DetailField
                  label="Salary type"
                  value={employee.salaryType ? formatEmployeeType(employee.salaryType) : undefined}
                  editable={edit('salaryType', employee.salaryType, 'select', {
                    options: SALARY_TYPE_OPTIONS,
                  })}
                />
                {employee.salaryType === 'monthly' && (
                  <DetailField
                    label="Monthly salary"
                    value={
                      employee.monthlySalary != null
                        ? perUnit(employee.monthlySalary, '/ month')
                        : undefined
                    }
                    editable={edit('monthlySalary', employee.monthlySalary, 'number', {
                      prefix: '₹',
                    })}
                  />
                )}
                {employee.salaryType === 'daily' && (
                  <DetailField
                    label="Daily rate"
                    value={
                      employee.dailyRate != null ? perUnit(employee.dailyRate, '/ day') : undefined
                    }
                    editable={edit('dailyRate', employee.dailyRate, 'number', { prefix: '₹' })}
                  />
                )}
                {employee.salaryType && (
                  <DetailField
                    label="Overtime rate per hour"
                    value={
                      employee.overtimeRatePerHour != null
                        ? perUnit(employee.overtimeRatePerHour, '/ hour')
                        : undefined
                    }
                    editable={edit('overtimeRatePerHour', employee.overtimeRatePerHour, 'number', {
                      prefix: '₹',
                    })}
                  />
                )}
              </DetailSection>

              {employee.type === 'transporter' && (
                <DetailSection title="Vehicle details">
                  <DetailField
                    label="Vehicle number"
                    mono
                    value={employee.details?.vehicleNumber || undefined}
                  />
                </DetailSection>
              )}

              <DetailSection title="Emergency contact">
                <DetailField
                  label="Name"
                  value={employee.emergencyContact?.name || undefined}
                  editable={nestedEdit('name')}
                />
                <DetailField
                  label="Phone"
                  mono
                  value={employee.emergencyContact?.phone || undefined}
                  editable={nestedEdit('phone')}
                />
              </DetailSection>

              <DetailSection title="Notes">
                <DetailField
                  label=""
                  value={employee.notes || undefined}
                  editable={edit('notes', employee.notes, 'textarea')}
                />
              </DetailSection>
            </>
          )}

          {activeTab === 'attendance' && <AttendanceCalendar employeeId={employeeId!} />}

          {activeTab === 'salary' && (
            <div className={styles.salaryTab}>
              <MonthNav
                label={salaryMonthLabel}
                onPrev={handleSalaryPrevMonth}
                onNext={handleSalaryNextMonth}
                nextDisabled={isSalaryFutureMonth}
              />

              {isSalaryLoading && <Spinner message="Loading salary breakdown…" />}

              {!isSalaryLoading && !employee.salaryType && (
                <EmptyState title="Set a salary type in the About tab to see the breakdown" />
              )}

              {!isSalaryLoading && salary && employee.salaryType && (
                <>
                  <DetailSection title="Attendance">
                    <DetailField label="Working days" value={salary.workingDays} mono />
                    <DetailField label="Effective days" value={salary.effectiveDays} mono />
                    <DetailField
                      label="Overtime hours"
                      value={
                        <>
                          <span className="mono">{salary.overtimeHours}</span> h
                        </>
                      }
                    />
                    <DetailField label="Sundays worked" value={salary.sundaysWorked} mono />
                  </DetailSection>

                  <Card title="Breakdown" padded={false}>
                    <Table aria-label="Salary breakdown">
                      <TBody>
                        {breakdownRow(
                          salary.salaryType === 'monthly'
                            ? `Base salary (${salary.effectiveDays}/${salary.workingDays} × ${formatMoney(salary.monthlySalary ?? 0)})`
                            : `Base salary (${salary.effectiveDays} × ${formatMoney(salary.dailyRate ?? 0)})`,
                          salary.baseSalary
                        )}
                        {breakdownRow(
                          `Overtime (${salary.overtimeHours}h × ${formatMoney(salary.overtimeRatePerHour ?? 0)})`,
                          salary.overtimePay
                        )}
                        {breakdownRow('Total pay', salary.totalPay, true)}
                      </TBody>
                    </Table>
                  </Card>
                </>
              )}
            </div>
          )}

          {activeTab === 'change-history' && (
            <ChangeHistoryTable documentType="employee" documentId={employeeId!} />
          )}
        </>
      )}
    </DetailPageShell>
  );
}
