/**
 * Loading spinner component — terminal-style text animation
 */
import { useState, useEffect } from 'react';
import styles from './LoadingSpinner.module.css';

const FRAMES = ['|', '/', '-', '\\'];

export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length);
    }, 150);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.spinner}>{FRAMES[frame]}</div>
      <p>{message}</p>
    </div>
  );
}
