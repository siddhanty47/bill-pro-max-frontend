/**
 * @file Bill generation progress hook
 * @description Listens to Socket.IO events for async bill generation
 * and throttles RTK Query cache invalidation.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useSocket } from '../context/WebSocketContext';
import { baseApi } from '../api/baseApi';
import type { AppDispatch } from '../store';

interface BillResult {
  agreementId: string;
  billId?: string;
  billNumber?: string;
  error?: string;
  status: 'completed' | 'failed';
}

export interface BatchProgress {
  batchId: string;
  total: number;
  completed: number;
  failed: number;
  isProcessing: boolean;
  results: BillResult[];
}

const INVALIDATION_THROTTLE_MS = 2000;

export function useBillGenerationProgress() {
  const { socket } = useSocket();
  const dispatch = useDispatch<AppDispatch>();
  const [batches, setBatches] = useState<Map<string, BatchProgress>>(new Map());

  const pendingInvalidation = useRef(false);
  const invalidationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleInvalidation = useCallback(() => {
    if (pendingInvalidation.current) return;
    pendingInvalidation.current = true;
    invalidationTimer.current = setTimeout(() => {
      dispatch(baseApi.util.invalidateTags(['Bill']));
      pendingInvalidation.current = false;
    }, INVALIDATION_THROTTLE_MS);
  }, [dispatch]);

  const startBatch = useCallback((batchId: string, total: number) => {
    setBatches(prev => {
      const next = new Map(prev);
      next.set(batchId, {
        batchId,
        total,
        completed: 0,
        failed: 0,
        isProcessing: true,
        results: [],
      });
      return next;
    });
  }, []);

  const dismissBatch = useCallback((batchId: string) => {
    setBatches(prev => {
      const next = new Map(prev);
      next.delete(batchId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleGenerated = (data: { batchId: string; billId: string; agreementId: string; billNumber: string }) => {
      setBatches(prev => {
        const next = new Map(prev);
        const batch = next.get(data.batchId);
        if (batch) {
          next.set(data.batchId, {
            ...batch,
            completed: batch.completed + 1,
            results: [...batch.results, {
              agreementId: data.agreementId,
              billId: data.billId,
              billNumber: data.billNumber,
              status: 'completed',
            }],
          });
        }
        return next;
      });
      scheduleInvalidation();
    };

    const handleFailed = (data: { batchId: string; agreementId: string; partyId: string; error: string }) => {
      setBatches(prev => {
        const next = new Map(prev);
        const batch = next.get(data.batchId);
        if (batch) {
          next.set(data.batchId, {
            ...batch,
            failed: batch.failed + 1,
            results: [...batch.results, {
              agreementId: data.agreementId,
              error: data.error,
              status: 'failed',
            }],
          });
        }
        return next;
      });
    };

    const handleBatchComplete = (data: { batchId: string; total: number; completed: number; failed: number }) => {
      setBatches(prev => {
        const next = new Map(prev);
        const batch = next.get(data.batchId);
        if (batch) {
          next.set(data.batchId, {
            ...batch,
            total: data.total,
            completed: data.completed,
            failed: data.failed,
            isProcessing: false,
          });
        }
        return next;
      });
      // Final invalidation to ensure list is fully up to date
      if (invalidationTimer.current) clearTimeout(invalidationTimer.current);
      pendingInvalidation.current = false;
      dispatch(baseApi.util.invalidateTags(['Bill']));
    };

    socket.on('bill:generated', handleGenerated);
    socket.on('bill:failed', handleFailed);
    socket.on('bill:batch-complete', handleBatchComplete);

    return () => {
      socket.off('bill:generated', handleGenerated);
      socket.off('bill:failed', handleFailed);
      socket.off('bill:batch-complete', handleBatchComplete);
      if (invalidationTimer.current) clearTimeout(invalidationTimer.current);
    };
  }, [socket, dispatch, scheduleInvalidation]);

  const activeBatches = Array.from(batches.values());
  const hasActiveJobs = activeBatches.some(b => b.isProcessing);

  return { batches: activeBatches, hasActiveJobs, startBatch, dismissBatch };
}
