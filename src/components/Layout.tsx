/**
 * Main layout component with navigation
 */
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import styles from './Layout.module.css';

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
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerBrand}>
          <h1>BillProMax</h1>
          {currentBusiness && (
            <span className={styles.businessName}>{currentBusiness.name}</span>
          )}
        </div>

        <div className={styles.headerActions}>
          {hasMultipleBusinesses && (
            <select
              value={currentBusiness?._id || ''}
              onChange={(e) => selectBusiness(e.target.value)}
              className={styles.businessSelect}
            >
              {businesses.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          <span className={styles.userName}>{user?.name || user?.email}</span>
          <button onClick={logout} className="btn btn-secondary">
            Logout
          </button>
        </div>
      </header>

      <div className={styles.mainContainer}>
        <nav className={styles.sidebar}>
          <ul>
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`${styles.navLink} ${isActive(item.path) ? styles.navLinkActive : ''}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
