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
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const businessMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (businessMenuRef.current && !businessMenuRef.current.contains(e.target as Node)) {
        setIsBusinessMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }
    if (isBusinessMenuOpen || isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isBusinessMenuOpen, isProfileMenuOpen]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const userInitials = (() => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.name) {
      const parts = user.name.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return parts[0][0].toUpperCase();
    }
    if (user?.email) return user.email[0].toUpperCase();
    return '?';
  })();

  const otherBusinesses = businesses.filter((b) => b._id !== currentBusiness?._id);

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

  const handleSwitchBusiness = (businessId: string) => {
    selectBusiness(businessId);
    setIsBusinessMenuOpen(false);
  };

  return (
    <WebSocketProvider>
      <div className={styles.layout}>
        <header className={styles.header}>
          <div className={styles.headerBrand}>
            <button
              type="button"
              className={styles.hamburger}
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Toggle navigation"
            >
              ☰
            </button>
            <h1>BillProMax</h1>
          </div>

          <div className={styles.headerActions}>
            {currentBusiness && (
              <div className={styles.businessControl} ref={businessMenuRef}>
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
                    <div className={styles.businessMenuSection}>
                      <div className={styles.businessMenuLabel}>{currentBusiness.name}</div>
                      <Link
                        to="/business"
                        className={styles.businessMenuItem}
                        onClick={() => setIsBusinessMenuOpen(false)}
                      >
                        Settings
                      </Link>
                    </div>
                    {hasMultipleBusinesses && otherBusinesses.length > 0 && (
                      <div className={styles.businessMenuSection}>
                        <div className={styles.businessMenuDivider} />
                        <div className={styles.businessMenuLabel}>Switch business</div>
                        {otherBusinesses.map((b) => (
                          <button
                            key={b._id}
                            type="button"
                            className={styles.businessMenuItem}
                            onClick={() => handleSwitchBusiness(b._id)}
                          >
                            {b.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <NotificationBell />

            <div className={styles.profileWrapper} ref={profileMenuRef}>
              <button
                type="button"
                className={styles.profileTrigger}
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="true"
                aria-label="User menu"
              >
                <span className={styles.profileAvatar}>{userInitials}</span>
              </button>

              {isProfileMenuOpen && (
                <div className={styles.profileMenu}>
                  <div className={styles.profileMenuEmail}>{user?.email}</div>
                  <div className={styles.profileMenuDivider} />
                  <button
                    type="button"
                    className={styles.profileMenuItem}
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      logout();
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={styles.mainContainer}>
          {isSidebarOpen && (
            <div
              className={styles.sidebarOverlay}
              onClick={() => setIsSidebarOpen(false)}
            />
          )}
          <nav className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ''}`}>
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
