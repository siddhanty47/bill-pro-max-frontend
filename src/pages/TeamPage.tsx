/**
 * @file Team management page.
 * Two tabs:
 *   - Invite: members list, pending invitations, invite modal
 *   - Manage Employees: employee CRUD (transporter type for now)
 */
import { useState } from 'react';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { useGetMembersQuery } from '../api/memberApi';
import { useGetInvitationsQuery } from '../api/invitationApi';
import { useGetEmployeesQuery } from '../api/employeeApi';
import { InviteModal } from '../components/InviteModal';
import { MemberList } from '../components/MemberList';
import { InvitationList } from '../components/InvitationList';
import { EmployeeList } from '../components/EmployeeList';
import { EmployeeForm } from '../components/EmployeeForm';
import type { Employee } from '../types';
import styles from './TeamPage.module.css';

type Tab = 'invite' | 'employees';

export function TeamPage() {
  const { currentBusiness } = useCurrentBusiness();
  const [activeTab, setActiveTab] = useState<Tab>('invite');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEmployeeFormOpen, setIsEmployeeFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

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
    { businessId: businessId!, type: 'transporter' },
    { skip: !businessId }
  );

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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Team</h1>
        {activeTab === 'invite' && (
          <button
            className="btn btn-primary"
            onClick={() => setIsInviteModalOpen(true)}
          >
            + Invite Member
          </button>
        )}
        {activeTab === 'employees' && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingEmployee(null);
              setIsEmployeeFormOpen(true);
            }}
          >
            + Add Transporter
          </button>
        )}
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'invite' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('invite')}
        >
          Invite
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'employees' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('employees')}
        >
          Manage Employees
        </button>
      </div>

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

      {activeTab === 'employees' && (
        <section className={styles.section}>
          <h2>Transporters ({employees.length})</h2>
          {employeesLoading ? (
            <p>Loading employees...</p>
          ) : (
            <EmployeeList
              employees={employees}
              businessId={businessId}
              onEdit={handleEditEmployee}
            />
          )}
        </section>
      )}

      {isInviteModalOpen && (
        <InviteModal
          businessId={businessId}
          onClose={() => setIsInviteModalOpen(false)}
        />
      )}

      {isEmployeeFormOpen && (
        <EmployeeForm
          businessId={businessId}
          employee={editingEmployee}
          onClose={handleCloseEmployeeForm}
        />
      )}
    </div>
  );
}
