/**
 * Main layout component with navigation
 */
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';

export function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { businesses, currentBusiness, selectBusiness, hasMultipleBusinesses } = useCurrentBusiness();

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/inventory', label: 'Inventory' },
    { path: '/parties', label: 'Parties' },
    { path: '/agreements', label: 'Agreements' },
    { path: '/challans', label: 'Challans' },
    { path: '/bills', label: 'Bills' },
    { path: '/payments', label: 'Payments' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="header-brand">
          <h1>BillProMax</h1>
          {currentBusiness && (
            <span className="business-name">{currentBusiness.name}</span>
          )}
        </div>

        <div className="header-actions">
          {hasMultipleBusinesses && (
            <select
              value={currentBusiness?._id || ''}
              onChange={(e) => selectBusiness(e.target.value)}
              className="business-select"
            >
              {businesses.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          <span className="user-name">{user?.name || user?.email}</span>
          <button onClick={logout} className="btn btn-secondary">
            Logout
          </button>
        </div>
      </header>

      <div className="main-container">
        <nav className="sidebar">
          <ul>
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={isActive(item.path) ? 'active' : ''}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
