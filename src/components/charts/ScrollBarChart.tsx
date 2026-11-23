import { useLayoutEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from 'recharts';
import { ScrollArea } from '../ui/ScrollArea';
import { barLabel, niceTicks } from './chartFormat';
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
  tooltip: (row: T) => BarTooltip;
  onBarClick?: (row: T) => void;
  /** Accessible name: chart title plus a short summary, plain text. */
  ariaLabel: string;
  /** Horizontal space per bar; more rows than fit scroll sideways. */
  slotWidth?: number;
  height?: number;
};

const AXIS_WIDTH = 56;
const X_AXIS_HEIGHT = 28;
const MARGIN = { top: 8, right: 0, bottom: 0, left: 0 };
const RADIUS = 4;
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
 * chart with the same scale). Load via React.lazy.
 */
export function ScrollBarChart<T extends object>({
  data,
  xKey,
  nameKey,
  stacks,
  format,
  tooltip,
  onBarClick,
  ariaLabel,
  slotWidth = 56,
  height = 220,
}: ScrollBarChartProps<T>) {
  const theme = useChartTheme();
  const [frame, frameWidth] = useWidth();

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
      <ScrollArea label={ariaLabel} className={styles.scrollPlot}>
        <div role="img" aria-label={ariaLabel}>
          <BarChart
            width={plotWidth}
            height={height}
            data={plotted}
            margin={MARGIN}
            barCategoryGap="28%"
            accessibilityLayer={false}
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
            <Tooltip
              cursor={{ fill: theme.grid }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const row = (payload?.[0]?.payload as Plotted<T> | undefined)?.__row;
                if (!active || !row) return null;
                const card = tooltip(row);
                return (
                  <div className={styles.tooltip}>
                    <p className={styles.tooltipTitle}>{card.title}</p>
                    <ul className={styles.tooltipList}>
                      {card.rows.map(r => (
                        <li key={r.label} className={styles.tooltipRow}>
                          <span className={styles.tooltipName}>{r.label}</span>
                          <span className="mono">{r.value}</span>
                        </li>
                      ))}
                    </ul>
                    {card.hint && <p className={styles.tooltipHint}>{card.hint}</p>}
                  </div>
                );
              }}
            />
            {stacks.map((stack, s) => (
              <Bar
                key={stack.key}
                dataKey={stack.key as string}
                name={stack.label}
                stackId="bars"
                fill={toneColor(theme, stack.tone)}
                maxBarSize={36}
                isAnimationActive={false}
                className={onBarClick ? styles.clickable : undefined}
                onClick={
                  onBarClick
                    ? (entry: { payload?: Plotted<T> }) => {
                        if (entry.payload) onBarClick(entry.payload.__row);
                      }
                    : undefined
                }
              >
                {plotted.map((p, i) => (
                  <Cell key={p.__i} {...(topStack[i] === s ? ROUND_TOP : {})} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </div>
      </ScrollArea>
    </div>
  );
}

export default ScrollBarChart;
