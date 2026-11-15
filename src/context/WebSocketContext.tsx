/**
 * @file WebSocket React context
 * @description Provides the Socket.IO instance to the component tree.
 * Wrap authenticated routes with <WebSocketProvider> so any child
 * can call useSocket() (from ./socketContext) to access the live connection.
 */

import { useWebSocket } from '../hooks/useWebSocket';
import { WebSocketContext } from './socketContext';

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const value = useWebSocket();
  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}
