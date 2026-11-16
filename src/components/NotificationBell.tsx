/**
 * @file Notification bell icon for the header.
 * Shows an accent dot when unread (count in the aria-label) and a dropdown panel of recent notifications.
 * Polls for unread count every 30 seconds.
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useGetUnreadCountQuery,
  useGetNotificationsQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
} from '../api/notificationApi';
import { IconButton } from './ui';
import styles from './NotificationBell.module.css';

export function NotificationBell() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: countData } = useGetUnreadCountQuery(undefined, {
    pollingInterval: 30000,
  });

  const { data: notificationsData } = useGetNotificationsQuery({ limit: 10 }, { skip: !isOpen });

  const [markAsRead] = useMarkAsReadMutation();
  const [markAllAsRead] = useMarkAllAsReadMutation();

  const unreadCount = countData?.data?.count ?? 0;
  const notifications = notificationsData?.data ?? [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleNotificationClick = async (notification: (typeof notifications)[0]) => {
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }
    if (notification.data?.invitationToken) {
      navigate(`/invitations/${notification.data.invitationToken}`);
    }
    setIsOpen(false);
  };

  return (
    <div className={styles.wrapper} ref={panelRef}>
      <IconButton
        icon="bell"
        label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        badge={unreadCount > 0}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      />

      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button className={styles.markAll} onClick={() => markAllAsRead()}>
                Mark all read
              </button>
            )}
          </div>
          <div className={styles.panelBody}>
            {notifications.length === 0 ? (
              <p className={styles.empty}>No notifications</p>
            ) : (
              notifications.map(n => (
                <div
                  key={n._id}
                  className={`${styles.item} ${!n.isRead ? styles.unread : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className={styles.itemTitle}>{n.title}</div>
                  <div className={styles.itemMessage}>{n.message}</div>
                  <div className={styles.itemTime}>{new Date(n.createdAt).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
