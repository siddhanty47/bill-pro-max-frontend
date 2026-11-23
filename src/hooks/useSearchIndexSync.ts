/**
 * @file Search index sync hook
 * @description Refetches the local global-search index (and the dashboard, whose counts
 * and stock depend on the same data) when another member edits
 * parties/sites/agreements/inventory in the current business.
 */

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useSocket } from '../context/socketContext';
import { useCurrentBusiness } from './useCurrentBusiness';
import { baseApi } from '../api/baseApi';
import type { AppDispatch } from '../store';

export function useSearchIndexSync(): void {
  const { socket } = useSocket();
  const { currentBusinessId } = useCurrentBusiness();
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    if (!socket || !currentBusinessId) return;

    const handleIndexChanged = (payload: { businessId?: string }) => {
      if (payload?.businessId === currentBusinessId) {
        dispatch(baseApi.util.invalidateTags(['SearchIndex', 'Dashboard']));
      }
    };

    socket.on('search:index-changed', handleIndexChanged);
    return () => {
      socket.off('search:index-changed', handleIndexChanged);
    };
  }, [socket, currentBusinessId, dispatch]);
}
