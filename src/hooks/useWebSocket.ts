/**
 * @file WebSocket connection lifecycle hook
 * @description Manages a Socket.IO connection that is alive while the user is authenticated.
 */

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { io, Socket } from 'socket.io-client';
import type { RootState } from '../store';

const WS_URL = import.meta.env.VITE_WS_URL || window.location.origin;

export interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
}

/**
 * Creates and manages a Socket.IO connection scoped to the authenticated session.
 * Connects when a valid token exists, disconnects on logout or unmount.
 */
export function useWebSocket(): UseWebSocketReturn {
  const token = useSelector((state: RootState) => state.auth.token);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Logged out: the previous run's cleanup already disconnected and reset state.
    if (!isAuthenticated || !token) return;

    const s = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    // Expose the socket once connected; keep it across reconnects so listeners stay attached.
    s.on('connect', () => {
      setSocket(s);
      setIsConnected(true);
    });
    s.on('disconnect', () => setIsConnected(false));

    return () => {
      s.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [token, isAuthenticated]);

  return { socket, isConnected };
}
