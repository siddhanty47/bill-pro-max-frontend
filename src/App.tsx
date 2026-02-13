/**
 * Main App component with routing
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { PartiesPage } from './pages/PartiesPage';
import { AgreementsPage } from './pages/AgreementsPage';
import { ChallansPage } from './pages/ChallansPage';
import { BillsPage } from './pages/BillsPage';
import { PaymentsPage } from './pages/PaymentsPage';

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="parties" element={<PartiesPage />} />
        <Route path="agreements" element={<AgreementsPage />} />
        <Route path="challans" element={<ChallansPage />} />
        <Route path="bills" element={<BillsPage />} />
        <Route path="payments" element={<PaymentsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
