import { useRef } from 'react';

/**
 * Wraps async bulk runs so a second one is ignored while one is going (a fast double click
 * lands before a `running` state re-renders the buttons disabled). All wrapped functions
 * from one hook share the guard.
 */
export function useInFlightGuard() {
  const inFlight = useRef(false);
  return <A extends unknown[]>(fn: (...args: A) => Promise<void>) =>
    async (...args: A) => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        await fn(...args);
      } finally {
        inFlight.current = false;
      }
    };
}
