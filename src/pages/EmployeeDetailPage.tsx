/**
 * Employee detail page with tabs for About, Attendance (Phase 2), Salary (Phase 3), and Change History.
 */
import { useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import {
  useGetEmployeeByIdQuery,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
} from '../api/employeeApi';
import { useGetSalaryBreakdownQuery } from '../api/attendanceApi';
import {
  DetailPageShell,
  DetailSection,
  DetailField,
} from '../components/DetailPageShell';
import { Tabs } from '../components/Tabs';
import ChangeHistoryTable from '../components/ChangeHistoryTable';
import { AttendanceCalendar } from '../components/AttendanceCalendar';
import { getErrorMessage } from '../api/baseApi';
import styles from './EmployeeDetailPage.module.css';

const SALARY_TYPE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'daily', label: 'Daily' },
];

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

function formatEmployeeType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

const TABS = [
  { id: 'about', label: 'About' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'salary', label: 'Salary' },
  { id: 'change-history', label: 'Change History' },
];

export function EmployeeDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const { currentBusinessId } = useCurrentBusiness();
  const navigate = useNavigate();

  const { data: response, isLoading, error, refetch } = useGetEmployeeByIdQuery(
    { businessId: currentBusinessId!, employeeId: employeeId! },
    { skip: !currentBusinessId || !employeeId },
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
    { skip: !currentBusinessId || !employeeId || activeTab !== 'salary' },
  );
  const salary = salaryResponse?.data;

  const salaryMonthLabel = new Date(salaryYear, salaryMonth - 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

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
    [currentBusinessId, employeeId, updateEmployee],
  );

  const handleNestedSave = useCallback(
    async (parent: string, field: string, newValue: string | number) => {
      if (!employee) return;
      const existing = (employee as unknown as Record<string, unknown>)[parent] as Record<string, unknown> || {};
      await updateEmployee({
        businessId: currentBusinessId!,
        employeeId: employeeId!,
        data: { [parent]: { ...existing, [field]: newValue } },
      }).unwrap();
    },
    [currentBusinessId, employee, employeeId, updateEmployee],
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
      <DetailField
        label="Type"
        value={
          <span className="status status-active">
            {formatEmployeeType(employee.type)}
          </span>
        }
      />
      <DetailField
        label="Status"
        value={
          <span className={`status status-${employee.isActive ? 'active' : 'inactive'}`}>
            {employee.isActive ? 'Active' : 'Inactive'}
          </span>
        }
      />
      <DetailField label="Created" value={formatDate(employee.createdAt)} />
      <DetailField label="Updated" value={formatDate(employee.updatedAt)} />
      {employee.isActive && (
        <div>
          <button className="btn btn-sm btn-danger" onClick={handleDelete}>
            Delete Employee
          </button>
        </div>
      )}
    </DetailSection>
  ) : null;

  return (
    <DetailPageShell
      title={employee?.name || 'Employee'}
      subtitle={employee?.designation || (employee ? formatEmployeeType(employee.type) : undefined)}
      status={employee ? (employee.isActive ? 'Active' : 'Inactive') : undefined}
      statusClassName={`status status-${employee?.isActive ? 'active' : 'inactive'}`}
      backTo="/team"
      backLabel="Employees"
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      sidebar={sidebar}
    >
      {employee && (
        <>
          <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === 'about' && (
            <>
              <DetailSection title="Basic Information">
                <DetailField
                  label="Name"
                  value={employee.name}
                  editable={{
                    rawValue: employee.name,
                    inputType: 'text',
                    onSave: (v) => handleSave('name', v),
                    isSaving,
                  }}
                />
                <DetailField
                  label="Phone"
                  value={employee.phone || undefined}
                  emptyText="No phone number"
                  editable={{
                    rawValue: employee.phone ?? '',
                    inputType: 'text',
                    onSave: (v) => handleSave('phone', v),
                    isSaving,
                  }}
                />
                <DetailField
                  label="Designation"
                  value={employee.designation || undefined}
                  emptyText="No designation"
                  editable={{
                    rawValue: employee.designation ?? '',
                    inputType: 'text',
                    onSave: (v) => handleSave('designation', v),
                    isSaving,
                  }}
                />
                <DetailField
                  label="Joining Date"
                  value={employee.joiningDate ? formatDate(employee.joiningDate) : undefined}
                  emptyText="Not set"
                />
              </DetailSection>

              <DetailSection title="Address">
                <DetailField
                  label=""
                  value={employee.address || undefined}
                  emptyText="No address provided."
                  editable={{
                    rawValue: employee.address ?? '',
                    inputType: 'textarea',
                    onSave: (v) => handleSave('address', v),
                    isSaving,
                  }}
                />
              </DetailSection>

              <DetailSection title="Salary Details">
                <DetailField
                  label="Salary Type"
                  value={employee.salaryType ? formatEmployeeType(employee.salaryType) : undefined}
                  emptyText="Not set"
                  editable={{
                    rawValue: employee.salaryType ?? '',
                    inputType: 'select',
                    options: SALARY_TYPE_OPTIONS,
                    onSave: (v) => handleSave('salaryType', v),
                    isSaving,
                  }}
                />
                {employee.salaryType === 'monthly' && (
                  <DetailField
                    label="Monthly Salary"
                    value={employee.monthlySalary != null ? `₹${employee.monthlySalary.toLocaleString()}` : undefined}
                    emptyText="Not set"
                    editable={{
                      rawValue: employee.monthlySalary ?? 0,
                      inputType: 'number',
                      prefix: '₹',
                      onSave: (v) => handleSave('monthlySalary', v),
                      isSaving,
                    }}
                  />
                )}
                {employee.salaryType === 'daily' && (
                  <DetailField
                    label="Daily Rate"
                    value={employee.dailyRate != null ? `₹${employee.dailyRate.toLocaleString()}` : undefined}
                    emptyText="Not set"
                    editable={{
                      rawValue: employee.dailyRate ?? 0,
                      inputType: 'number',
                      prefix: '₹',
                      onSave: (v) => handleSave('dailyRate', v),
                      isSaving,
                    }}
                  />
                )}
                {employee.salaryType && (
                  <DetailField
                    label="Overtime Rate / Hr"
                    value={employee.overtimeRatePerHour != null ? `₹${employee.overtimeRatePerHour.toLocaleString()}` : undefined}
                    emptyText="Not set"
                    editable={{
                      rawValue: employee.overtimeRatePerHour ?? 0,
                      inputType: 'number',
                      prefix: '₹',
                      onSave: (v) => handleSave('overtimeRatePerHour', v),
                      isSaving,
                    }}
                  />
                )}
              </DetailSection>

              {employee.type === 'transporter' && (
                <DetailSection title="Vehicle Details">
                  <DetailField
                    label="Vehicle Number"
                    value={employee.details?.vehicleNumber || undefined}
                    emptyText="No vehicle number"
                  />
                </DetailSection>
              )}

              <DetailSection title="Emergency Contact">
                <DetailField
                  label="Name"
                  value={employee.emergencyContact?.name || undefined}
                  emptyText="Not set"
                  editable={{
                    rawValue: employee.emergencyContact?.name ?? '',
                    inputType: 'text',
                    onSave: (v) => handleNestedSave('emergencyContact', 'name', v),
                    isSaving,
                  }}
                />
                <DetailField
                  label="Phone"
                  value={employee.emergencyContact?.phone || undefined}
                  emptyText="Not set"
                  editable={{
                    rawValue: employee.emergencyContact?.phone ?? '',
                    inputType: 'text',
                    onSave: (v) => handleNestedSave('emergencyContact', 'phone', v),
                    isSaving,
                  }}
                />
              </DetailSection>

              <DetailSection title="Notes">
                <DetailField
                  label=""
                  value={employee.notes || undefined}
                  emptyText="No notes."
                  editable={{
                    rawValue: employee.notes ?? '',
                    inputType: 'textarea',
                    onSave: (v) => handleSave('notes', v),
                    isSaving,
                  }}
                />
              </DetailSection>
            </>
          )}

          {activeTab === 'attendance' && (
            <AttendanceCalendar employeeId={employeeId!} />
          )}

          {activeTab === 'salary' && (
            <div className={styles.salaryTab}>
              {/* Month navigation */}
              <div className={styles.monthNav}>
                <button className={styles.monthNavBtn} onClick={handleSalaryPrevMonth} type="button">
                  &larr;
                </button>
                <span className={styles.monthNavLabel}>{salaryMonthLabel}</span>
                <button
                  className={styles.monthNavBtn}
                  onClick={handleSalaryNextMonth}
                  disabled={isSalaryFutureMonth}
                  type="button"
                >
                  &rarr;
                </button>
              </div>

              {isSalaryLoading && (
                <div className={styles.salaryLoading}>Loading salary breakdown...</div>
              )}

              {!isSalaryLoading && !employee.salaryType && (
                <div className={styles.salaryEmptyState}>
                  No salary type configured. Set the salary type in the About tab to see the breakdown.
                </div>
              )}

              {!isSalaryLoading && salary && employee.salaryType && (
                <div className={styles.salaryCard}>
                  {/* Attendance summary row */}
                  <div className={styles.salarySection}>
                    <div className={styles.salarySectionTitle}>Attendance</div>
                    <div className={styles.salaryGrid}>
                      <div className={styles.salaryGridItem}>
                        <span className={styles.salaryGridLabel}>Working Days</span>
                        <span className={styles.salaryGridValue}>{salary.workingDays}</span>
                      </div>
                      <div className={styles.salaryGridItem}>
                        <span className={styles.salaryGridLabel}>Effective Days</span>
                        <span className={styles.salaryGridValue}>{salary.effectiveDays}</span>
                      </div>
                      <div className={styles.salaryGridItem}>
                        <span className={styles.salaryGridLabel}>OT Hours</span>
                        <span className={styles.salaryGridValue}>{salary.overtimeHours}h</span>
                      </div>
                      <div className={styles.salaryGridItem}>
                        <span className={styles.salaryGridLabel}>Sundays Worked</span>
                        <span className={styles.salaryGridValue}>{salary.sundaysWorked}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.salaryDivider} />

                  {/* Salary breakdown */}
                  <div className={styles.salarySection}>
                    <div className={styles.salarySectionTitle}>Breakdown</div>
                    <div className={styles.salaryRow}>
                      <span className={styles.salaryLabel}>
                        {salary.salaryType === 'monthly'
                          ? `Base Salary (${salary.effectiveDays}/${salary.workingDays} × ₹${salary.monthlySalary?.toLocaleString()})`
                          : `Base Salary (${salary.effectiveDays} × ₹${salary.dailyRate?.toLocaleString()})`}
                      </span>
                      <span className={styles.salaryValue}>₹{salary.baseSalary.toLocaleString()}</span>
                    </div>
                    <div className={styles.salaryRow}>
                      <span className={styles.salaryLabel}>
                        Overtime ({salary.overtimeHours}h × ₹{salary.overtimeRatePerHour?.toLocaleString()})
                      </span>
                      <span className={styles.salaryValue}>₹{salary.overtimePay.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className={styles.salaryDivider} />

                  {/* Total */}
                  <div className={styles.salaryRow}>
                    <span className={styles.salaryTotal}>Total Pay</span>
                    <span className={styles.salaryTotal}>₹{salary.totalPay.toLocaleString()}</span>
                  </div>
                </div>
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
