import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { NotificationBell } from './NotificationBell';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import { makeNotification } from '../test/factories';

describe('NotificationBell', () => {
  it('shows the unread count from the API', async () => {
    server.use(http.get(apiUrl('/notifications/unread-count'), () => ok({ count: 3 })));

    renderWithProviders(<NotificationBell />, { preloadedState: signedIn() });

    expect(
      await screen.findByRole('button', { name: 'Notifications (3 unread)' })
    ).toBeInTheDocument();
  });

  it('caps the badge at 9+', async () => {
    server.use(http.get(apiUrl('/notifications/unread-count'), () => ok({ count: 12 })));

    renderWithProviders(<NotificationBell />, { preloadedState: signedIn() });

    expect(await screen.findByText('9+')).toBeInTheDocument();
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
});
