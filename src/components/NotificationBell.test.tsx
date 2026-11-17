import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { useLocation } from 'react-router-dom';
import { NotificationBell } from './NotificationBell';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import { makeNotification } from '../test/factories';

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

describe('NotificationBell', () => {
  it('shows the unread count from the API', async () => {
    server.use(http.get(apiUrl('/notifications/unread-count'), () => ok({ count: 3 })));

    renderWithProviders(<NotificationBell />, { preloadedState: signedIn() });

    expect(
      await screen.findByRole('button', { name: 'Notifications, 3 unread' })
    ).toBeInTheDocument();
  });

  it('names the unread count', async () => {
    server.use(http.get(apiUrl('/notifications/unread-count'), () => ok({ count: 12 })));

    renderWithProviders(<NotificationBell />, { preloadedState: signedIn() });

    expect(
      await screen.findByRole('button', { name: 'Notifications, 12 unread' })
    ).toBeInTheDocument();
  });

  it('shows the unread count in the open panel header', async () => {
    server.use(http.get(apiUrl('/notifications/unread-count'), () => ok({ count: 4 })));
    const { user } = renderWithProviders(<NotificationBell />, { preloadedState: signedIn() });

    await user.click(await screen.findByRole('button', { name: 'Notifications, 4 unread' }));

    expect(await screen.findByText('4')).toBeInTheDocument();
  });

  it('loads notifications only when opened', async () => {
    let listCalls = 0;
    server.use(
      http.get(apiUrl('/notifications'), () => {
        listCalls++;
        return ok([makeNotification({ title: 'Invoice sent' })]);
      })
    );
    const { user } = renderWithProviders(<NotificationBell />, { preloadedState: signedIn() });
    await screen.findByRole('button', { name: 'Notifications' });
    expect(listCalls).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(await screen.findByText('Invoice sent')).toBeInTheDocument();
    expect(listCalls).toBe(1);
  });

  it('marks an unread notification as read when clicked', async () => {
    const marked: string[] = [];
    server.use(
      http.get(apiUrl('/notifications'), () => ok([makeNotification({ _id: 'n-7', title: 'Hi' })])),
      http.patch(apiUrl('/notifications/:id/read'), ({ params }) => {
        marked.push(String(params.id));
        return ok(null);
      })
    );
    const { user } = renderWithProviders(<NotificationBell />, { preloadedState: signedIn() });

    await user.click(await screen.findByRole('button', { name: /^Notifications/ }));
    await user.click(await screen.findByText('Hi'));

    await waitFor(() => expect(marked).toEqual(['n-7']));
  });

  it('lists notifications as keyboard-reachable menu items with unread marked', async () => {
    server.use(
      http.get(apiUrl('/notifications'), () =>
        ok([
          makeNotification({ _id: 'a', title: 'Unread one', isRead: false }),
          makeNotification({ _id: 'b', title: 'Read one', isRead: true }),
        ])
      )
    );
    const { user } = renderWithProviders(<NotificationBell />, { preloadedState: signedIn() });

    await user.click(await screen.findByRole('button', { name: /^Notifications/ }));

    const unread = await screen.findByRole('menuitem', { name: /Unread one/ });
    expect(screen.getByRole('menu', { name: 'Notifications' })).toHaveClass('wide');
    expect(unread).toHaveAttribute('data-unread', 'true');
    expect(screen.getByRole('menuitem', { name: /Read one/ })).not.toHaveAttribute('data-unread');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: /Read one/ })).toHaveFocus();
  });

  it('shows an empty state', async () => {
    server.use(http.get(apiUrl('/notifications'), () => ok([])));
    const { user } = renderWithProviders(<NotificationBell />, { preloadedState: signedIn() });

    await user.click(await screen.findByRole('button', { name: /^Notifications/ }));

    expect(await screen.findByText('No notifications')).toBeInTheDocument();
  });

  it('marks all as read and closes the menu', async () => {
    let called = 0;
    server.use(
      http.get(apiUrl('/notifications/unread-count'), () => ok({ count: 2 })),
      http.get(apiUrl('/notifications'), () => ok([makeNotification({ title: 'Hi' })])),
      http.patch(apiUrl('/notifications/read-all'), () => {
        called++;
        return ok(null);
      })
    );
    const { user } = renderWithProviders(<NotificationBell />, { preloadedState: signedIn() });

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Mark all read' }));

    await waitFor(() => expect(called).toBe(1));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens the invitation when an invitation notification is selected', async () => {
    server.use(
      http.get(apiUrl('/notifications'), () =>
        ok([
          makeNotification({
            _id: 'inv',
            title: 'Invited',
            isRead: true,
            data: { invitationToken: 'tok-1' },
          }),
        ])
      )
    );
    const { user } = renderWithProviders(
      <>
        <NotificationBell />
        <Where />
      </>,
      { preloadedState: signedIn() }
    );

    await user.click(await screen.findByRole('button', { name: /^Notifications/ }));
    await user.click(await screen.findByRole('menuitem', { name: /Invited/ }));

    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/invitations/tok-1')
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
