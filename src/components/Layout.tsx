/**
 * @file Main layout component with navigation.
 * Includes header with business switcher, notification bell, and sidebar navigation.
 */
import { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { NotificationBell } from './NotificationBell';
import { WebSocketProvider } from '../context/WebSocketContext';
import styles from './Layout.module.css';

export function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { businesses, currentBusiness, selectBusiness, hasMultipleBusinesses } = useCurrentBusiness();
  const [isBusinessMenuOpen, setIsBusinessMenuOpen] = useState(false);
  const businessMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (businessMenuRef.current && !businessMenuRef.current.contains(e.target as Node)) {
        setIsBusinessMenuOpen(false);
      }
    }
    if (isBusinessMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isBusinessMenuOpen]);

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/inventory', label: 'Inventory' },
    { path: '/parties', label: 'Parties' },
    { path: '/agreements', label: 'Agreements' },
    { path: '/challans', label: 'Challans' },
    { path: '/bills', label: 'Bills' },
    { path: '/payments', label: 'Payments' },
    { path: '/team', label: 'Team' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <WebSocketProvider>
      <div className={styles.layout}>
        <header className={styles.header}>
          <div className={styles.headerBrand}>
            <h1>BillProMax</h1>
            {currentBusiness && (
              <div className={styles.businessNameWrapper} ref={businessMenuRef}>
                <button
                  type="button"
                  className={styles.businessNameTrigger}
                  onClick={() => setIsBusinessMenuOpen(!isBusinessMenuOpen)}
                  aria-expanded={isBusinessMenuOpen}
                  aria-haspopup="true"
                >
                  <span className={styles.businessName}>{currentBusiness.name}</span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={styles.businessNameChevron}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {isBusinessMenuOpen && (
                  <div className={styles.businessMenu}>
                    <Link
                      to="/business"
                      className={styles.businessMenuItem}
                      onClick={() => setIsBusinessMenuOpen(false)}
                    >
                      Settings
                    </Link>
                  </div>
                )}
              </div>
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

            <NotificationBell />
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
    </WebSocketProvider>
  );
}
