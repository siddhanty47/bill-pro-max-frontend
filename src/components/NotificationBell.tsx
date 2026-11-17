/**
 * @file Notification bell icon for the header.
 * Shows an accent dot when unread (count in the aria-label) and a kit Menu of recent notifications.
 * Polls for unread count every 30 seconds.
 */
import { useNavigate } from 'react-router-dom';
import {
  useGetUnreadCountQuery,
  useGetNotificationsQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
} from '../api/notificationApi';
import { IconButton, Menu, MenuItem, MenuLabel } from './ui';
import styles from './NotificationBell.module.css';

export function NotificationBell() {
  const { data: countData } = useGetUnreadCountQuery(undefined, {
    pollingInterval: 30000,
  });
  const unreadCount = countData?.data?.count ?? 0;

  return (
    <Menu
      align="end"
      menuClassName={styles.menu}
      aria-label="Notifications"
      trigger={props => (
        <IconButton
          icon="bell"
          label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          badge={unreadCount > 0}
          {...props}
        />
      )}
    >
      <NotificationList unreadCount={unreadCount} />
    </Menu>
  );
}

/** Mounted only while the menu is open, so the list is fetched on demand. */
function NotificationList({ unreadCount }: { unreadCount: number }) {
  const navigate = useNavigate();
  const { data } = useGetNotificationsQuery({ limit: 10 });
  const [markAsRead] = useMarkAsReadMutation();
  const [markAllAsRead] = useMarkAllAsReadMutation();
  const notifications = data?.data ?? [];

  const handleSelect = async (notification: (typeof notifications)[0]) => {
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }
    if (notification.data?.invitationToken) {
      navigate(`/invitations/${notification.data.invitationToken}`);
    }
  };

  return (
    <>
      <MenuLabel className={styles.header}>
        <span className={styles.title}>
          Notifications
          {unreadCount > 0 && <span className={styles.count}>{unreadCount}</span>}
        </span>
      </MenuLabel>
      {unreadCount > 0 && <MenuItem onSelect={() => markAllAsRead()}>Mark all read</MenuItem>}
      {notifications.length === 0 ? (
        <p className={styles.empty}>No notifications</p>
      ) : (
        notifications.map(n => (
          <MenuItem
            key={n._id}
            unread={!n.isRead}
            className={styles.item}
            onSelect={() => handleSelect(n)}
          >
            <span className={styles.itemTitle}>{n.title}</span>
            <span className={styles.itemMessage}>{n.message}</span>
            <span className={styles.itemTime}>{new Date(n.createdAt).toLocaleString()}</span>
          </MenuItem>
        ))
      )}
    </>
  );
}
