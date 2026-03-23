/**
 * @file Main App component with routing
 */
import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { supabase } from './lib/supabase';
import { setCredentials, setUser, setLoading, logout } from './store/authSlice';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { PartiesPage } from './pages/PartiesPage';
import { AgreementsPage } from './pages/AgreementsPage';
import { ChallansPage } from './pages/ChallansPage';
import { BillsPage } from './pages/BillsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { InventoryDetailPage } from './pages/InventoryDetailPage';
import { PartyDetailPage } from './pages/PartyDetailPage';
import { AgreementDetailPage } from './pages/AgreementDetailPage';
import { ChallanDetailPage } from './pages/ChallanDetailPage';
import { BillDetailPage } from './pages/BillDetailPage';
import { PaymentDetailPage } from './pages/PaymentDetailPage';
import { TeamPage } from './pages/TeamPage';
import { BusinessDetailPage } from './pages/BusinessDetailPage';
import { InvitationAcceptPage } from './pages/InvitationAcceptPage';
import { SharedPortalPage } from './pages/SharedPortalPage';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    // Hydrate session on app load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        dispatch(setCredentials({ token: session.access_token }));
        // Sync with backend
        fetch(`${API_BASE}/auth/sync`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })
          .then((res) => res.json())
          .then((json) => {
            if (json.data?.user) {
              dispatch(setUser(json.data.user));
            }
          })
          .catch(() => {});
      }
      dispatch(setLoading(false));
    });

    // Listen for auth state changes (token refresh, sign in after Google OAuth, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        dispatch(setCredentials({ token: session.access_token }));
        // Sync user
        fetch(`${API_BASE}/auth/sync`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })
          .then((res) => res.json())
          .then((json) => {
            if (json.data?.user) {
              dispatch(setUser(json.data.user));
            }
          })
          .catch(() => {});

        // Check for invitation token (stored before Google OAuth redirect)
        const invitationToken = localStorage.getItem('invitation_token');
        if (invitationToken) {
          localStorage.removeItem('invitation_token');
          window.location.href = `/invitations/${invitationToken}`;
        }
      } else if (event === 'TOKEN_REFRESHED' && session) {
        dispatch(setCredentials({ token: session.access_token }));
      } else if (event === 'SIGNED_OUT') {
        dispatch(logout());
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch]);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/invitations/:token" element={<InvitationAcceptPage />} />
      <Route path="/share/:token" element={<SharedPortalPage />} />

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
        <Route path="business" element={<BusinessDetailPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="inventory/:itemId" element={<InventoryDetailPage />} />
        <Route path="parties" element={<PartiesPage />} />
        <Route path="parties/:partyId" element={<PartyDetailPage />} />
        <Route path="agreements" element={<AgreementsPage />} />
        <Route path="agreements/:agreementId" element={<AgreementDetailPage />} />
        <Route path="challans" element={<ChallansPage />} />
        <Route path="challans/:challanId" element={<ChallanDetailPage />} />
        <Route path="bills" element={<BillsPage />} />
        <Route path="bills/:billId" element={<BillDetailPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="payments/:paymentId" element={<PaymentDetailPage />} />
        <Route path="team" element={<TeamPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
