/**
 * @fileoverview Prev/Next pager for record detail pages
 * @description Steps through the table the record was opened from, using
 * `location.state.recordNav` (see utils/recordNav). Past the edge of a server-paged
 * list (challans, bills) it fetches the adjacent page. Navigates with `replace` so
 * browser Back returns to the table. Hotkeys: `[` previous, `]` next.
 */
import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLazyGetBillsPageQuery } from '../api/billApi';
import { useLazyGetChallansPageQuery } from '../api/challanApi';
import { useHotkey } from '../hooks/useHotkey';
import {
  navFromPage,
  navPosition,
  navStep,
  readRecordNav,
  recordNavState,
  SERVER_ROW_PATH,
} from '../utils/recordNav';
import { IconButton } from './ui';
import styles from './RecordPager.module.css';

export function RecordPager({ noun }: { noun: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const nav = readRecordNav(location.state, location.pathname);
  const [fetchChallans] = useLazyGetChallansPageQuery();
  const [fetchBills] = useLazyGetBillsPageQuery();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const prevStep = nav ? navStep(nav, -1) : null;
  const nextStep = nav ? navStep(nav, 1) : null;

  const step = async (dir: -1 | 1) => {
    if (!nav || busyRef.current) return;
    const s = dir === 1 ? nextStep : prevStep;
    if (!s) return;
    if (s.kind === 'go') {
      navigate(s.to, { replace: true, state: recordNavState(s.nav) });
      return;
    }
    const { server } = nav;
    if (!server) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const { source } = server;
      const result =
        source.list === 'challans'
          ? await fetchChallans({ ...source.args, page: s.page }).unwrap()
          : await fetchBills({ ...source.args, page: s.page }).unwrap();
      const paths = result.rows.map(row => SERVER_ROW_PATH[source.list](row._id));
      const next = navFromPage({ ...server, total: result.total }, s.page, paths, s.land);
      if (next) {
        navigate(next.paths[next.index], { replace: true, state: recordNavState(next) });
      }
    } catch {
      // Stay on this record; the buttons are usable again.
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const guarded = (dir: -1 | 1) => () => {
    if (document.querySelector('[role="dialog"]')) return;
    void step(dir);
  };
  useHotkey('[', guarded(-1));
  useHotkey(']', guarded(1));

  const position = nav ? navPosition(nav) : null;
  const title = nav ? undefined : 'Open from a table to browse';

  return (
    <nav className={styles.pager} aria-label={`Browse ${noun}s`}>
      <IconButton
        size="sm"
        icon="arrow-left"
        label={`Previous ${noun}`}
        title={title}
        disabled={!prevStep || busy}
        onClick={guarded(-1)}
      />
      {position && (
        <span className={styles.count}>
          {position.current} of {position.total}
        </span>
      )}
      <IconButton
        size="sm"
        icon="arrow-right"
        label={`Next ${noun}`}
        title={title}
        disabled={!nextStep || busy}
        onClick={guarded(1)}
      />
    </nav>
  );
}
