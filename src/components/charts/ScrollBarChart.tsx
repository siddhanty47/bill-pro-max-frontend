import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  type MouseHandlerDataParam,
} from 'recharts';
import { ScrollArea } from '../ui/ScrollArea';
import { barLabel, niceTicks, tipLeft } from './chartFormat';
import { useChartTheme, type ChartTheme } from './chartTheme';
import styles from './Chart.module.css';

export type BarTone = 'accent' | 'muted' | 'info' | 'danger';

export type BarStack<T> = { key: keyof T & string; label: string; tone: BarTone };

/** Hover card content: a title (full name and code), value rows, an optional action hint. */
export type BarTooltip = { title: string; rows: { label: string; value: string }[]; hint?: string };

export type ScrollBarChartProps<T extends object> = {
  data: T[];
  /** Field shown under each bar (the code). */
  xKey: keyof T & string;
  /** Field whose initials stand in when the code is missing. */
  nameKey: keyof T & string;
  /** Stacked segments, bottom first; one entry for a plain bar chart. */
  stacks: BarStack<T>[];
  /** Y-axis labels (compact). */
  format: (n: number) => string;
  /** Card for the hovered (tapped, on touch screens) bar. */
  tooltip: (row: T) => BarTooltip;
  /**
   * A click anywhere in a bar's slot. On touch screens the first tap only previews the bar
   * (its card says "Tap again to open"); a second tap on the same bar calls this.
   */
  onBarClick?: (row: T) => void;
  /** Chart title: names the scroll region ("Stock, scrollable"). */
  title: string;
  /** Accessible name of the chart image: title plus a short summary, plain text. */
  ariaLabel: string;
  /** Horizontal space per bar; more rows than fit scroll sideways. */
  slotWidth?: number;
  height?: number;
};

const AXIS_WIDTH = 56;
const X_AXIS_HEIGHT = 28;
const MARGIN = { top: 8, right: 0, bottom: 0, left: 0 };
const RADIUS = 4;
/** A single series keeps tiny values visible (₹500 next to ₹18L). */
const MIN_POINT = 3;
const TAP_HINT = 'Tap again to open';

/** No hover (phones, tablets): a tap previews and a second tap acts. */
const isTouch = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(hover: none)')?.matches);

const indexOf = (state: MouseHandlerDataParam): number | null => {
  const i = Number(state.activeTooltipIndex ?? state.activeIndex);
  return Number.isInteger(i) && i >= 0 ? i : null;
};
/** Rounded data end; Cell's typings only allow a number radius, Rectangle takes corners. */
const ROUND_TOP = { radius: [RADIUS, RADIUS, 0, 0] } as object;

const toneColor = (theme: ChartTheme, tone: BarTone) => theme[tone];

type Plotted<T> = Record<string, unknown> & {
  __i: number;
  __label: string;
  __total: number;
  __row: T;
};

/** Width of an element, kept current while it resizes (0 where layout is unavailable). */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Vertical bars, one fixed-width slot per row; when the rows don't fit, the plot scrolls
 * sideways inside a `ScrollArea` while the y-axis stays put (it is drawn as its own narrow
 * chart with the same scale). The hover card is drawn over the frame, not inside the scrolling
 * plot, so it is never clipped by the visible edge. Load via React.lazy.
 */
export function ScrollBarChart<T extends object>({
  data,
  xKey,
  nameKey,
  stacks,
  format,
  tooltip,
  onBarClick,
  title,
  ariaLabel,
  slotWidth = 56,
  height = 220,
}: ScrollBarChartProps<T>) {
  const theme = useChartTheme();
  const [frame, frameWidth] = useWidth();
  const card = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);

  const value = (row: T, key: string) => Number((row as Record<string, unknown>)[key]) || 0;
  const total = (row: T) => stacks.reduce((s, st) => s + value(row, st.key), 0);
  const plotted: Plotted<T>[] = data.map((row, i) => ({
    ...(row as Record<string, unknown>),
    __i: i,
    __total: total(row),
    __label: barLabel(
      (row as Record<string, unknown>)[xKey],
      (row as Record<string, unknown>)[nameKey]
    ),
    __row: row,
  }));
  const max = plotted.reduce((m, p) => Math.max(m, p.__total), 0);
  const ticks = niceTicks(max);
  const domain: [number, number] = [0, ticks[ticks.length - 1]];
  // the top non-zero segment of each bar gets the rounded end
  const topStack = data.map(row => {
    for (let s = stacks.length - 1; s >= 0; s--) if (value(row, stacks[s].key) > 0) return s;
    return -1;
  });
  const plotWidth = Math.max(frameWidth - AXIS_WIDTH, data.length * slotWidth, slotWidth);
  const activeRow = active !== null ? data[active] : undefined;
  // bar centre in frame coordinates (the plot's category bands span its whole width)
  const barX =
    active !== null && data.length > 0
      ? AXIS_WIDTH + ((active + 0.5) * plotWidth) / data.length - scrollLeft
      : 0;

  // Position the card from its measured width (a CSS variable set on the element: no inline
  // style attribute). Runs after every render so a new bar or scroll moves it.
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const width = frameWidth || el.parentElement?.clientWidth || 0;
    el.style.setProperty('--tip-left', `${tipLeft(barX, el.offsetWidth, width)}px`);
  });

  // A tapped card stays until the next tap: a tap outside the plot dismisses it.
  useEffect(() => {
    if (active === null || !isTouch()) return;
    const dismiss = (e: PointerEvent) => {
      if (!plotRef.current?.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [active]);

  // The slot under the pointer, from the click position (Recharts reports the last hovered
  // index, which a tap may not have set yet).
  const slotAt = (clientX: number | undefined): number | null => {
    const el = plotRef.current;
    if (!el || clientX === undefined || data.length === 0) return null;
    const i = Math.floor((clientX - el.getBoundingClientRect().left) / (plotWidth / data.length));
    return i >= 0 && i < data.length ? i : null;
  };

  const handleClick = (state: MouseHandlerDataParam, event?: { clientX?: number }) => {
    const i = slotAt(event?.clientX) ?? indexOf(state);
    if (i === null || !data[i]) return;
    if (isTouch()) {
      if (active === i && onBarClick) onBarClick(data[i]);
      else setActive(i);
      return;
    }
    onBarClick?.(data[i]);
  };

  const tip = activeRow ? tooltip(activeRow) : undefined;
  const hint = tip && (onBarClick && isTouch() ? TAP_HINT : tip.hint);

  const axisProps = {
    stroke: theme.grid,
    tick: { fill: theme.axis },
    tickLine: false,
  } as const;

  return (
    <div ref={frame} className={styles.scrollFrame}>
      <div className={styles.scrollAxis} aria-hidden="true">
        <BarChart
          width={AXIS_WIDTH}
          height={height}
          data={plotted}
          margin={MARGIN}
          accessibilityLayer={false}
        >
          <XAxis dataKey="__i" height={X_AXIS_HEIGHT} tick={false} axisLine={false} />
          <YAxis
            {...axisProps}
            width={AXIS_WIDTH}
            domain={domain}
            ticks={ticks}
            interval={0}
            axisLine={false}
            tickFormatter={(n: number) => format(n)}
          />
          {/* Recharts lays out an axis only for a chart with a series; this one draws nothing */}
          <Bar dataKey="__total" fill="none" isAnimationActive={false} />
        </BarChart>
      </div>
      <ScrollArea
        label={`${title}, scrollable`}
        className={styles.scrollPlot}
        onScroll={left => {
          setScrollLeft(left);
          // a tapped bar may have scrolled out of view: drop its card
          if (isTouch()) setActive(null);
        }}
      >
        <div ref={plotRef} role="img" aria-label={ariaLabel}>
          <BarChart
            width={plotWidth}
            height={height}
            data={plotted}
            margin={MARGIN}
            barCategoryGap="28%"
            accessibilityLayer={false}
            className={onBarClick ? styles.clickable : undefined}
            onMouseEnter={state => {
              if (!isTouch()) setActive(indexOf(state));
            }}
            onMouseMove={state => {
              if (!isTouch()) setActive(indexOf(state));
            }}
            onMouseLeave={() => {
              if (!isTouch()) setActive(null);
            }}
            onClick={handleClick}
          >
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis
              {...axisProps}
              dataKey="__i"
              height={X_AXIS_HEIGHT}
              interval={0}
              tickFormatter={(i: number) => plotted[i]?.__label ?? ''}
            />
            <YAxis hide domain={domain} ticks={ticks} />
            {/* the hover band only; the card is drawn over the frame below */}
            <Tooltip cursor={{ fill: theme.grid }} isAnimationActive={false} content={() => null} />
            {stacks.map((stack, s) => (
              <Bar
                key={stack.key}
                dataKey={stack.key as string}
                name={stack.label}
                stackId="bars"
                fill={toneColor(theme, stack.tone)}
                maxBarSize={36}
                minPointSize={stacks.length === 1 ? MIN_POINT : 0}
                isAnimationActive={false}
              >
                {plotted.map((p, i) => (
                  <Cell key={p.__i} {...(topStack[i] === s ? ROUND_TOP : {})} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </div>
      </ScrollArea>
      {tip && (
        <div ref={card} className={`${styles.tooltip} ${styles.floatingTip}`}>
          <p className={styles.tooltipTitle}>{tip.title}</p>
          <ul className={styles.tooltipList}>
            {tip.rows.map(r => (
              <li key={r.label} className={styles.tooltipRow}>
                <span className={styles.tooltipName}>{r.label}</span>
                <span className="mono">{r.value}</span>
              </li>
            ))}
          </ul>
          {hint && <p className={styles.tooltipHint}>{hint}</p>}
        </div>
      )}
    </div>
  );
}

export default ScrollBarChart;
