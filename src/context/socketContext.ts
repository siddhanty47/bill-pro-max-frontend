/**
 * @file WebSocket context object + consumer hook
 * @description Kept separate from WebSocketContext.tsx so that file only
 * exports components (required for Vite fast refresh).
 */

import { createContext, useContext } from 'react';
import type { Socket } from 'socket.io-client';

export interface WebSocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

export const WebSocketContext = createContext<WebSocketContextValue>({
  socket: null,
  isConnected: false,
});

/**
 * Convenience hook to access the WebSocket connection from any component.
 */
export function useSocket(): WebSocketContextValue {
  return useContext(WebSocketContext);
}
