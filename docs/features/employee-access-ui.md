# Employee access (UI)

Backend rules: `bill-pro-max-backend-v2/docs/features/employee-access.md`.

- **Team page** (`pages/TeamPage.tsx`): the signed-in user's role comes from the members list
  (`useGetMembersQuery`, the member whose `userId` is `useAuth().user.id`). Only the owner sees
  **Add employee**, the Alt+N shortcut, and the row Edit / Delete actions (desktop and phone
  cards). Managers see the same list read only. Until the members list loads nothing editable is
  shown.
- **Challan form** (`components/forms/ChallanForm.tsx`): the transporter picker reads
  `employeeApi.getTransporters` (`GET /employees/transporters`, type `TransporterOption`:
  `_id`, `name`, `details.vehicleNumber`), which owners, managers and staff can all read. Picking
  one fills the transporter name and vehicle number as before.
- Tests: `TeamPage.test.tsx` ("manager … read only"), `ChallanForm.test.tsx` (transporter mock on
  `/employees/transporters`).
