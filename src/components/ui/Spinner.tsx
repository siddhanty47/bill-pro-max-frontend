/**
 * Loading spinner component — terminal-style text animation
 */
import { useState, useEffect } from 'react';
import styles from './Spinner.module.css';

const FRAMES = ['|', '/', '-', '\\'];

export function Spinner({ message = 'Loading...' }: { message?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame(f => (f + 1) % FRAMES.length);
    }, 150);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.container} role="status">
      <div className={styles.spinner} aria-hidden="true">
        {FRAMES[frame]}
      </div>
      <p>{message}</p>
    </div>
  );
}

/** Legacy name kept for existing call sites. */
export const LoadingSpinner = Spinner;
