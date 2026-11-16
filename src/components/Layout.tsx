/**
 * @file App shell: header (brand, global search, business menu, assistant,
 * notifications, account menu) and the grouped sidebar navigation.
 */
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCurrentBusiness } from '../hooks/useCurrentBusiness';
import { NotificationBell } from './NotificationBell';
import { WebSocketProvider } from '../context/WebSocketContext';
import { useSearchIndexSync } from '../hooks/useSearchIndexSync';
import AssistantPanel from './assistant/AssistantPanel';
import { GlobalSearch } from './GlobalSearch/GlobalSearch';
import {
  Button,
  Icon,
  IconButton,
  Menu,
  MenuDivider,
  MenuItem,
  MenuLabel,
  type IconName,
} from './ui';
import styles from './Layout.module.css';

type NavGroup = { label?: string; items: { path: string; label: string; icon: IconName }[] };

/** Sidebar navigation. Add a page here (and its route in App.tsx). */
const navGroups: NavGroup[] = [
  { items: [{ path: '/', label: 'Dashboard', icon: 'dashboard' }] },
  {
    label: 'Yard',
    items: [
      { path: '/inventory', label: 'Inventory', icon: 'inventory' },
      { path: '/parties', label: 'Parties', icon: 'parties' },
      { path: '/agreements', label: 'Agreements', icon: 'agreements' },
    ],
  },
  {
    label: 'Paperwork',
    items: [
      { path: '/challans', label: 'Challans', icon: 'challans' },
      { path: '/bills', label: 'Bills', icon: 'bills' },
      { path: '/payments', label: 'Payments', icon: 'payments' },
    ],
  },
  { label: 'Business', items: [{ path: '/team', label: 'Team', icon: 'team' }] },
];

/** Mounts the search-index sync hook inside WebSocketProvider (Layout itself sits outside it). */
function SearchIndexSync() {
  useSearchIndexSync();
  return null;
}

export function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { businesses, currentBusiness, selectBusiness, hasMultipleBusinesses } =
    useCurrentBusiness();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Close sidebar on route change (mobile) — adjust state during render.
  const [prevPathname, setPrevPathname] = useState(location.pathname);
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname);
    setIsSidebarOpen(false);
  }

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

  const otherBusinesses = businesses.filter(b => b._id !== currentBusiness?._id);

  return (
    <WebSocketProvider>
      <SearchIndexSync />
      <div className={styles.layout}>
        <header className={styles.header}>
          <div className={styles.headerBrand}>
            <IconButton
              label="Toggle navigation"
              icon="menu"
              className={styles.hamburger}
              aria-expanded={isSidebarOpen}
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            />
            <div className={styles.brand}>
              <Icon name="brand" size={20} className={styles.brandMark} />
              <span className={styles.brandName}>Bill Pro Max</span>
            </div>
          </div>

          <div className={styles.headerSearch}>
            <GlobalSearch />
          </div>

          <div className={styles.headerActions}>
            {currentBusiness && (
              <Menu
                className={styles.businessControl}
                aria-label="Business"
                trigger={props => (
                  <Button
                    variant="ghost"
                    className={styles.businessTrigger}
                    aria-label={currentBusiness.name}
                    {...props}
                  >
                    <span className={styles.businessMark} aria-hidden="true">
                      {currentBusiness.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className={styles.businessName}>{currentBusiness.name}</span>
                    <Icon name="chevron-down" size={12} className={styles.businessChevron} />
                  </Button>
                )}
              >
                <MenuLabel>{currentBusiness.name}</MenuLabel>
                <MenuItem to="/business">Settings</MenuItem>
                {hasMultipleBusinesses && otherBusinesses.length > 0 && (
                  <>
                    <MenuDivider />
                    <MenuLabel>Switch business</MenuLabel>
                    {otherBusinesses.map(b => (
                      <MenuItem key={b._id} onSelect={() => selectBusiness(b._id)}>
                        {b.name}
                      </MenuItem>
                    ))}
                  </>
                )}
              </Menu>
            )}

            <Button
              icon="chat"
              className={styles.askButton}
              aria-label="Ask"
              aria-pressed={isAssistantOpen}
              onClick={() => setIsAssistantOpen(v => !v)}
            >
              <span className={styles.askLabel}>Ask</span>
            </Button>

            <NotificationBell />

            <Menu
              className={styles.profileControl}
              aria-label="Account"
              trigger={props => (
                <button type="button" className={styles.avatar} aria-label="Account" {...props}>
                  <span aria-hidden="true">{userInitials}</span>
                </button>
              )}
            >
              {user?.email && <MenuLabel>{user.email}</MenuLabel>}
              {user?.email && <MenuDivider />}
              <MenuItem onSelect={() => void logout()}>Log out</MenuItem>
            </Menu>
          </div>
        </header>

        <div className={styles.mainContainer}>
          {isSidebarOpen && (
            <div className={styles.sidebarOverlay} onClick={() => setIsSidebarOpen(false)} />
          )}
          <nav
            aria-label="Main"
            className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ''}`}
          >
            {navGroups.map((group, i) => (
              <div key={group.label ?? i} className={styles.navGroup}>
                {group.label && <div className={styles.navLabel}>{group.label}</div>}
                <ul>
                  {group.items.map(item => (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        end={item.path === '/'}
                        className={({ isActive }) =>
                          isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                        }
                      >
                        <Icon name={item.icon} size={17} />
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <main className={styles.content}>
            <Outlet />
          </main>

          <AssistantPanel open={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />
        </div>
      </div>
    </WebSocketProvider>
  );
}
