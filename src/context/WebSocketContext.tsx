/**
 * @file WebSocket React context
 * @description Provides the Socket.IO instance to the component tree.
 * Wrap authenticated routes with <WebSocketProvider> so any child
 * can call useSocket() to access the live connection.
 */

import { createContext, useContext } from 'react';
import type { Socket } from 'socket.io-client';
import { useWebSocket } from '../hooks/useWebSocket';

interface WebSocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  socket: null,
  isConnected: false,
});

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const value = useWebSocket();

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

/**
 * Convenience hook to access the WebSocket connection from any component.
 */
export function useSocket(): WebSocketContextValue {
  return useContext(WebSocketContext);
}
