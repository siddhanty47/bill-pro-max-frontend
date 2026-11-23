import { Bar, CartesianGrid, ComposedChart, Legend, Line, Tooltip, XAxis, YAxis } from 'recharts';
import type { Bucket, SeriesPoint } from '../../types';
import { formatTick } from './chartFormat';
import { useChartTheme } from './chartTheme';
import { ChartFrame, type ChartSize } from './ChartFrame';
import { ChartTooltip } from './ChartTooltip';
import styles from './Chart.module.css';

export type SeriesSpec = { key: string; label: string };

export type BarLineChartProps = {
  data: SeriesPoint[];
  bucket: Bucket;
  bar: SeriesSpec;
  line: SeriesSpec;
  /** Axis labels (and the tooltip unless `tooltipFormat` is given). */
  format: (n: number) => string;
  /** Tooltip values, e.g. full amounts while the axis is compact. */
  tooltipFormat?: (n: number) => string;
  /** Fixed size instead of filling the wrapper (tests). */
  size?: ChartSize;
};

/** Bars (e.g. billed) with a line (e.g. collected) over the same axis. Load via React.lazy. */
export function BarLineChart({
  data,
  bucket,
  bar,
  line,
  format,
  tooltipFormat,
  size,
}: BarLineChartProps) {
  const theme = useChartTheme();
  return (
    <ChartFrame size={size}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis
          dataKey="t"
          tickFormatter={(t: string) => formatTick(t, bucket)}
          stroke={theme.grid}
          tick={{ fill: theme.axis }}
          tickLine={false}
          minTickGap={16}
        />
        <YAxis
          width="auto"
          tickFormatter={(n: number) => format(n)}
          stroke={theme.grid}
          tick={{ fill: theme.axis }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ stroke: theme.grid }}
          content={props => (
            <ChartTooltip {...props} bucket={bucket} format={tooltipFormat ?? format} />
          )}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => <span className={styles.legendText}>{value}</span>}
        />
        <Bar
          dataKey={bar.key}
          name={bar.label}
          fill={theme.accent}
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
          isAnimationActive={false}
        />
        <Line
          dataKey={line.key}
          name={line.label}
          type="monotone"
          stroke={theme.info}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, stroke: theme.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartFrame>
  );
}

export default BarLineChart;
