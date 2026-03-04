/**
 * @file WebSocket connection lifecycle hook
 * @description Manages a Socket.IO connection that is alive while the user is authenticated.
 */

import { useEffect, useRef, useState } from 'react';
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

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [token, isAuthenticated]);

  return { socket: socketRef.current, isConnected };
}
