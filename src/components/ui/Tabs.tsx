import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './Tabs.module.css';

interface Tab {
  id: string;
  label: string;
  /** Optional count shown after the label (e.g. number of bills). */
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  /**
   * Unique per page (e.g. "party"). When set, each tab gets `id="{prefix}-tab-{id}"`
   * and `aria-controls="{prefix}-panel-{id}"`; render the content in a matching `TabPanel`.
   */
  idPrefix?: string;
}

const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/** True while the row overflows and is not scrolled to its end. */
function useOverflowFade(tabCount: number) {
  const ref = useRef<HTMLElement>(null);
  const [fade, setFade] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [tabCount]);
  return [ref, fade] as const;
}

export function Tabs({ tabs, activeTab, onChange, idPrefix }: TabsProps) {
  const [ref, fade] = useOverflowFade(tabs.length);
  return (
    <nav ref={ref} className={`${styles.tabs} ${fade ? styles.scrollable : ''}`} role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={idPrefix ? tabId(idPrefix, tab.id) : undefined}
          aria-controls={idPrefix ? panelId(idPrefix, tab.id) : undefined}
          aria-selected={activeTab === tab.id}
          className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count !== undefined && (
            <>
              {' '}
              <span className={styles.count}>{tab.count}</span>
            </>
          )}
        </button>
      ))}
    </nav>
  );
}

export type TabPanelProps = {
  /** Same `idPrefix` as the `Tabs` it belongs to. */
  idPrefix: string;
  /** The tab's `id`; render only the active tab's panel. */
  tabId: string;
  /** Placement only. */
  className?: string;
  children: ReactNode;
};

/** The content region for the active tab; labelled by its tab. */
export function TabPanel({ idPrefix, tabId: id, className, children }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={panelId(idPrefix, id)}
      aria-labelledby={tabId(idPrefix, id)}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
