/**
 * Hook for current business context
 */
import { useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { useGetBusinessesQuery } from '../api/businessApi';
import { setCurrentBusiness } from '../store/authSlice';

/**
 * Hook to manage current business selection
 * Uses Redux state so all components share the same currentBusinessId
 */
export function useCurrentBusiness() {
  const dispatch = useDispatch();
  const { isAuthenticated, user, currentBusinessId } = useSelector((state: RootState) => state.auth);
  const { data: businesses, isLoading, error } = useGetBusinessesQuery(undefined, {
    skip: !isAuthenticated,
  });

  // Auto-select first business if none selected
  useEffect(() => {
    if (businesses && businesses.length > 0 && !currentBusinessId) {
      const firstBusiness = businesses[0];
      dispatch(setCurrentBusiness(firstBusiness._id));
    }
  }, [businesses, currentBusinessId, dispatch]);

  const selectBusiness = useCallback(
    (businessId: string) => {
      dispatch(setCurrentBusiness(businessId));
    },
    [dispatch]
  );

  const currentBusiness = businesses?.find((b) => b._id === currentBusinessId);

  return {
    businesses: businesses || [],
    currentBusiness,
    currentBusinessId,
    selectBusiness,
    isLoading,
    error,
    hasMultipleBusinesses: (businesses?.length || 0) > 1,
    userBusinessIds: user?.businessIds || [],
  };
}
